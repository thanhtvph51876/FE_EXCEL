from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from auth_policy import effective_role
from dependencies import get_current_user, get_db


router = APIRouter(prefix="/api/system/broadcasts", tags=["system"])


def _broadcast_payload(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "message": row.get("message") or "",
        "severity": row.get("severity") or "warning",
        "forceLogout": bool(row.get("force_logout")),
        "countdownSeconds": row.get("countdown_seconds") or 60,
        "startsAt": row.get("starts_at"),
        "expiresAt": row.get("expires_at"),
        "createdAt": row.get("created_at"),
    }


@router.get("/active")
async def active_broadcast(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    if effective_role(current_user) == "admin":
        return {"broadcast": None}

    now = datetime.now(timezone.utc).isoformat()
    response = (
        db.table("system_broadcasts")
        .select("*")
        .eq("active", True)
        .lte("starts_at", now)
        .gte("expires_at", now)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not response.data:
        return {"broadcast": None}
    return {"broadcast": _broadcast_payload(response.data[0])}
