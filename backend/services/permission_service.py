from __future__ import annotations

from auth_policy import (
    WORKSPACE_ROLES,
    can_change_workspace_role,
    can_manage_workspace,
    effective_role,
    is_active_user,
    workspace_role,
)
from pg_client import PgClient


READ_ROLES = set(WORKSPACE_ROLES)
UPLOAD_ROLES = {"owner", "admin", "manager", "staff", "member"}
DELETE_ANY_ROLES = {"owner", "admin", "manager"}
OUTPUT_READ_ROLES = set(WORKSPACE_ROLES)


def workspace_membership(db: PgClient, workspace_id: str | None, user_id: str | None) -> dict | None:
    if not workspace_id or not user_id:
        return None
    rows = (
        db.table("workspace_members")
        .select("*")
        .eq("workspace_id", workspace_id)
        .eq("user_id", user_id)
        .eq("status", "active")
        .limit(1)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


def can_read_file(db: PgClient, user: dict, file_row: dict) -> bool:
    if effective_role(user) == "admin":
        return True
    if str(file_row.get("user_id")) == str(user.get("id")):
        return True
    workspace_id = file_row.get("workspace_id")
    if not workspace_id:
        return False
    return workspace_role(workspace_membership(db, workspace_id, user.get("id"))) in READ_ROLES


def can_use_file_for_ai(db: PgClient, user: dict, file_row: dict, action: str = "read") -> bool:
    if not is_active_user(user) or not can_read_file(db, user, file_row):
        return False
    if action in {"export", "write"} and str(file_row.get("user_id")) != str(user.get("id")):
        membership = workspace_membership(db, file_row.get("workspace_id"), user.get("id"))
        return workspace_role(membership) in UPLOAD_ROLES
    return True


def can_delete_file(db: PgClient, user: dict, file_row: dict) -> bool:
    if effective_role(user) == "admin":
        return True
    if str(file_row.get("user_id")) == str(user.get("id")):
        return True
    workspace_id = file_row.get("workspace_id")
    if not workspace_id:
        return False
    return workspace_role(workspace_membership(db, workspace_id, user.get("id"))) in DELETE_ANY_ROLES


def can_upload_to_workspace(db: PgClient, user: dict, workspace_id: str | None) -> bool:
    if not is_active_user(user):
        return False
    if not workspace_id:
        return True
    if effective_role(user) == "admin":
        return True
    return workspace_role(workspace_membership(db, workspace_id, user.get("id"))) in UPLOAD_ROLES


def can_read_output(db: PgClient, user: dict, output_row: dict) -> bool:
    if effective_role(user) == "admin":
        return True
    if str(output_row.get("user_id")) == str(user.get("id")):
        return True
    source_file_id = output_row.get("source_file_id")
    if source_file_id:
        files = db.table("files").select("*").eq("id", source_file_id).limit(1).execute().data or []
        return bool(files and can_read_file(db, user, files[0]))
    workspace_id = output_row.get("workspace_id")
    if not workspace_id:
        return False
    return workspace_role(workspace_membership(db, workspace_id, user.get("id"))) in OUTPUT_READ_ROLES


def can_manage_workspace_role(actor_membership: dict | None, target_role: str) -> bool:
    return can_change_workspace_role(actor_membership, target_role)


def can_manage_workspace_member(user: dict, membership: dict | None) -> bool:
    return can_manage_workspace(user, membership)
