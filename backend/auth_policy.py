import os


def _admin_emails() -> set[str]:
    raw = os.getenv("ADMIN_EMAILS") or os.getenv("ADMIN_EMAIL") or ""
    return {normalize_email(email) for email in raw.split(",") if normalize_email(email)}


USER_STATUSES = ("active", "inactive", "pending", "suspended", "deleted")
WORKSPACE_ROLES = ("owner", "admin", "manager", "staff", "member", "viewer")
WORKSPACE_MANAGE_ROLES = ("owner", "admin", "manager")
WORKSPACE_WRITE_ROLES = ("owner", "admin", "manager", "staff", "member")
SENSITIVE_USER_FIELDS = {
    "role",
    "tier",
    "quota",
    "usage_limit",
    "status",
    "is_active",
    "is_verified",
    "owner_id",
    "workspace_id",
    "workspace_role",
    "created_by",
    "plan_id",
    "storage_limit",
    "ai_limit",
}

STATUS_ALIASES = {
    "active": "active",
    "hoạt động": "active",
    "ho?t ??ng": "active",
    "hoat dong": "active",
    "inactive": "inactive",
    "không hoạt động": "inactive",
    "không ho?t ??ng": "inactive",
    "khong hoat dong": "inactive",
    "pending": "pending",
    "chờ xác minh": "pending",
    "ch? xác minh": "pending",
    "cho xac minh": "pending",
    "suspended": "suspended",
    "bị khóa": "suspended",
    "đã khóa": "suspended",
    "tạm khóa": "suspended",
    "t?m khóa": "suspended",
    "bi khoa": "suspended",
    "da khoa": "suspended",
    "tam khoa": "suspended",
    "deleted": "deleted",
}


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def is_admin_email(email: str) -> bool:
    return normalize_email(email) in _admin_emails()


def effective_role(user: dict) -> str:
    role = (user.get("role") or "user").strip().lower()
    if role == "admin" or is_admin_email(user.get("email", "")):
        return "admin"
    return "user"


def is_platform_admin(user: dict) -> bool:
    return effective_role(user) == "admin"


def normalize_status(value: str | None) -> str:
    key = (value or "active").strip().lower()
    return STATUS_ALIASES.get(key, key if key in USER_STATUSES else "active")


def is_active_user(user: dict) -> bool:
    return normalize_status(user.get("status")) == "active"


def workspace_role(membership: dict | None) -> str:
    role = (membership or {}).get("role") or ""
    return role if role in WORKSPACE_ROLES else ""


def can_access_workspace(user: dict, workspace_owner_or_membership) -> bool:
    if is_platform_admin(user):
        return True
    if isinstance(workspace_owner_or_membership, dict):
        return workspace_role(workspace_owner_or_membership) in WORKSPACE_ROLES and (workspace_owner_or_membership.get("status") or "active") == "active"
    return str(user.get("id")) == str(workspace_owner_or_membership)


def can_manage_workspace(user: dict, workspace_owner_or_membership) -> bool:
    if is_platform_admin(user):
        return True
    if isinstance(workspace_owner_or_membership, dict):
        return workspace_role(workspace_owner_or_membership) in WORKSPACE_MANAGE_ROLES and (workspace_owner_or_membership.get("status") or "active") == "active"
    return str(user.get("id")) == str(workspace_owner_or_membership)


def can_upload_to_workspace(user: dict, membership: dict | None) -> bool:
    return is_active_user(user) and (is_platform_admin(user) or workspace_role(membership) in WORKSPACE_WRITE_ROLES)


def can_change_workspace_role(actor_membership: dict | None, target_role: str) -> bool:
    actor_role = workspace_role(actor_membership)
    if actor_role == "owner":
        return target_role in WORKSPACE_ROLES
    if actor_role in {"admin", "manager"}:
        return target_role in {"staff", "member", "viewer"}
    return False


def can_read_file(user: dict, file_row: dict) -> bool:
    return is_platform_admin(user) or str(file_row.get("user_id")) == str(user.get("id"))


def can_delete_file(user: dict, file_row: dict) -> bool:
    return can_read_file(user, file_row)


def can_upload_file(user: dict) -> bool:
    return is_active_user(user)


def can_use_ai(user: dict, file_row: dict | None = None) -> bool:
    if not is_active_user(user):
        return False
    return file_row is None or can_read_file(user, file_row)


def can_manage_billing(user: dict) -> bool:
    return is_platform_admin(user)
