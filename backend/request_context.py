from __future__ import annotations

import time
from uuid import uuid4

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from metrics import persist_request_metrics, record_request


def _representative_exception(exc: BaseException) -> BaseException:
    if isinstance(exc, BaseExceptionGroup):
        for inner in exc.exceptions:
            return _representative_exception(inner)
    return exc


def _json_error_response(request_id: str, status_code: int, detail, error_code: str = "INTERNAL_SERVER_ERROR") -> JSONResponse:
    if isinstance(detail, dict):
        content = {"success": False, **detail}
    else:
        content = {"success": False, "errorCode": error_code, "message": str(detail)}
    content.setdefault("request_id", request_id)
    return JSONResponse(
        status_code=status_code,
        content=content,
        headers={"X-Request-ID": request_id},
    )


def _internal_error_response(request_id: str) -> JSONResponse:
    return _json_error_response(request_id, 500, "Internal server error")


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid4())
        request.state.request_id = request_id
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except BaseExceptionGroup as exc:
            latency_ms = int((time.perf_counter() - started) * 1000)
            representative = _representative_exception(exc)
            status_code = representative.status_code if isinstance(representative, HTTPException) else 500
            record_request(request.method, request.url.path, status_code, latency_ms)
            print(
                f"request_id={request_id} method={request.method} path={request.url.path} "
                f"status={status_code} latency_ms={latency_ms} unhandled_exc={type(representative).__name__} "
                f"exception_group={type(exc).__name__}"
            )
            if isinstance(representative, HTTPException):
                return _json_error_response(request_id, representative.status_code, representative.detail, "HTTP_EXCEPTION")
            return _internal_error_response(request_id)
        except Exception as exc:
            latency_ms = int((time.perf_counter() - started) * 1000)
            status_code = exc.status_code if isinstance(exc, HTTPException) else 500
            record_request(request.method, request.url.path, status_code, latency_ms)
            print(
                f"request_id={request_id} method={request.method} path={request.url.path} "
                f"status={status_code} latency_ms={latency_ms} unhandled_exc={type(exc).__name__}"
            )
            if isinstance(exc, HTTPException):
                return _json_error_response(request_id, exc.status_code, exc.detail, "HTTP_EXCEPTION")
            return _internal_error_response(request_id)
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
