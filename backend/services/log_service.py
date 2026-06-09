from typing import Optional



async def log_operation(db, user_id: Optional[str], log_type: str, action: str, tokens_used: int = 0) -> None:
    try:
        db.table("operation_logs").insert(
            {"user_id": user_id, "type": log_type, "action": action[:255], "tokens_used": tokens_used}
        ).execute()
    except Exception:
        return
