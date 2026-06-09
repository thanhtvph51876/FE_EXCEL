from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status

from auth_policy import (
    SENSITIVE_USER_FIELDS,
    WORKSPACE_ROLES,
    can_access_workspace,
    can_change_workspace_role,
    can_manage_workspace,
    effective_role,
    normalize_email,
)
from dependencies import get_current_user, get_db
from pg_client import PgClient


router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


def _reject_sensitive(payload: dict) -> None:
    forbidden = sorted(SENSITIVE_USER_FIELDS.intersection(payload.keys()))
    if forbidden:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Payload chứa field nhạy cảm không được phép cập nhật: {', '.join(forbidden)}.")


async def _json_payload(request: Request) -> dict:
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    return payload if isinstance(payload, dict) else {}


def _workspace_payload(row: dict, membership: dict | None = None) -> dict:
    return {
        "id": row.get("id"),
        "name": row.get("name") or "",
        "ownerUserId": row.get("owner_user_id"),
        "planId": row.get("plan_id") or "free",
        "role": (membership or {}).get("role") or "owner",
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def _member_payload(row: dict) -> dict:
    return {
        "userId": row.get("user_id"),
        "email": row.get("email") or "",
        "name": row.get("name") or "",
        "role": row.get("role"),
        "status": row.get("status") or "active",
        "joinedAt": row.get("joined_at"),
    }


def _membership(db: PgClient, workspace_id: str, user_id: str) -> dict | None:
    rows = db.table("workspace_members").select("*").eq("workspace_id", workspace_id).eq("user_id", user_id).limit(1).execute().data or []
    return rows[0] if rows else None


def _workspace_for_access(db: PgClient, workspace_id: str, current_user: dict) -> tuple[dict, dict | None]:
    rows = db.table("workspaces").select("*").eq("id", workspace_id).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy workspace.")
    workspace = rows[0]
    membership = _membership(db, workspace_id, current_user["id"])
    if not can_access_workspace(current_user, membership) and str(workspace.get("owner_user_id")) != str(current_user.get("id")):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy workspace.")
    return workspace, membership


def _workspace_for_manage(db: PgClient, workspace_id: str, current_user: dict) -> tuple[dict, dict | None]:
    workspace, membership = _workspace_for_access(db, workspace_id, current_user)
    if not can_manage_workspace(current_user, membership) and str(workspace.get("owner_user_id")) != str(current_user.get("id")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền quản lý workspace này.")
    return workspace, membership


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_workspace(request: Request, current_user: dict = Depends(get_current_user), db: PgClient = Depends(get_db)):
    payload = await _json_payload(request)
    _reject_sensitive(payload)
    name = str(payload.get("name") or f"Workspace của {current_user.get('name') or current_user.get('email')}").strip()[:180]
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tên workspace không hợp lệ.")
    response = db.table("workspaces").insert(
        {
            "name": name,
            "owner_user_id": current_user["id"],
            "plan_id": current_user.get("tier") or "free",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()
    workspace = response.data[0]
    db.table("workspace_members").insert(
        {"workspace_id": workspace["id"], "user_id": current_user["id"], "role": "owner", "invited_by": current_user["id"], "status": "active"}
    ).execute()
    db.table("operation_logs").insert({"user_id": current_user["id"], "type": "workspace", "action": f"workspace_created: {workspace['id']}"}).execute()
    return {"success": True, "workspace": _workspace_payload(workspace, {"role": "owner"})}


@router.get("")
async def list_workspaces(current_user: dict = Depends(get_current_user), db: PgClient = Depends(get_db)):
    if effective_role(current_user) == "admin":
        rows = db.table("workspaces").select("*").order("created_at", desc=True).limit(100).execute().data or []
        return {"success": True, "workspaces": [_workspace_payload(row, {"role": "owner"}) for row in rows]}
    rows = db.fetch(
        """
        SELECT w.*, wm.role, wm.status
        FROM workspaces w
        JOIN workspace_members wm ON wm.workspace_id = w.id
        WHERE wm.user_id = %s AND wm.status = 'active'
        ORDER BY w.created_at DESC
        """,
        [current_user["id"]],
    )
    return {"success": True, "workspaces": [_workspace_payload(row, row) for row in rows]}


@router.get("/{workspace_id}")
async def get_workspace(workspace_id: str, current_user: dict = Depends(get_current_user), db: PgClient = Depends(get_db)):
    workspace, membership = _workspace_for_access(db, workspace_id, current_user)
    return {"success": True, "workspace": _workspace_payload(workspace, membership)}


@router.put("/{workspace_id}")
async def update_workspace(workspace_id: str, request: Request, current_user: dict = Depends(get_current_user), db: PgClient = Depends(get_db)):
    payload = await _json_payload(request)
    _reject_sensitive(payload)
    workspace, membership = _workspace_for_manage(db, workspace_id, current_user)
    name = str(payload.get("name") or workspace.get("name") or "").strip()[:180]
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tên workspace không hợp lệ.")
    response = db.table("workspaces").update({"name": name, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", workspace_id).execute()
    db.table("operation_logs").insert({"user_id": current_user["id"], "type": "workspace", "action": f"workspace_updated: {workspace_id}"}).execute()
    return {"success": True, "workspace": _workspace_payload(response.data[0] if response.data else workspace, membership)}


@router.delete("/{workspace_id}")
async def delete_workspace(workspace_id: str, current_user: dict = Depends(get_current_user), db: PgClient = Depends(get_db)):
    workspace, membership = _workspace_for_access(db, workspace_id, current_user)
    if effective_role(current_user) != "admin" and str(workspace.get("owner_user_id")) != str(current_user.get("id")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ owner mới được xóa workspace.")
    db.table("workspaces").delete().eq("id", workspace_id).execute()
    db.table("operation_logs").insert({"user_id": current_user["id"], "type": "workspace", "action": f"workspace_deleted: {workspace_id}"}).execute()
    return {"success": True}


@router.get("/{workspace_id}/members")
async def list_members(workspace_id: str, current_user: dict = Depends(get_current_user), db: PgClient = Depends(get_db)):
    _workspace_for_access(db, workspace_id, current_user)
    rows = db.fetch(
        """
        SELECT wm.*, u.email, u.name
        FROM workspace_members wm
        JOIN users u ON u.id = wm.user_id
        WHERE wm.workspace_id = %s
        ORDER BY wm.joined_at ASC
        """,
        [workspace_id],
    )
    return {"success": True, "members": [_member_payload(row) for row in rows]}


@router.post("/{workspace_id}/members", status_code=status.HTTP_201_CREATED)
async def add_member(workspace_id: str, request: Request, current_user: dict = Depends(get_current_user), db: PgClient = Depends(get_db)):
    payload = await _json_payload(request)
    _reject_sensitive({key: value for key, value in payload.items() if key not in {"role"}})
    _, actor_membership = _workspace_for_manage(db, workspace_id, current_user)
    email = normalize_email(str(payload.get("email") or ""))
    role = str(payload.get("role") or "viewer").strip().lower()
    if role not in WORKSPACE_ROLES or role == "owner":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Role workspace không hợp lệ.")
    if email == normalize_email(current_user.get("email", "")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không được tự thêm chính mình vào workspace.")
    if not can_change_workspace_role(actor_membership, role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền gán role này.")
    user_rows = db.table("users").select("*").eq("email", email).limit(1).execute().data or []
    if not user_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy user theo email.")
    target = user_rows[0]
    existing = db.table("workspace_members").select("*").eq("workspace_id", workspace_id).eq("user_id", target["id"]).limit(1).execute().data or []
    member_row = {"workspace_id": workspace_id, "user_id": target["id"], "role": role, "invited_by": current_user["id"], "status": "active"}
    if existing:
        response = db.table("workspace_members").update(member_row).eq("workspace_id", workspace_id).eq("user_id", target["id"]).execute()
    else:
        response = db.table("workspace_members").insert(member_row).execute()
    db.table("operation_logs").insert({"user_id": current_user["id"], "type": "workspace", "action": f"workspace_member_added: {workspace_id}/{target['id']}={role}"}).execute()
    return {"success": True, "member": _member_payload({**(response.data[0] if response.data else {}), "email": target.get("email"), "name": target.get("name")})}


@router.put("/{workspace_id}/members/{member_user_id}")
async def update_member_role(workspace_id: str, member_user_id: str, request: Request, current_user: dict = Depends(get_current_user), db: PgClient = Depends(get_db)):
    payload = await _json_payload(request)
    _reject_sensitive({key: value for key, value in payload.items() if key not in {"role"}})
    workspace, actor_membership = _workspace_for_manage(db, workspace_id, current_user)
    role = str(payload.get("role") or "").strip().lower()
    if role not in WORKSPACE_ROLES or role == "owner":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Role workspace không hợp lệ.")
    if str(member_user_id) == str(workspace.get("owner_user_id")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không được đổi role owner.")
    if not can_change_workspace_role(actor_membership, role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền gán role này.")
    response = db.table("workspace_members").update({"role": role}).eq("workspace_id", workspace_id).eq("user_id", member_user_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thành viên.")
    db.table("operation_logs").insert({"user_id": current_user["id"], "type": "workspace", "action": f"workspace_member_role_updated: {workspace_id}/{member_user_id}={role}"}).execute()
    return {"success": True, "member": response.data[0]}


@router.delete("/{workspace_id}/members/{member_user_id}")
async def remove_member(workspace_id: str, member_user_id: str, current_user: dict = Depends(get_current_user), db: PgClient = Depends(get_db)):
    workspace, _ = _workspace_for_manage(db, workspace_id, current_user)
    if str(member_user_id) == str(workspace.get("owner_user_id")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không được xóa owner khỏi workspace.")
    db.table("workspace_members").delete().eq("workspace_id", workspace_id).eq("user_id", member_user_id).execute()
    db.table("operation_logs").insert({"user_id": current_user["id"], "type": "workspace", "action": f"workspace_member_removed: {workspace_id}/{member_user_id}"}).execute()
    return {"success": True}
