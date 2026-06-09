from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends

from dependencies import get_current_user, get_db
from models.schemas import ChatThreadsRequest, OperationLogRequest


router = APIRouter(prefix="/api/history", tags=["history"])


def _format_operation(row: dict) -> dict:
    created_at = row.get("created_at")
    dt = None
    if created_at:
        try:
            dt = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
        except ValueError:
            dt = None
    return {
        "id": row.get("id"),
        "type": row.get("type"),
        "action": row.get("action"),
        "createdAt": created_at,
        "date": dt.strftime("%d/%m/%Y") if dt else "",
        "time": dt.strftime("%H:%M") if dt else "",
    }


def _is_uuid(value: str) -> bool:
    try:
        UUID(str(value))
        return True
    except ValueError:
        return False


@router.get("")
async def get_history(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    response = (
        db.table("operation_logs")
        .select("*")
        .eq("user_id", current_user["id"])
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    )
    return [_format_operation(row) for row in (response.data or [])]


@router.post("")
async def add_history(payload: OperationLogRequest, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    row = {"user_id": current_user["id"], "type": payload.type[:30], "action": payload.action[:255]}
    response = db.table("operation_logs").insert(row).execute()
    saved = response.data[0] if response.data else row
    return {"success": True, "operation": _format_operation(saved)}


@router.get("/chat-threads")
async def get_chat_threads(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    threads_response = (
        db.table("chat_threads")
        .select("*")
        .eq("user_id", current_user["id"])
        .order("created_at", desc=False)
        .execute()
    )
    threads = threads_response.data or []
    thread_ids = [row["id"] for row in threads]
    messages_by_thread: dict[str, list] = {str(thread_id): [] for thread_id in thread_ids}
    if thread_ids:
        messages_response = (
            db.table("chat_messages")
            .select("*")
            .in_("thread_id", thread_ids)
            .order("created_at", desc=False)
            .execute()
        )
        for message in messages_response.data or []:
            messages_by_thread.setdefault(str(message.get("thread_id")), []).append(
                {"sender": message.get("sender"), "text": message.get("text")}
            )
    return {
        "threads": [
            {
                "id": str(row.get("id")),
                "title": row.get("title") or "Cuộc chat mới",
                "messages": messages_by_thread.get(str(row.get("id")), []),
            }
            for row in threads
        ]
    }


@router.put("/chat-threads")
async def save_chat_threads(payload: ChatThreadsRequest, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    existing = db.table("chat_threads").select("id").eq("user_id", current_user["id"]).execute().data or []
    existing_ids = [row["id"] for row in existing]
    if existing_ids:
        db.table("chat_messages").delete().in_("thread_id", existing_ids).execute()
        db.table("chat_threads").delete().eq("user_id", current_user["id"]).execute()

    saved_threads = []
    for thread in payload.threads[:50]:
        row = {"user_id": current_user["id"], "title": thread.title[:150]}
        if _is_uuid(thread.id):
            row["id"] = thread.id
        response = db.table("chat_threads").insert(row).execute()
        saved = response.data[0] if response.data else row
        thread_id = saved.get("id")
        messages = [
            {"thread_id": thread_id, "sender": message.sender[:10], "text": message.text}
            for message in thread.messages[:200]
            if message.text
        ]
        if messages:
            db.table("chat_messages").insert(messages).execute()
        saved_threads.append({"id": str(thread_id), "title": saved.get("title"), "messages": [{"sender": m["sender"], "text": m["text"]} for m in messages]})

    return {"success": True, "threads": saved_threads}
