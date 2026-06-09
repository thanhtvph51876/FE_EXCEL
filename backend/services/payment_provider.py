from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException, status

from config import settings
from dependencies import validate_tier


SUCCESS_EVENTS = {"payment_success", "checkout.session.completed", "invoice.paid", "subscription_active"}
FAILURE_EVENTS = {"payment_failed", "payment_cancelled", "checkout.session.expired", "invoice.payment_failed"}


@dataclass(frozen=True)
class PaymentEvent:
    provider_event_id: str
    event_type: str
    status: str
    user_id: str
    workspace_id: str | None
    price_id: str
    tier: str | None
    raw: dict


class PaymentProvider:
    def create_checkout_session(self, *_args, **_kwargs) -> dict:
        raise NotImplementedError

    def verify_webhook_signature(self, raw_body: bytes, signature: str | None) -> bool:
        if not settings.payment_webhook_secret:
            return False
        expected = hmac.new(settings.payment_webhook_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        return bool(signature and hmac.compare_digest(expected, signature))

    def parse_webhook_event(self, raw_body: bytes) -> PaymentEvent:
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook payload không hợp lệ.") from exc
        event_id = str(payload.get("id") or payload.get("event_id") or payload.get("provider_event_id") or "")
        event_type = str(payload.get("type") or payload.get("event_type") or "")
        data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
        metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
        user_id = str(metadata.get("user_id") or data.get("user_id") or "")
        workspace_id = str(metadata.get("workspace_id") or data.get("workspace_id") or "") or None
        price_id = str(data.get("price_id") or data.get("priceId") or data.get("product_id") or metadata.get("price_id") or "")
        tier = tier_from_price_id(price_id)
        return PaymentEvent(
            provider_event_id=event_id,
            event_type=event_type,
            status=str(data.get("status") or ""),
            user_id=user_id,
            workspace_id=workspace_id,
            price_id=price_id,
            tier=tier,
            raw=payload,
        )

    def get_payment_status(self, event: PaymentEvent) -> str:
        if event.event_type in SUCCESS_EVENTS or event.status in {"paid", "succeeded", "active"}:
            return "success"
        if event.event_type in FAILURE_EVENTS or event.status in {"failed", "cancelled", "expired"}:
            return "failed"
        return "pending_review"


def tier_from_price_id(price_id: str) -> str | None:
    try:
        mapping = json.loads(settings.payment_price_tier_map or "{}")
    except json.JSONDecodeError:
        mapping = {}
    tier = mapping.get(price_id)
    if not tier:
        return None
    return validate_tier(str(tier))


def provider_for(name: str) -> PaymentProvider:
    if not name:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment provider không hợp lệ.")
    return PaymentProvider()
