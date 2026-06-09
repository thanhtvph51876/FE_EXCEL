import hashlib
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from auth_policy import SENSITIVE_USER_FIELDS
from config import settings
from dependencies import get_current_user, get_db, tier_limit, user_to_response, validate_tier
from entitlements import ENTITLEMENTS, tier_entitlement
from metrics import increment_business_metric
from rate_limit import enforce_user_rate_limit
from services.payment_provider import provider_for


router = APIRouter(prefix="/api/billing", tags=["billing"])
DEFAULT_PRICING_CONFIG = {
    "monthly": {"pro": "149,000đ", "business": "299,000đ", "enterprise": "399,000đ", "period": "/tháng"},
    "annual": {"pro": "119,000đ", "business": "239,000đ", "enterprise": "319,000đ", "period": "/tháng (trả năm)"},
}
CHECKOUT_FORBIDDEN_FIELDS = SENSITIVE_USER_FIELDS - {"tier"}


def _pricing_from_settings(db) -> dict:
    response = db.table("settings").select("*").eq("key", "pricing_config").limit(1).execute()
    if not response.data:
        return DEFAULT_PRICING_CONFIG.copy()
    try:
        parsed = json.loads(response.data[0].get("value") or "{}")
        if isinstance(parsed, dict):
            return {
                "monthly": {**DEFAULT_PRICING_CONFIG["monthly"], **(parsed.get("monthly") or {})},
                "annual": {**DEFAULT_PRICING_CONFIG["annual"], **(parsed.get("annual") or {})},
            }
    except json.JSONDecodeError:
        pass
    return DEFAULT_PRICING_CONFIG.copy()


def _price_to_amount(value: str | int | float | None) -> int:
    if isinstance(value, (int, float)):
        return int(value)
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    return int(digits) if digits else 0


def _checkout_payload(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "planCode": row.get("plan_code"),
        "amount": row.get("amount"),
        "currency": row.get("currency"),
        "status": row.get("status"),
        "note": row.get("note") or "",
        "adminNote": row.get("admin_note") or "",
        "confirmedAt": row.get("confirmed_at"),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def _apply_payment_tier_update(db, user_id: str, tier: str, reason: str, provider_event_id: str) -> dict:
    target_rows = db.table("users").select("*").eq("id", user_id).limit(1).execute().data or []
    if not target_rows:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Webhook thiếu user hợp lệ.")
    target = target_rows[0]
    old_tier = target.get("tier") or "free"
    updated = db.table("users").update({"tier": tier, "usage_limit": tier_limit(tier)}).eq("id", user_id).execute().data
    db.table("billing_tier_audit").insert(
        {
            "actor_user_id": None,
            "target_user_id": user_id,
            "actor_email_snapshot": "payment_webhook",
            "target_user_email_snapshot": target.get("email") or "",
            "old_tier": old_tier,
            "new_tier": tier,
            "reason": reason[:255],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()
    db.table("operation_logs").insert(
        {
            "user_id": user_id,
            "type": "billing",
            "action": f"payment_webhook_tier_update: {provider_event_id} {old_tier}->{tier}",
        }
    ).execute()
    return updated[0] if updated else {**target, "tier": tier, "usage_limit": tier_limit(tier)}


@router.get("/pricing")
async def pricing(db = Depends(get_db)):
    return {**_pricing_from_settings(db), "entitlements": ENTITLEMENTS}


@router.get("/entitlements")
async def entitlements():
    return {"success": True, "entitlements": ENTITLEMENTS}


@router.get("/me")
async def billing_me(current_user: dict = Depends(get_current_user)):
    return {"success": True, "user": user_to_response(current_user), "tier": current_user.get("tier") or "free"}


@router.get("/tier")
async def current_tier(current_user: dict = Depends(get_current_user)):
    return {
        "success": True,
        "tier": current_user.get("tier") or "free",
        "usageCount": current_user.get("usage_count", 0),
        "usageLimit": current_user.get("usage_limit") or tier_limit(current_user.get("tier") or "free"),
        "entitlement": tier_entitlement(current_user.get("tier")),
    }


@router.get("/coupons/{code}/validate")
async def validate_coupon(code: str, _: dict = Depends(get_current_user), db = Depends(get_db)):
    coupon_code = code.strip().upper()
    response = db.table("coupons").select("*").eq("code", coupon_code).limit(1).execute()
    if not response.data:
        return {"valid": False}
    row = response.data[0]
    return {"valid": True, "code": row.get("code"), "percent": row.get("percent")}


def _checkout_response(payload: dict, current_user: dict, db) -> dict:
    enforce_user_rate_limit(current_user["id"], "billing:checkout", 10, 600)
    forbidden = sorted(CHECKOUT_FORBIDDEN_FIELDS.intersection(payload.keys()))
    if forbidden:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payload chứa field nhạy cảm không được phép cập nhật: {', '.join(forbidden)}.",
        )
    tier = validate_tier(payload.get("tier"))
    if tier == "free":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Gói free không cần thanh toán.")

    billing_cycle = (payload.get("billingCycle") or "monthly").strip().lower()
    if billing_cycle not in {"monthly", "annual"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Chu kỳ thanh toán không hợp lệ.")

    pricing_config = _pricing_from_settings(db)
    configured_price = (pricing_config.get(billing_cycle) or {}).get(tier)
    amount = _price_to_amount(configured_price)
    note = str(payload.get("note") or payload.get("couponCode") or "")[:500]
    response = db.table("checkout_requests").insert(
        {
            "user_id": current_user.get("id"),
            "plan_code": tier,
            "amount": amount,
            "currency": "VND",
            "status": "pending",
            "note": note,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()
    checkout = response.data[0] if response.data else {}
    db.table("operation_logs").insert(
        {
            "user_id": current_user.get("id"),
            "type": "billing",
            "action": f"manual_checkout_pending: {tier}/{billing_cycle}",
        }
    ).execute()
    increment_business_metric(db, "billing_checkout_count", 1, {"tier": tier, "cycle": billing_cycle})
    return {
        "success": True,
        "status": "pending",
        "message": "Yêu cầu thanh toán đã được tạo. Vui lòng chuyển khoản/liên hệ admin để xác nhận. Gói tài khoản chưa được cập nhật cho đến khi admin xác nhận.",
        "checkoutUrl": None,
        "checkoutRequest": _checkout_payload(checkout),
        "plan": {"tier": tier, "billingCycle": billing_cycle, "price": configured_price, "amount": amount},
        "currentTier": current_user.get("tier") or "free",
    }


@router.post("/checkout")
async def create_checkout(_: Request, payload: dict, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    return _checkout_response(payload, current_user, db)


@router.post("/upgrade-request")
async def create_upgrade_request(payload: dict, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    return _checkout_response(payload, current_user, db)


@router.get("/checkout-requests")
async def my_checkout_requests(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    rows = db.table("checkout_requests").select("*").eq("user_id", current_user["id"]).order("created_at", desc=True).limit(20).execute().data or []
    return {"success": True, "checkoutRequests": [_checkout_payload(row) for row in rows]}


@router.post("/webhook/{provider}")
async def payment_webhook(provider: str, request: Request, x_excelai_signature: str | None = Header(default=None), db = Depends(get_db)):
    raw_body = await request.body()
    body_hash = hashlib.sha256(raw_body).hexdigest()
    configured_provider = (settings.payment_provider or "none").lower()
    if settings.payment_mode != "provider" or configured_provider in {"", "none", "manual"}:
        db.table("payment_transactions").insert(
            {
                "provider": provider[:40],
                "provider_transaction_id": "",
                "status": "rejected_not_configured",
                "raw_webhook_payload_hash": body_hash,
            }
        ).execute()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Payment provider webhook chưa được cấu hình. Không tự động cập nhật tier.")
    if provider.lower() != configured_provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment provider không hợp lệ.")
    provider_impl = provider_for(provider)
    if not provider_impl.verify_webhook_signature(raw_body, x_excelai_signature):
        db.table("payment_transactions").insert(
            {
                "provider": provider[:40],
                "provider_transaction_id": "",
                "status": "rejected_bad_signature",
                "raw_webhook_payload_hash": body_hash,
            }
        ).execute()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Webhook signature không hợp lệ.")
    event = provider_impl.parse_webhook_event(raw_body)
    if not event.provider_event_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook thiếu provider_event_id.")
    existing = db.table("payment_webhook_events").select("*").eq("provider", provider).eq("provider_event_id", event.provider_event_id).limit(1).execute().data or []
    if existing:
        return {"success": True, "status": existing[0].get("status"), "idempotent": True}
    payment_status = provider_impl.get_payment_status(event)
    webhook_row = {
        "provider": provider[:40],
        "provider_event_id": event.provider_event_id[:180],
        "event_type": event.event_type[:80],
        "status": payment_status,
        "user_id": event.user_id or None,
        "workspace_id": event.workspace_id,
        "mapped_tier": event.tier,
        "raw_payload_hash": body_hash,
    }
    if payment_status != "success":
        db.table("payment_webhook_events").insert(webhook_row).execute()
        db.table("payment_transactions").insert(
            {
                "provider": provider[:40],
                "provider_transaction_id": event.provider_event_id[:180],
                "user_id": event.user_id or None,
                "status": payment_status,
                "raw_webhook_payload_hash": body_hash,
                "verified_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()
        return {"success": True, "status": payment_status, "message": "Webhook đã xác thực nhưng không đủ điều kiện nâng tier."}
    if not event.user_id or not event.tier:
        webhook_row["status"] = "pending_review"
        webhook_row["error_message"] = "missing_user_or_price_mapping"
        db.table("payment_webhook_events").insert(webhook_row).execute()
        return {"success": True, "status": "pending_review", "message": "Webhook thiếu metadata hoặc price mapping, không nâng tier."}
    updated_user = _apply_payment_tier_update(db, event.user_id, event.tier, f"payment_webhook:{provider}:{event.provider_event_id}", event.provider_event_id)
    webhook_row["status"] = "processed"
    webhook_row["processed_at"] = datetime.now(timezone.utc).isoformat()
    db.table("payment_webhook_events").insert(webhook_row).execute()
    db.table("payment_transactions").insert(
        {
            "provider": provider[:40],
            "provider_transaction_id": event.provider_event_id[:180],
            "user_id": event.user_id,
            "status": "success",
            "raw_webhook_payload_hash": body_hash,
            "verified_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()
    return {
        "success": True,
        "status": "processed",
        "user": user_to_response(updated_user),
    }


@router.put("/tier")
async def update_own_tier_disabled(_: dict = Depends(get_current_user)):
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="User không được tự cập nhật gói tài khoản. Hãy dùng checkout hoặc liên hệ admin.",
    )
