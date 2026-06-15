import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from auth_policy import SENSITIVE_USER_FIELDS
from config import settings
from dependencies import get_current_user, get_db, tier_limit, user_to_response, validate_tier
from entitlements import ENTITLEMENTS, tier_entitlement
from metrics import increment_business_metric
from rate_limit import enforce_user_rate_limit
from services.payment_provider import configured_providers, provider_for


router = APIRouter(prefix="/api/billing", tags=["billing"])
DEFAULT_PRICING_CONFIG = {
    "monthly": {"pro": "149,000đ", "business": "299,000đ", "enterprise": "399,000đ", "period": "/tháng"},
    "annual": {"pro": "119,000đ", "business": "239,000đ", "enterprise": "319,000đ", "period": "/tháng (trả năm)"},
}
CHECKOUT_FORBIDDEN_FIELDS = SENSITIVE_USER_FIELDS - {"tier"}
PLAN_DEFINITIONS = {
    "free": {
        "id": "free",
        "name": "Free",
        "monthlyPrice": 0,
        "yearlyPrice": 0,
        "currency": "VND",
        "features": ["20 AI requests / ngày", "Tối đa 3 file", "Tối đa 5MB / file"],
        "limits": {"aiCredits": 20, "filesPerMonth": 3, "maxFileSizeMb": 5, "storageGb": 1},
    },
    "pro": {
        "id": "pro",
        "name": "Pro",
        "monthlyPrice": 199000,
        "yearlyPrice": 1990000,
        "currency": "VND",
        "features": ["2.000 AI credits / tháng", "100 file / tháng", "Tối đa 50MB / file", "Mở khóa AI Table Builder, AI Document, Autopilot"],
        "limits": {"aiCredits": 2000, "filesPerMonth": 100, "maxFileSizeMb": 50, "storageGb": 100},
    },
    "business": {
        "id": "business",
        "name": "Business",
        "monthlyPrice": 299000,
        "yearlyPrice": 239000 * 12,
        "currency": "VND",
        "features": ["20.000 AI credits / tháng", "250 file / tháng", "Tối đa 100MB / file", "Workspace đội nhóm và xuất PDF"],
        "limits": {"aiCredits": 20000, "filesPerMonth": 250, "maxFileSizeMb": 100, "storageGb": 500},
    },
    "enterprise": {
        "id": "enterprise",
        "name": "Enterprise",
        "priceType": "contact",
        "currency": "VND",
        "features": ["Quota tùy chỉnh", "Workspace nhiều thành viên", "Hỗ trợ ưu tiên", "SLA và triển khai riêng"],
        "limits": {"aiCredits": 999999, "filesPerMonth": 99999, "maxFileSizeMb": 200, "storageGb": 1000},
    },
}


def _plan_with_settings(db, plan_id: str) -> dict:
    plan = dict(PLAN_DEFINITIONS[plan_id])
    try:
        rows = db.table("plans").select("*").eq("id", plan_id).limit(1).execute().data or []
    except Exception:
        rows = []
    if rows:
        row = rows[0]
        features = row.get("features_json")
        limits = row.get("limits_json")
        if isinstance(features, str):
            try:
                features = json.loads(features)
            except json.JSONDecodeError:
                features = []
        if isinstance(limits, str):
            try:
                limits = json.loads(limits)
            except json.JSONDecodeError:
                limits = {}
        monthly_price = int(row.get("monthly_price") or row.get("amount") or plan.get("monthlyPrice") or 0)
        yearly_price = int(row.get("yearly_price") or plan.get("yearlyPrice") or 0)
        if plan_id == "pro" and yearly_price < monthly_price * 6:
            yearly_price = int(plan.get("yearlyPrice") or monthly_price * 12)
        plan.update(
            {
                "name": row.get("name") or plan.get("name"),
                "monthlyPrice": monthly_price,
                "yearlyPrice": yearly_price,
                "currency": row.get("currency") or plan.get("currency"),
                "features": features if isinstance(features, list) else plan.get("features", []),
                "limits": limits if isinstance(limits, dict) else plan.get("limits", {}),
            }
        )
    pricing_config = _pricing_from_settings(db) if not rows else {}
    if not rows and plan_id in {"pro", "business", "enterprise"} and plan.get("priceType") != "contact":
        plan["monthlyPrice"] = _price_to_amount((pricing_config.get("monthly") or {}).get(plan_id)) or plan.get("monthlyPrice", 0)
        annual_price = _price_to_amount((pricing_config.get("annual") or {}).get(plan_id)) or plan.get("yearlyPrice", 0)
        if annual_price and annual_price < int(plan.get("monthlyPrice") or 0) * 6:
            annual_price *= 12
        plan["yearlyPrice"] = annual_price
    return plan


def _period_end(cycle: str) -> datetime:
    return datetime.now(timezone.utc) + (timedelta(days=365) if cycle == "yearly" else timedelta(days=30))


def _storage_used_gb(db, user_id: str) -> float:
    rows = db.fetch("SELECT COALESCE(SUM(size_bytes), 0) AS total_bytes FROM files WHERE user_id = %s", [user_id])
    total_bytes = int((rows[0] if rows else {}).get("total_bytes") or 0)
    return round(total_bytes / 1024 / 1024 / 1024, 4)


def _apply_paid_subscription(db, order: dict) -> dict:
    plan_id = validate_tier(order["plan_id"])
    cycle = order.get("billing_cycle") or "monthly"
    now = datetime.now(timezone.utc)
    end = _period_end("yearly" if cycle in {"yearly", "annual"} else "monthly")
    updated_user = db.table("users").update({"tier": plan_id, "usage_limit": tier_limit(plan_id)}).eq("id", order["user_id"]).execute().data
    subscription_rows = db.fetch(
        """
        INSERT INTO subscriptions (user_id, plan_id, status, billing_cycle, provider, provider_subscription_id, current_period_start, current_period_end, updated_at)
        VALUES (%s, %s, 'active', %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        [
            order["user_id"],
            plan_id,
            cycle,
            order.get("provider") or "",
            order.get("provider_order_id") or "",
            now.isoformat(),
            end.isoformat(),
            now.isoformat(),
        ],
        commit=True,
    )
    limits = _plan_with_settings(db, plan_id).get("limits") or {}
    db.fetch(
        """
        INSERT INTO usage_quotas (user_id, plan_id, ai_credits_limit, files_limit, storage_limit_bytes, period_start, period_end, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        [
            order["user_id"],
            plan_id,
            int(limits.get("aiCredits") or 0),
            int(limits.get("filesPerMonth") or 0),
            int(float(limits.get("storageGb") or 0) * 1024 * 1024 * 1024),
            now.isoformat(),
            end.isoformat(),
            now.isoformat(),
        ],
        commit=True,
    )
    db.table("operation_logs").insert({"user_id": order["user_id"], "type": "billing", "action": f"subscription_paid: {order['id']} -> {plan_id}"}).execute()
    return updated_user[0] if updated_user else {"id": order["user_id"], "tier": plan_id}


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


def _update_webhook_event(db, event_id: str, updates: dict) -> None:
    if event_id:
        db.table("payment_webhook_events").update(updates).eq("id", event_id).execute()


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


@router.get("/plans")
async def billing_plans(db = Depends(get_db)):
    plans = [_plan_with_settings(db, plan_id) for plan_id in ("free", "pro", "business", "enterprise")]
    return {"plans": plans, "providers": configured_providers(), "paymentConfigured": bool(configured_providers())}


@router.get("/account")
async def billing_account(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    tier = current_user.get("tier") or "free"
    plan = _plan_with_settings(db, tier if tier in PLAN_DEFINITIONS else "free")
    limits = plan.get("limits") or {}
    files_used = len(db.table("files").select("id").eq("user_id", current_user["id"]).execute().data or [])
    latest_sub = db.fetch(
        "SELECT * FROM subscriptions WHERE user_id = %s ORDER BY created_at DESC LIMIT 1",
        [current_user["id"]],
    )
    return {
        "userId": current_user["id"],
        "currentPlan": tier,
        "subscriptionStatus": (latest_sub[0] if latest_sub else {}).get("status") or "active",
        "billingCycle": "monthly",
        "currentPeriodEnd": (latest_sub[0] if latest_sub else {}).get("current_period_end"),
        "usage": {
            "aiCreditsUsed": current_user.get("usage_count") or 0,
            "aiCreditsLimit": limits.get("aiCredits") or tier_limit(tier),
            "filesUsed": files_used,
            "filesLimit": limits.get("filesPerMonth") or 0,
            "storageUsedGb": _storage_used_gb(db, current_user["id"]),
            "storageLimitGb": limits.get("storageGb") or 0,
        },
    }


@router.get("/entitlements")
async def entitlements():
    return {"success": True, "entitlements": ENTITLEMENTS}


@router.get("/me")
async def billing_me(current_user: dict = Depends(get_current_user)):
    tier = current_user.get("tier") or "free"
    return {
        "success": True,
        "user": user_to_response(current_user),
        "tier": tier,
        "usageCount": current_user.get("usage_count") or 0,
        "usageLimit": current_user.get("usage_limit") or tier_limit(tier),
        "entitlement": tier_entitlement(tier),
    }


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


async def _checkout_response(payload: dict, current_user: dict, db) -> dict:
    enforce_user_rate_limit(current_user["id"], "billing:checkout", 10, 600)
    forbidden = sorted(CHECKOUT_FORBIDDEN_FIELDS.intersection(payload.keys()))
    if forbidden:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payload chứa field nhạy cảm không được phép cập nhật: {', '.join(forbidden)}.",
        )
    requested_tier = payload.get("planId") or payload.get("tier") or payload.get("plan") or payload.get("planCode")
    tier = validate_tier(requested_tier)
    if tier == "free":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Gói free không cần thanh toán.")
    if tier == "enterprise":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Gói Enterprise cần tạo lead Sales hoặc cấu hình checkout riêng.")

    billing_cycle = (payload.get("billingCycle") or "monthly").strip().lower()
    if billing_cycle == "annual":
        billing_cycle = "yearly"
    if billing_cycle not in {"monthly", "yearly"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Chu kỳ thanh toán không hợp lệ.")

    provider_name = (payload.get("provider") or settings.payment_provider or "").strip().lower()
    if provider_name in {"", "none", "manual"}:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Cổng thanh toán chưa được cấu hình.")
    provider_impl = provider_for(provider_name)
    provider_impl.require_configured()
    plan = _plan_with_settings(db, tier)
    amount = int(plan["yearlyPrice"] if billing_cycle == "yearly" else plan["monthlyPrice"])
    if amount <= 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Giá gói chưa được cấu hình.")
    now = datetime.now(timezone.utc)
    order_id = str(uuid4())
    order_code = f"{int(now.timestamp() * 1000)}{secrets.randbelow(1_000_000):06d}"[-18:]
    order = {
        "id": order_id,
        "user_id": current_user["id"],
        "plan_id": tier,
        "billing_cycle": billing_cycle,
        "provider": provider_name,
        "amount": amount,
        "currency": "VND",
        "status": "pending",
        "order_code": order_code,
        "expires_at": (now + timedelta(minutes=30)).isoformat(),
        "buyer_name": current_user.get("name") or "",
        "buyer_email": current_user.get("email") or "",
    }
    checkout_result = await provider_impl.create_checkout_session(order)
    db.fetch(
        """
        INSERT INTO billing_orders (id, user_id, plan_id, billing_cycle, provider, amount, currency, status, order_code, provider_order_id, checkout_url, qr_code, expires_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending', %s, %s, %s, %s, %s, %s)
        """,
        [
            order_id,
            current_user["id"],
            tier,
            billing_cycle,
            provider_name,
            amount,
            "VND",
            order_code,
            checkout_result.get("providerOrderId") or "",
            checkout_result.get("checkoutUrl") or "",
            checkout_result.get("qrCode") or "",
            order["expires_at"],
            now.isoformat(),
        ],
        commit=True,
    )
    db.table("operation_logs").insert({"user_id": current_user.get("id"), "type": "billing", "action": f"checkout_pending: {provider_name}/{tier}/{billing_cycle}"}).execute()
    increment_business_metric(db, "billing_checkout_count", 1, {"tier": tier, "cycle": billing_cycle})
    return {
        "orderId": order_id,
        "provider": provider_name,
        "status": "pending",
        "amount": amount,
        "currency": "VND",
        "checkoutUrl": checkout_result.get("checkoutUrl"),
        "qrCode": checkout_result.get("qrCode"),
        "expiresAt": order["expires_at"],
    }


@router.post("/checkout")
async def create_checkout(_: Request, payload: dict, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    return await _checkout_response(payload, current_user, db)


@router.post("/upgrade-request")
async def create_upgrade_request(payload: dict, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    return await _checkout_response(payload, current_user, db)


@router.get("/checkout-requests")
async def my_checkout_requests(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    rows = db.table("checkout_requests").select("*").eq("user_id", current_user["id"]).order("created_at", desc=True).limit(20).execute().data or []
    return {"success": True, "checkoutRequests": [_checkout_payload(row) for row in rows]}


@router.get("/orders/{order_id}/status")
async def order_status(order_id: str, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    rows = db.table("billing_orders").select("*").eq("id", order_id).limit(1).execute().data or []
    if not rows or rows[0].get("user_id") != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy order.")
    row = rows[0]
    return {
        "orderId": row.get("id"),
        "status": row.get("status"),
        "planId": row.get("plan_id"),
        "billingCycle": row.get("billing_cycle"),
        "paidAt": row.get("paid_at"),
        "amount": row.get("amount"),
        "currency": row.get("currency"),
        "provider": row.get("provider"),
    }


@router.get("/history")
async def billing_history(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    rows = db.fetch(
        """
        SELECT id, plan_id, amount, currency, provider, status, paid_at, created_at
        FROM billing_orders
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT 50
        """,
        [current_user["id"]],
    )
    return {"items": [{"orderId": row["id"], "planName": row["plan_id"], "invoiceUrl": f"/api/billing/orders/{row['id']}/invoice", **row} for row in rows]}


@router.post("/enterprise-leads")
async def enterprise_lead(payload: dict, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    name = str(payload.get("name") or current_user.get("name") or "").strip()
    email = str(payload.get("email") or current_user.get("email") or "").strip()
    if not name or not email:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Vui lòng nhập họ tên và email.")
    rows = db.fetch(
        """
        INSERT INTO enterprise_leads (user_id, name, email, phone, company, need)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        [current_user["id"], name[:180], email[:180], str(payload.get("phone") or "")[:60], str(payload.get("company") or "")[:180], str(payload.get("need") or "")[:2000]],
        commit=True,
    )
    return {"success": True, "lead": rows[0] if rows else {"name": name, "email": email}}


@router.post("/webhook/{provider}")
async def payment_webhook(provider: str, request: Request, x_excelai_signature: str | None = Header(default=None), db = Depends(get_db)):
    raw_body = await request.body()
    body_hash = hashlib.sha256(raw_body).hexdigest()
    configured_provider = (settings.payment_provider or "none").lower()
    provider_impl = provider_for(provider)
    if configured_provider in {"", "none", "manual"} or not provider_impl.is_configured():
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
    headers = {key.lower(): value for key, value in request.headers.items()}
    signature = x_excelai_signature or headers.get("stripe-signature") or headers.get("x-payos-signature")
    if not provider_impl.verify_webhook_signature(raw_body, signature, headers):
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
    payment_status = provider_impl.get_payment_status(event)
    webhook_row = {
        "provider": provider[:40],
        "provider_event_id": event.provider_event_id[:180],
        "event_type": event.event_type[:80],
        "status": payment_status,
        "raw_payload_hash": body_hash,
    }
    inserted_event = db.fetch(
        """
        INSERT INTO payment_webhook_events (provider, provider_event_id, event_type, status, raw_payload_hash)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (provider, provider_event_id) DO NOTHING
        RETURNING *
        """,
        [
            webhook_row["provider"],
            webhook_row["provider_event_id"],
            webhook_row["event_type"],
            webhook_row["status"],
            webhook_row["raw_payload_hash"],
        ],
        commit=True,
    )
    if not inserted_event:
        existing = db.table("payment_webhook_events").select("*").eq("provider", provider).eq("provider_event_id", event.provider_event_id).limit(1).execute().data or []
        return {"success": True, "status": (existing[0] if existing else {}).get("status") or "received", "idempotent": True}
    webhook_event_id = inserted_event[0]["id"]
    order_rows = []
    if event.order_id:
        order_rows = db.table("billing_orders").select("*").eq("id", event.order_id).limit(1).execute().data or []
    if not order_rows and event.order_code:
        order_rows = db.table("billing_orders").select("*").eq("order_code", event.order_code).limit(1).execute().data or []
    if not order_rows:
        webhook_row["status"] = "pending_review"
        webhook_row["error_message"] = "order_not_found"
        _update_webhook_event(db, webhook_event_id, webhook_row)
        return {"success": True, "status": "pending_review", "message": "Không tìm thấy order, không nâng tier."}
    order = order_rows[0]
    webhook_row["user_id"] = order.get("user_id")
    webhook_row["mapped_tier"] = order.get("plan_id")
    if event.amount and int(event.amount) != int(order.get("amount") or 0):
        webhook_row["status"] = "rejected_amount_mismatch"
        webhook_row["error_message"] = "amount_mismatch"
        _update_webhook_event(db, webhook_event_id, webhook_row)
        return {"success": True, "status": "rejected_amount_mismatch"}
    if event.currency and event.currency.upper() != str(order.get("currency") or "VND").upper():
        webhook_row["status"] = "rejected_currency_mismatch"
        webhook_row["error_message"] = "currency_mismatch"
        _update_webhook_event(db, webhook_event_id, webhook_row)
        return {"success": True, "status": "rejected_currency_mismatch"}
    if payment_status != "paid":
        _update_webhook_event(db, webhook_event_id, webhook_row)
        db.table("billing_orders").update({"status": "failed" if payment_status == "failed" else "pending", "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", order["id"]).execute()
        db.table("payment_transactions").insert(
            {
                "provider": provider[:40],
                "provider_transaction_id": event.provider_event_id[:180],
                "order_id": order.get("id"),
                "user_id": order.get("user_id"),
                "status": payment_status,
                "signature_valid": True,
                "raw_webhook_payload_hash": body_hash,
                "verified_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()
        return {"success": True, "status": payment_status, "message": "Webhook đã xác thực nhưng không đủ điều kiện nâng tier."}
    if order.get("status") == "paid":
        _update_webhook_event(db, webhook_event_id, {**webhook_row, "status": "processed", "processed_at": datetime.now(timezone.utc).isoformat()})
        return {"success": True, "status": "paid", "idempotent": True}
    now = datetime.now(timezone.utc).isoformat()
    db.table("billing_orders").update({"status": "paid", "paid_at": now, "updated_at": now}).eq("id", order["id"]).execute()
    updated_user = _apply_paid_subscription(db, {**order, "status": "paid", "paid_at": now})
    webhook_row["status"] = "processed"
    webhook_row["processed_at"] = datetime.now(timezone.utc).isoformat()
    _update_webhook_event(db, webhook_event_id, webhook_row)
    db.table("payment_transactions").insert(
        {
            "provider": provider[:40],
            "provider_transaction_id": event.provider_event_id[:180],
            "order_id": order.get("id"),
            "user_id": order.get("user_id"),
            "amount": order.get("amount") or 0,
            "currency": order.get("currency") or "VND",
            "status": "paid",
            "signature_valid": True,
            "raw_webhook_payload_hash": body_hash,
            "verified_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()
    return {
        "success": True,
        "status": "processed",
        "user": user_to_response(updated_user),
    }


@router.post("/webhooks/{provider}")
async def payment_webhook_alias(provider: str, request: Request, x_excelai_signature: str | None = Header(default=None), db = Depends(get_db)):
    return await payment_webhook(provider, request, x_excelai_signature, db)


@router.put("/tier")
async def update_own_tier_disabled(_: dict = Depends(get_current_user)):
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="User không được tự cập nhật gói tài khoản. Hãy dùng checkout hoặc liên hệ admin.",
    )
