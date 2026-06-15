from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, status

from config import settings


SUCCESS_EVENTS = {"payment_success", "checkout.session.completed", "invoice.paid", "subscription_active", "PAID", "paid", "succeeded"}
FAILURE_EVENTS = {"payment_failed", "payment_cancelled", "checkout.session.expired", "invoice.payment_failed", "CANCELLED", "failed", "cancelled"}


@dataclass(frozen=True)
class PaymentEvent:
    provider_event_id: str
    event_type: str
    status: str
    order_id: str
    order_code: str
    amount: int
    currency: str
    raw: dict


class PaymentProvider:
    name = "base"

    def is_configured(self) -> bool:
        return False

    def require_configured(self) -> None:
        if not self.is_configured():
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Cổng thanh toán chưa được cấu hình.")

    async def create_checkout_session(self, order: dict) -> dict:
        raise NotImplementedError

    def verify_webhook_signature(self, raw_body: bytes, signature: str | None, headers: dict[str, str] | None = None) -> bool:
        if not settings.payment_webhook_secret:
            return False
        expected = hmac.new(settings.payment_webhook_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        return bool(signature and hmac.compare_digest(expected, signature))

    def parse_webhook_event(self, raw_body: bytes) -> PaymentEvent:
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook payload không hợp lệ.") from exc
        data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
        order_id = str(data.get("orderId") or data.get("order_id") or data.get("metadata", {}).get("order_id") or "")
        order_code = str(data.get("orderCode") or data.get("order_code") or data.get("orderId") or "")
        event_id = str(payload.get("id") or payload.get("event_id") or data.get("id") or data.get("transactionId") or order_code)
        event_type = str(payload.get("type") or payload.get("event_type") or data.get("status") or "")
        return PaymentEvent(
            provider_event_id=event_id,
            event_type=event_type,
            status=str(data.get("status") or data.get("paymentStatus") or ""),
            order_id=order_id,
            order_code=order_code,
            amount=int(data.get("amount") or data.get("totalAmount") or 0),
            currency=str(data.get("currency") or "VND"),
            raw=payload,
        )

    def get_payment_status(self, event: PaymentEvent) -> str:
        value = f"{event.event_type} {event.status}".lower()
        if any(item.lower() in value for item in SUCCESS_EVENTS):
            return "paid"
        if any(item.lower() in value for item in FAILURE_EVENTS):
            return "failed"
        return "pending"


def _hmac_sha256(secret: str, message: str) -> str:
    return hmac.new(secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()


class PayosProvider(PaymentProvider):
    name = "payos"

    def is_configured(self) -> bool:
        return bool(settings.payos_client_id and settings.payos_api_key and settings.payos_checksum_key)

    async def create_checkout_session(self, order: dict) -> dict:
        self.require_configured()
        order_code = int(order["order_code"])
        return_url = f"{settings.app_base_url.rstrip('/')}/billing/success?orderId={order['id']}"
        cancel_url = f"{settings.app_base_url.rstrip('/')}/billing/cancel?orderId={order['id']}"
        payload = {
            "orderCode": order_code,
            "amount": int(order["amount"]),
            "description": f"ExcelAI {order['plan_id']}"[:25],
            "returnUrl": return_url,
            "cancelUrl": cancel_url,
            "buyerName": order.get("buyer_name") or "ExcelAI User",
            "buyerEmail": order.get("buyer_email") or "",
            "items": [{"name": f"ExcelAI {order['plan_id']}", "quantity": 1, "price": int(order["amount"])}],
        }
        sign_text = f"amount={payload['amount']}&cancelUrl={payload['cancelUrl']}&description={payload['description']}&orderCode={payload['orderCode']}&returnUrl={payload['returnUrl']}"
        payload["signature"] = _hmac_sha256(settings.payos_checksum_key, sign_text)
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                "https://api-merchant.payos.vn/v2/payment-requests",
                headers={"x-client-id": settings.payos_client_id, "x-api-key": settings.payos_api_key, "Content-Type": "application/json"},
                json=payload,
            )
        if res.status_code >= 400:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Không thể tạo checkout PayOS.")
        data = res.json().get("data") or res.json()
        return {"checkoutUrl": data.get("checkoutUrl"), "qrCode": data.get("qrCode"), "providerOrderId": str(data.get("paymentLinkId") or order_code)}

    def verify_webhook_signature(self, raw_body: bytes, signature: str | None, headers: dict[str, str] | None = None) -> bool:
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except Exception:
            return False
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        received = str(payload.get("signature") or data.get("signature") or "")
        if not received:
            return False
        sign_data = "&".join(f"{key}={data[key]}" for key in sorted(data.keys()) if key != "signature")
        return hmac.compare_digest(_hmac_sha256(settings.payos_checksum_key, sign_data), received)


class VnpayProvider(PaymentProvider):
    name = "vnpay"

    def is_configured(self) -> bool:
        return bool(settings.vnpay_tmn_code and settings.vnpay_hash_secret and settings.vnpay_payment_url and settings.vnpay_return_url)

    async def create_checkout_session(self, order: dict) -> dict:
        self.require_configured()
        params = {
            "vnp_Version": "2.1.0",
            "vnp_Command": "pay",
            "vnp_TmnCode": settings.vnpay_tmn_code,
            "vnp_Amount": int(order["amount"]) * 100,
            "vnp_CurrCode": "VND",
            "vnp_TxnRef": order["order_code"],
            "vnp_OrderInfo": f"ExcelAI order {order['id']}",
            "vnp_OrderType": "other",
            "vnp_Locale": "vn",
            "vnp_ReturnUrl": settings.vnpay_return_url,
            "vnp_IpAddr": "127.0.0.1",
            "vnp_CreateDate": time.strftime("%Y%m%d%H%M%S"),
        }
        query = urlencode(sorted(params.items()))
        secure_hash = _hmac_sha256(settings.vnpay_hash_secret, query)
        return {"checkoutUrl": f"{settings.vnpay_payment_url}?{query}&vnp_SecureHash={secure_hash}", "qrCode": None, "providerOrderId": order["order_code"]}

    def verify_webhook_signature(self, raw_body: bytes, signature: str | None, headers: dict[str, str] | None = None) -> bool:
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except Exception:
            return False
        received = str(payload.pop("vnp_SecureHash", "") or signature or "")
        payload.pop("vnp_SecureHashType", None)
        query = urlencode(sorted(payload.items()))
        return bool(received and hmac.compare_digest(_hmac_sha256(settings.vnpay_hash_secret, query), received))


class MomoProvider(PaymentProvider):
    name = "momo"

    def is_configured(self) -> bool:
        return bool(settings.momo_partner_code and settings.momo_access_key and settings.momo_secret_key and settings.momo_endpoint)

    async def create_checkout_session(self, order: dict) -> dict:
        self.require_configured()
        request_id = order["order_code"]
        redirect_url = settings.momo_redirect_url or f"{settings.app_base_url.rstrip('/')}/billing/success?orderId={order['id']}"
        ipn_url = settings.momo_ipn_url or f"{settings.webhook_base_url.rstrip('/')}/api/billing/webhooks/momo"
        raw = f"accessKey={settings.momo_access_key}&amount={order['amount']}&extraData=&ipnUrl={ipn_url}&orderId={order['order_code']}&orderInfo=ExcelAI {order['plan_id']}&partnerCode={settings.momo_partner_code}&redirectUrl={redirect_url}&requestId={request_id}&requestType=captureWallet"
        payload = {
            "partnerCode": settings.momo_partner_code,
            "accessKey": settings.momo_access_key,
            "requestId": request_id,
            "amount": str(order["amount"]),
            "orderId": order["order_code"],
            "orderInfo": f"ExcelAI {order['plan_id']}",
            "redirectUrl": redirect_url,
            "ipnUrl": ipn_url,
            "extraData": "",
            "requestType": "captureWallet",
            "signature": _hmac_sha256(settings.momo_secret_key, raw),
        }
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(settings.momo_endpoint, json=payload)
        if res.status_code >= 400:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Không thể tạo checkout MoMo.")
        data = res.json()
        return {"checkoutUrl": data.get("payUrl") or data.get("deeplink"), "qrCode": data.get("qrCodeUrl"), "providerOrderId": order["order_code"]}

    def verify_webhook_signature(self, raw_body: bytes, signature: str | None, headers: dict[str, str] | None = None) -> bool:
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except Exception:
            return False
        received = str(payload.get("signature") or signature or "")
        raw_keys = ["accessKey", "amount", "extraData", "message", "orderId", "orderInfo", "orderType", "partnerCode", "payType", "requestId", "responseTime", "resultCode", "transId"]
        raw = "&".join(f"{key}={payload[key]}" for key in raw_keys if key in payload)
        return bool(received and hmac.compare_digest(_hmac_sha256(settings.momo_secret_key, raw), received))


class StripeProvider(PaymentProvider):
    name = "stripe"

    def is_configured(self) -> bool:
        return bool(settings.stripe_secret_key and settings.stripe_success_url and settings.stripe_cancel_url)

    async def create_checkout_session(self, order: dict) -> dict:
        self.require_configured()
        data = {
            "mode": "payment",
            "success_url": f"{settings.stripe_success_url}?orderId={order['id']}",
            "cancel_url": f"{settings.stripe_cancel_url}?orderId={order['id']}",
            "client_reference_id": order["id"],
            "metadata[order_id]": order["id"],
            "metadata[order_code]": order["order_code"],
            "line_items[0][quantity]": "1",
            "line_items[0][price_data][currency]": order["currency"].lower(),
            "line_items[0][price_data][unit_amount]": str(int(order["amount"])),
            "line_items[0][price_data][product_data][name]": f"ExcelAI {order['plan_id']}",
        }
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post("https://api.stripe.com/v1/checkout/sessions", headers={"Authorization": f"Bearer {settings.stripe_secret_key}"}, data=data)
        if res.status_code >= 400:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Không thể tạo Stripe Checkout.")
        payload = res.json()
        return {"checkoutUrl": payload.get("url"), "qrCode": None, "providerOrderId": payload.get("id")}

    def verify_webhook_signature(self, raw_body: bytes, signature: str | None, headers: dict[str, str] | None = None) -> bool:
        sig_header = signature or (headers or {}).get("stripe-signature") or ""
        if not settings.stripe_webhook_secret or not sig_header:
            return False
        parts = dict(part.split("=", 1) for part in sig_header.split(",") if "=" in part)
        timestamp = parts.get("t")
        signed = f"{timestamp}.{raw_body.decode('utf-8')}"
        expected = _hmac_sha256(settings.stripe_webhook_secret, signed)
        return bool(parts.get("v1") and hmac.compare_digest(expected, parts["v1"]))


def provider_for(name: str) -> PaymentProvider:
    providers = {"payos": PayosProvider, "vnpay": VnpayProvider, "momo": MomoProvider, "stripe": StripeProvider}
    key = (name or "").strip().lower()
    if key not in providers:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment provider không hợp lệ.")
    return providers[key]()


def configured_providers() -> list[str]:
    return [name for name in ("payos", "vnpay", "momo", "stripe") if provider_for(name).is_configured()]
