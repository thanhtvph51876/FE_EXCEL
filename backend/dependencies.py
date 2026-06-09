from functools import lru_cache
from typing import Any, Dict

from fastapi import Depends, HTTPException, status
from fastapi import Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from auth_policy import effective_role, normalize_status
from config import settings
from entitlements import ENTITLEMENTS, tier_entitlement
from pg_client import PgClient
from services.session_service import require_session_active


security = HTTPBearer(auto_error=False)

TIER_LIMITS = {
    tier: {
        "usage_limit": config["ai_requests_per_day"],
        "max_file_mb": config["max_file_size_mb"],
    }
    for tier, config in ENTITLEMENTS.items()
}

VALID_TIERS = tuple(TIER_LIMITS.keys())


@lru_cache
def get_db() -> PgClient:
    if not settings.database_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Thiếu DATABASE_URL cho PostgreSQL/pgAdmin 4.",
        )
    return PgClient(settings.database_url)


def tier_limit(tier: str) -> int:
    return TIER_LIMITS.get(tier or "free", TIER_LIMITS["free"])["usage_limit"]


def validate_tier(tier: str) -> str:
    value = (tier or "").strip().lower()
    if value not in TIER_LIMITS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Gói tài khoản không hợp lệ. Chỉ hỗ trợ: {', '.join(VALID_TIERS)}.",
        )
    return value


def max_file_mb(tier: str) -> int:
    return tier_entitlement(tier)["max_file_size_mb"]


def user_to_response(user: Dict[str, Any]) -> Dict[str, Any]:
    tier = user.get("tier") or "free"
    role = effective_role(user)
    account_status = normalize_status(user.get("status"))
    return {
        "id": user.get("id"),
        "name": user.get("name") or "",
        "email": user.get("email") or "",
        "tier": tier,
        "usageCount": user.get("usage_count", 0),
        "usageLimit": user.get("usage_limit") or tier_limit(tier),
        "monthlyUsage": user.get("monthly_usage", user.get("usage_count", 0)),
        "monthlyUsageLimit": user.get("monthly_usage_limit", user.get("usage_limit") or tier_limit(tier)),
        "tokenUsage": user.get("token_usage", 0),
        "status": account_status,
        "role": role,
        "createdAt": user.get("created_at"),
        "lastActivityAt": user.get("last_activity_at") or user.get("created_at"),
        "workspace": user.get("workspace") or "",
    }


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: PgClient = Depends(get_db),
) -> Dict[str, Any]:
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Thiếu Bearer token.")

    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        session_id = payload.get("sid")
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token không hợp lệ hoặc đã hết hạn.") from exc

    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token không hợp lệ.")
    require_session_active(db, str(session_id or ""), str(user_id))

    response = db.table("users").select("*").eq("id", user_id).limit(1).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Không tìm thấy người dùng.")

    profile = response.data[0]
    if normalize_status(profile.get("status")) != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tài khoản của bạn đang không hoạt động.")
    request.state.user_id = str(profile.get("id"))
    return profile


async def require_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if effective_role(current_user) != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền quản trị.")
    return current_user
