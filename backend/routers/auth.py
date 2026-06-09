from datetime import datetime, timedelta, timezone
from uuid import uuid4

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import jwt

from auth_policy import is_admin_email, normalize_email, normalize_status
from config import settings
from dependencies import get_current_user, get_db, tier_limit, user_to_response
from models.schemas import LoginRequest, RegisterRequest
from pg_client import PgClient
from rate_limit import client_ip, enforce_ip_rate_limit, enforce_rate_limit
from services.session_service import consume_refresh_token, create_session, parse_pg_datetime, revoke_session, utc_now


router = APIRouter(prefix="/api/auth", tags=["auth"])
JWT_ALGORITHM = "HS256"


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def _token(user_id: str, session_id: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_minutes)
    return jwt.encode({"sub": user_id, "sid": session_id, "exp": expires}, settings.jwt_secret, algorithm=JWT_ALGORITHM)


def _auth_response(db: PgClient, user: dict, request: Request) -> dict:
    session = create_session(db, str(user["id"]), request)
    return {
        "success": True,
        "token": _token(str(user["id"]), session["session_id"]),
        "refreshToken": session["refresh_token"],
        "sessionId": session["session_id"],
        "expiresIn": settings.access_token_minutes * 60,
        "user": user_to_response(user),
    }


def _record_failed_login(db: PgClient, request: Request, email: str, user: dict | None = None) -> None:
    user_id = user.get("id") if user else None
    db.table("failed_login_attempts").insert(
        {
            "email": email[:150],
            "user_id": user_id,
            "ip_address": client_ip(request)[:80],
            "user_agent": request.headers.get("user-agent", "")[:500],
        }
    ).execute()
    if not user_id:
        return
    failed_count = int(user.get("failed_login_count") or 0) + 1
    update = {"failed_login_count": failed_count}
    if failed_count >= 5:
        update["lock_until"] = (utc_now() + timedelta(minutes=15)).isoformat()
    db.table("users").update(update).eq("id", user_id).execute()


def _ensure_not_locked(user: dict) -> None:
    lock_until = parse_pg_datetime(user.get("lock_until"))
    if lock_until and lock_until > utc_now():
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail="Tài khoản đang bị khóa tạm thời do đăng nhập sai nhiều lần. Hãy thử lại sau.")


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(request: Request, payload: RegisterRequest, db: PgClient = Depends(get_db)):
    enforce_ip_rate_limit(request, "auth:register", 5, 600)
    email = normalize_email(payload.email)
    if is_admin_email(email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email này là tài khoản admin hệ thống và không được đăng ký từ web.",
        )

    existing = db.table("users").select("*").eq("email", email).limit(1).execute()
    if existing.data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.")

    user_id = str(uuid4())
    profile = {
        "id": user_id,
        "name": payload.name,
        "email": email,
        "password_hash": _hash_password(payload.password),
        "tier": "free",
        "usage_count": 0,
        "usage_limit": tier_limit("free"),
        "status": "active",
        "role": "user",
    }
    response = db.table("users").insert(profile).execute()
    user = response.data[0] if response.data else profile
    db.table("operation_logs").insert({"user_id": user_id, "type": "auth", "action": f"register success: {email}"}).execute()
    return _auth_response(db, user, request)


@router.post("/login")
async def login(request: Request, payload: LoginRequest, db: PgClient = Depends(get_db)):
    email = normalize_email(payload.email)
    enforce_ip_rate_limit(request, "auth:login", 5, 60)
    enforce_rate_limit(f"email:auth:login:{email}:{client_ip(request)}", 5, 60)
    response = db.table("users").select("*").eq("email", email).limit(1).execute()
    if not response.data:
        _record_failed_login(db, request, email)
        db.table("operation_logs").insert({"user_id": None, "type": "auth", "action": f"login fail: {email[:120]}"}).execute()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email hoặc mật khẩu không đúng.")

    user = response.data[0]
    _ensure_not_locked(user)
    if not _verify_password(payload.password, user.get("password_hash")):
        _record_failed_login(db, request, email, user)
        db.table("operation_logs").insert({"user_id": user.get("id"), "type": "auth", "action": "login fail: invalid password"}).execute()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email hoặc mật khẩu không đúng.")
    if normalize_status(user.get("status")) != "active":
        db.table("operation_logs").insert({"user_id": user.get("id"), "type": "auth", "action": "login fail: inactive user"}).execute()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tài khoản của bạn đang không hoạt động.")
    updated = db.table("users").update(
        {"last_login_at": utc_now().isoformat(), "failed_login_count": 0, "lock_until": None}
    ).eq("id", user["id"]).execute().data
    if updated:
        user = updated[0]
    db.table("operation_logs").insert({"user_id": user.get("id"), "type": "auth", "action": "login success"}).execute()
    return _auth_response(db, user, request)


@router.post("/logout")
async def logout(request: Request, current_user: dict = Depends(get_current_user), db: PgClient = Depends(get_db)):
    token = (request.headers.get("authorization") or "").replace("Bearer ", "").strip()
    if token:
        try:
            payload = jwt.decode(token, settings.jwt_secret, algorithms=[JWT_ALGORITHM])
            revoke_session(db, str(payload.get("sid") or ""), "logout")
        except Exception:
            pass
    return {"success": True, "message": "Đăng xuất thành công"}


@router.post("/refresh")
async def refresh_token(request: Request, payload: dict, db: PgClient = Depends(get_db)):
    refresh_value = str(payload.get("refreshToken") or payload.get("refresh_token") or "")
    session = consume_refresh_token(db, refresh_value, request)
    user_response = db.table("users").select("*").eq("id", session.get("user_id", "")).limit(1).execute()
    if not user_response.data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Không tìm thấy người dùng của phiên.")
    user = user_response.data[0]
    if normalize_status(user.get("status")) != "active":
        revoke_session(db, session["session_id"], "inactive_user")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tài khoản của bạn đang không hoạt động.")
    return {
        "success": True,
        "token": _token(str(user["id"]), session["session_id"]),
        "refreshToken": session["refresh_token"],
        "sessionId": session["session_id"],
        "expiresIn": settings.access_token_minutes * 60,
        "user": user_to_response(user),
    }


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return user_to_response(current_user)
