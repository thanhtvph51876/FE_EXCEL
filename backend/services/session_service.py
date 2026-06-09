from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, Request, status

from config import settings
from pg_client import PgClient
from rate_limit import client_ip


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def parse_pg_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    text = str(value)
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def create_session(db: PgClient, user_id: str, request: Request | None = None) -> dict:
    token = new_refresh_token()
    expires_at = utc_now() + timedelta(days=settings.refresh_token_days)
    row = {
        "user_id": user_id,
        "refresh_token_hash": hash_refresh_token(token),
        "user_agent": (request.headers.get("user-agent", "") if request else "")[:500],
        "ip_address": (client_ip(request) if request else "")[:80],
        "expires_at": expires_at.isoformat(),
    }
    response = db.table("user_sessions").insert(row).execute()
    saved = response.data[0] if response.data else row
    return {
        "session_id": str(saved.get("id")),
        "user_id": user_id,
        "refresh_token": token,
        "expires_at": saved.get("expires_at") or expires_at.isoformat(),
    }


def revoke_session(db: PgClient, session_id: str, reason: str = "logout") -> None:
    if not session_id:
        return
    db.table("user_sessions").update(
        {"revoked_at": utc_now().isoformat(), "revoked_reason": reason[:120]}
    ).eq("id", session_id).execute()


def revoke_user_sessions(db: PgClient, user_id: str, reason: str = "admin_revoke") -> None:
    db.fetch(
        """
        UPDATE user_sessions
        SET revoked_at = NOW(), revoked_reason = %s
        WHERE user_id = %s AND revoked_at IS NULL
        """,
        [reason[:120], user_id],
        commit=True,
    )


def require_session_active(db: PgClient, session_id: str, user_id: str) -> dict:
    if not session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Phiên đăng nhập cũ không còn hợp lệ. Vui lòng đăng nhập lại.")
    rows = db.table("user_sessions").select("*").eq("id", session_id).eq("user_id", user_id).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Phiên đăng nhập không tồn tại.")
    session = rows[0]
    if session.get("revoked_at"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Phiên đăng nhập đã bị thu hồi.")
    expires_at = parse_pg_datetime(session.get("expires_at"))
    if expires_at and expires_at <= utc_now():
        revoke_session(db, session_id, "expired")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Phiên đăng nhập đã hết hạn.")
    return session


def consume_refresh_token(db: PgClient, refresh_token: str, request: Request | None = None) -> dict:
    token_hash = hash_refresh_token(refresh_token or "")
    rows = db.table("user_sessions").select("*").eq("refresh_token_hash", token_hash).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token không hợp lệ.")
    session = rows[0]
    require_session_active(db, str(session.get("id")), str(session.get("user_id")))
    revoke_session(db, str(session.get("id")), "rotated")
    return create_session(db, str(session.get("user_id")), request)
