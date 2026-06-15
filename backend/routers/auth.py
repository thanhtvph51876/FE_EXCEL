from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from hashlib import sha256
from html import escape
import secrets
import smtplib
from urllib.parse import urlencode, urlparse
from uuid import uuid4

import bcrypt
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import jwt

from auth_policy import is_admin_email, normalize_email, normalize_status
from config import settings
from dependencies import get_current_user, get_db, tier_limit, user_to_response
from models.schemas import ForgotPasswordRequest, GoogleAuthRequest, LoginRequest, RegisterRequest, ResetPasswordRequest
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
        update["lock_until"] = (utc_now() + timedelta(minutes=settings.account_lock_minutes)).isoformat()
    db.table("users").update(update).eq("id", user_id).execute()


def _ensure_not_locked(user: dict) -> None:
    lock_until = parse_pg_datetime(user.get("lock_until"))
    if lock_until and lock_until > utc_now():
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail="Tài khoản đang bị khóa tạm thời do đăng nhập sai nhiều lần. Hãy thử lại sau.")


def _token_hash(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def _create_user_profile(db: PgClient, name: str, email: str, password_hash: str | None = None, tier: str = "free") -> dict:
    user_id = str(uuid4())
    profile = {
        "id": user_id,
        "name": (name or email.split("@")[0])[:100],
        "email": email[:150],
        "password_hash": password_hash,
        "tier": tier,
        "usage_count": 0,
        "usage_limit": tier_limit(tier),
        "status": "active",
        "role": "admin" if is_admin_email(email) else "user",
    }
    response = db.table("users").insert(profile).execute()
    return response.data[0] if response.data else profile


def _build_password_reset_url(reset_token: str) -> str:
    frontend_url = (settings.frontend_url or "").strip().rstrip("/")
    parsed = urlparse(frontend_url)
    hostname = (parsed.hostname or "").lower()
    if settings.environment.lower() == "production" and hostname in {"localhost", "127.0.0.1", "::1"}:
        raise RuntimeError("FRONTEND_URL must use a production domain for password reset emails.")
    if not parsed.scheme or not parsed.netloc:
        raise RuntimeError("FRONTEND_URL must be an absolute URL.")
    return f"{frontend_url}/reset-password?{urlencode({'resetToken': reset_token})}"


def _password_reset_text(reset_url: str) -> str:
    minutes = settings.password_reset_minutes
    return "\n".join(
        [
            "Đặt lại mật khẩu ExcelAI",
            "",
            "Xin chào,",
            "",
            "Bạn vừa yêu cầu đặt lại mật khẩu ExcelAI.",
            f"Vui lòng mở liên kết dưới đây để đặt mật khẩu mới. Liên kết sẽ hết hạn sau {minutes} phút:",
            "",
            reset_url,
            "",
            "Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email này. Mật khẩu hiện tại của bạn sẽ không thay đổi.",
            "",
            "© ExcelAI",
        ]
    )


def _password_reset_html(reset_url: str) -> str:
    safe_url = escape(reset_url, quote=True)
    minutes = settings.password_reset_minutes
    return f"""<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <title>Đặt lại mật khẩu ExcelAI</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#111827;-webkit-text-size-adjust:100%;text-size-adjust:100%;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#f3f6fb;margin:0;padding:0;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background-color:#0f766e;padding:24px 28px;">
                <div style="font-size:14px;line-height:20px;color:#d1fae5;font-weight:700;">ExcelAI</div>
                <h1 style="margin:8px 0 0;font-size:24px;line-height:32px;color:#ffffff;font-weight:700;">Đặt lại mật khẩu ExcelAI</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#111827;">Xin chào,</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#374151;">Bạn vừa yêu cầu đặt lại mật khẩu ExcelAI. Nhấn nút bên dưới để tạo mật khẩu mới cho tài khoản của bạn.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
                  <tr>
                    <td align="center" bgcolor="#16a34a" style="border-radius:6px;">
                      <a href="{safe_url}" target="_blank" style="display:inline-block;padding:14px 24px;font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px;background-color:#16a34a;">Đặt lại mật khẩu</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#4b5563;">Liên kết này sẽ hết hạn sau <strong>{minutes} phút</strong> để bảo vệ tài khoản của bạn.</p>
                <p style="margin:0 0 8px;font-size:14px;line-height:22px;color:#4b5563;">Nếu nút không hoạt động, hãy sao chép liên kết dự phòng này và dán vào trình duyệt:</p>
                <p style="margin:0 0 20px;font-size:13px;line-height:20px;word-break:break-all;color:#2563eb;"><a href="{safe_url}" target="_blank" style="color:#2563eb;text-decoration:underline;">{safe_url}</a></p>
                <div style="margin:20px 0 0;padding:14px 16px;background-color:#fff7ed;border:1px solid #fed7aa;border-radius:6px;">
                  <p style="margin:0;font-size:14px;line-height:22px;color:#9a3412;"><strong>Cảnh báo bảo mật:</strong> Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email. Mật khẩu hiện tại của bạn sẽ không thay đổi.</p>
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 28px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:13px;line-height:20px;color:#6b7280;">© ExcelAI</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def _send_password_reset_email(to_email: str, reset_url: str) -> None:
    if not settings.smtp_enabled:
        return
    message = EmailMessage()
    message["Subject"] = "Đặt lại mật khẩu ExcelAI"
    message["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    message["To"] = to_email
    message.set_content(_password_reset_text(reset_url))
    message.add_alternative(_password_reset_html(reset_url), subtype="html")
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        smtp.starttls()
        smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)


async def _verify_google_id_token(credential: str) -> dict:
    if not settings.google_client_id:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Chưa cấu hình GOOGLE_CLIENT_ID cho đăng nhập Google.")
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            response = await client.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": credential})
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Không thể xác minh Google token lúc này.") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google token không hợp lệ hoặc đã hết hạn.")
    payload = response.json()
    if payload.get("aud") != settings.google_client_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google token không thuộc ứng dụng này.")
    if str(payload.get("email_verified")).lower() != "true":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email Google chưa được xác minh.")
    return payload


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

    user = _create_user_profile(db, payload.name, email, _hash_password(payload.password))
    db.table("operation_logs").insert({"user_id": user.get("id"), "type": "auth", "action": f"register success: {email}"}).execute()
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


@router.get("/google/config")
async def google_config():
    return {"success": True, "enabled": bool(settings.google_client_id), "clientId": settings.google_client_id}


@router.post("/google")
async def google_login(request: Request, payload: GoogleAuthRequest, db: PgClient = Depends(get_db)):
    enforce_ip_rate_limit(request, "auth:google", 10, 60)
    profile = await _verify_google_id_token(payload.credential)
    email = normalize_email(profile.get("email") or "")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google token không có email hợp lệ.")

    rows = db.table("users").select("*").eq("email", email).limit(1).execute().data or []
    if rows:
        user = rows[0]
        if normalize_status(user.get("status")) != "active":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tài khoản của bạn đang không hoạt động.")
        update = {"last_login_at": utc_now().isoformat(), "failed_login_count": 0, "lock_until": None}
        if not user.get("password_hash"):
            update["name"] = user.get("name") or profile.get("name") or email.split("@")[0]
        updated = db.table("users").update(update).eq("id", user["id"]).execute().data
        if updated:
            user = updated[0]
    else:
        user = _create_user_profile(db, profile.get("name") or email.split("@")[0], email, None)

    db.table("operation_logs").insert({"user_id": user.get("id"), "type": "auth", "action": "google login success"}).execute()
    return _auth_response(db, user, request)


@router.post("/forgot-password")
async def forgot_password(request: Request, payload: ForgotPasswordRequest, db: PgClient = Depends(get_db)):
    email = normalize_email(payload.email)
    enforce_ip_rate_limit(request, "auth:forgot-password", 5, 600)
    rows = db.table("users").select("*").eq("email", email).limit(1).execute().data or []
    response = {"success": True, "message": "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi."}
    if not rows:
        return response

    user = rows[0]
    raw_token = secrets.token_urlsafe(48)
    expires_at = utc_now() + timedelta(minutes=settings.password_reset_minutes)
    db.table("password_reset_tokens").insert(
        {
            "user_id": user["id"],
            "token_hash": _token_hash(raw_token),
            "expires_at": expires_at.isoformat(),
            "ip_address": client_ip(request)[:80],
        }
    ).execute()
    db.table("operation_logs").insert({"user_id": user.get("id"), "type": "auth", "action": "password reset requested"}).execute()

    reset_url = _build_password_reset_url(raw_token)
    mail_sent = False
    if settings.smtp_enabled:
        try:
            _send_password_reset_email(email, reset_url)
            mail_sent = True
        except Exception as exc:
            db.table("operation_logs").insert({"user_id": user.get("id"), "type": "auth", "action": f"password reset email failed: {type(exc).__name__}"}).execute()
            if settings.environment.lower() == "production":
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Không thể gửi email đặt lại mật khẩu lúc này.") from exc

    response["emailSent"] = mail_sent
    if settings.environment.lower() != "production" and settings.expose_dev_reset_token:
        response["resetToken"] = raw_token
        response["resetUrl"] = reset_url
    return response


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: PgClient = Depends(get_db)):
    token_hash = _token_hash(payload.token)
    rows = db.table("password_reset_tokens").select("*").eq("token_hash", token_hash).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token đặt lại mật khẩu không hợp lệ.")
    reset_row = rows[0]
    if reset_row.get("used_at"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token đặt lại mật khẩu đã được sử dụng.")
    expires_at = parse_pg_datetime(reset_row.get("expires_at"))
    if not expires_at or expires_at < utc_now():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token đặt lại mật khẩu đã hết hạn.")

    user_id = str(reset_row.get("user_id"))
    db.table("users").update({"password_hash": _hash_password(payload.password), "failed_login_count": 0, "lock_until": None}).eq("id", user_id).execute()
    db.table("password_reset_tokens").update({"used_at": utc_now().isoformat()}).eq("id", reset_row["id"]).execute()
    db.table("operation_logs").insert({"user_id": user_id, "type": "auth", "action": "password reset success"}).execute()
    return {"success": True, "message": "Đã đặt lại mật khẩu. Vui lòng đăng nhập bằng mật khẩu mới."}


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
