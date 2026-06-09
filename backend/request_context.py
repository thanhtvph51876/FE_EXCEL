from __future__ import annotations

import time
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from metrics import persist_request_metrics, record_request


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid4())
        request.state.request_id = request_id
        started = time.perf_counter()
        response = await call_next(request)
        latency_ms = int((time.perf_counter() - started) * 1000)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time-ms"] = str(latency_ms)
        record_request(request.method, request.url.path, response.status_code, latency_ms)
        try:
            from dependencies import get_db

            user_id = getattr(request.state, "user_id", None)
            persist_request_metrics(get_db(), request_id, request.method, request.url.path, response.status_code, latency_ms, user_id)
        except Exception:
            pass
        print(
            f"request_id={request_id} method={request.method} path={request.url.path} "
            f"status={response.status_code} latency_ms={latency_ms}"
        )
        return response


def request_id_from(request: Request) -> str:
    return getattr(request.state, "request_id", "")
