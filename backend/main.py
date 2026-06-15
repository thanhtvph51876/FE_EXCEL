import asyncio
import sys

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from config import settings
from dependencies import get_db, require_admin
from metrics import prometheus_text
from rate_limit import SLOWAPI_AVAILABLE, RateLimitExceeded, _rate_limit_exceeded_handler, limiter
from request_context import RequestContextMiddleware, request_id_from
from routers import admin, ai, ai_document, ai_table_builder, auth, autopilot, billing, broadcasts, chat, data_cleaning, exports, files, history, jobs, office, reports, settings as user_settings, templates, workspaces
from services.gemini_service import ai_provider_health
from services.quota_service import reset_daily_quota
from services.storage_service import StorageService


if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


_IS_PROD = settings.environment.lower() == "production"

app = FastAPI(
    title="ExcelAI & Office Autopilot API",
    version="1.0.0",
    description="Backend API cho ExcelAI - tự động hóa Excel bằng AI",
    docs_url=None if _IS_PROD else "/docs",
    redoc_url=None if _IS_PROD else "/redoc",
    openapi_url=None if _IS_PROD else "/openapi.json",
)

app.add_middleware(RequestContextMiddleware)

if SLOWAPI_AVAILABLE:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    _extra_connect = "" if _IS_PROD else " http://127.0.0.1:8002 http://localhost:8002"
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; "
        "script-src 'self' https://cdn.jsdelivr.net https://appsforoffice.microsoft.com https://accounts.google.com; "
        "script-src-attr 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: blob:; "
        f"connect-src 'self'{_extra_connect} https://generativelanguage.googleapis.com; "
        "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    )
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict):
        payload = {"success": False, **detail}
    else:
        payload = {"success": False, "message": str(detail)}
    payload.setdefault("request_id", request_id_from(request))
    return JSONResponse(status_code=exc.status_code, content=payload)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"success": False, "errorCode": "VALIDATION_ERROR", "message": "Payload không hợp lệ.", "details": exc.errors(), "request_id": request_id_from(request)},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = request_id_from(request)
    print(
        f"request_id={request_id} method={request.method} path={request.url.path} "
        f"status=500 unhandled_exc={type(exc).__name__}"
    )
    text = str(exc)
    lowered = text.lower()
    if "connection refused" in lowered or "could not connect" in lowered:
        return JSONResponse(
            status_code=503,
            content={"success": False, "errorCode": "DATABASE_CONNECTION_FAILED", "message": "Không thể kết nối database.", "request_id": request_id},
        )
    if "relation" in lowered and "does not exist" in lowered:
        return JSONResponse(
            status_code=503,
            content={"success": False, "errorCode": "DATABASE_SCHEMA_NOT_READY", "message": "Database schema chưa sẵn sàng.", "request_id": request_id},
        )
    if "pool exhausted" in lowered or "connection pool" in lowered:
        return JSONResponse(
            status_code=503,
            content={"success": False, "errorCode": "DATABASE_POOL_EXHAUSTED", "message": "Server đang tải cao, thử lại sau.", "request_id": request_id},
        )
    return JSONResponse(
        status_code=500,
        content={"success": False, "errorCode": "INTERNAL_SERVER_ERROR", "message": "Internal server error", "request_id": request_id},
    )


@app.get("/api/health")
async def health_check():
    return {"success": True, "status": "ok", "version": "api-map-20260605-2"}


@app.get("/api/health/internal")
async def internal_health_check(_: dict = Depends(require_admin)):
    gemini_ok = bool(settings.gemini_api_key and settings.gemini_api_key.startswith("AIzaSy"))
    database_status = "Missing database config"
    if settings.database_url:
        try:
            get_db().fetch("SELECT 1")
            database_status = "OK"
        except Exception as exc:
            database_status = f"FAILED: {str(exc).splitlines()[0]}"
    return {
        "success": True,
        "status": "ok",
        "version": "api-map-20260605-2",
        "checks": {
            "database": database_status,
            "gemini": "OK" if gemini_ok else "GEMINI_API_KEY must start with AIzaSy",
            "rateLimit": "OK" if SLOWAPI_AVAILABLE else "Optional dependency slowapi not installed",
        },
        "databaseProvider": settings.database_provider,
        "storageBucket": settings.storage_bucket,
        "environment": settings.environment,
    }


@app.get("/api/health/db")
async def db_health_check():
    try:
        get_db().fetch("SELECT 1")
        return {"success": True, "status": "ok", "dependency": "postgres"}
    except Exception:
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content={"success": False, "status": "degraded", "dependency": "postgres"})


@app.get("/api/health/ai")
async def ai_health_check():
    provider = await ai_provider_health()
    return {"success": True, **provider}


@app.get("/api/health/storage")
async def storage_health_check():
    try:
        return {"success": True, **StorageService(get_db()).health()}
    except Exception:
        return {"success": True, "status": "degraded", "backend": settings.storage_backend, "bucket": settings.storage_bucket}


@app.get("/api/health/payment")
async def payment_health_check():
    return {"success": True, "status": "ok", "mode": settings.payment_mode, "provider": settings.payment_provider}


@app.get("/api/health/queue")
async def queue_health_check():
    return {"success": True, "status": "ok", "backend": "postgres_inline", "worker": "api_process"}


@app.get("/api/health/full")
async def full_health_check(_: dict = Depends(require_admin)):
    return {
        "success": True,
        "status": "ok",
        "environment": settings.environment,
        "version": "api-map-20260605-2",
        "db": {"success": True, "status": "ok", "dependency": "postgres"},
        "ai": (await ai_health_check()),
        "storage": (await storage_health_check()),
        "payment": (await payment_health_check()),
        "queue": (await queue_health_check()),
    }


@app.get("/metrics", response_class=PlainTextResponse)
async def metrics_text():
    return prometheus_text()


app.include_router(auth.router)
app.include_router(files.router)
app.include_router(exports.router)
app.include_router(jobs.router)
app.include_router(office.router)
app.include_router(autopilot.router)
app.include_router(ai.router)
app.include_router(ai_table_builder.router)
app.include_router(ai_document.router)
app.include_router(ai_document.templates_router)
app.include_router(reports.router)
app.include_router(data_cleaning.router)
app.include_router(chat.router)
app.include_router(chat.workspace_router)
app.include_router(admin.router)
app.include_router(history.router)
app.include_router(billing.router)
app.include_router(workspaces.router)
app.include_router(broadcasts.router)
app.include_router(user_settings.router)
app.include_router(templates.router)


scheduler = AsyncIOScheduler(timezone="Asia/Ho_Chi_Minh")


@scheduler.scheduled_job("cron", hour=0, minute=0)
async def _daily_quota_reset():
    try:
        db = get_db()
        await reset_daily_quota(db)
    except Exception as exc:
        print(f"Daily quota reset failed: {exc}")


@app.on_event("startup")
async def _on_startup():
    try:
        get_db().fetch("SELECT 1")
        print("Startup: database connection OK")
    except Exception as exc:
        print(f"WARNING: Startup database check failed — server will retry on first request. Error: {exc}")
    if not scheduler.running:
        scheduler.start()


@app.on_event("shutdown")
async def _on_shutdown():
    if scheduler.running:
        scheduler.shutdown(wait=False)
