from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from config import settings
from dependencies import get_db
from metrics import prometheus_text
from rate_limit import SLOWAPI_AVAILABLE, RateLimitExceeded, _rate_limit_exceeded_handler, limiter
from request_context import RequestContextMiddleware, request_id_from
from routers import admin, ai, auth, billing, broadcasts, exports, files, history, jobs, office, settings as user_settings, templates, workspaces
from services.gemini_service import ai_provider_health
from services.quota_service import reset_daily_quota
from services.storage_service import StorageService


app = FastAPI(
    title="ExcelAI & Office Autopilot API",
    version="1.0.0",
    description="Backend API cho ExcelAI - tự động hóa Excel bằng AI",
)

app.add_middleware(RequestContextMiddleware)

if SLOWAPI_AVAILABLE:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    text = str(exc)
    lowered = text.lower()
    if "connection refused" in lowered or "could not connect" in lowered:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "errorCode": "DATABASE_CONNECTION_FAILED",
                "message": "Internal server error",
                "request_id": request_id_from(request),
            },
        )
    if "relation" in lowered and "does not exist" in lowered:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "errorCode": "DATABASE_SCHEMA_NOT_READY",
                "message": "Internal server error",
                "request_id": request_id_from(request),
            },
        )
    return JSONResponse(
        status_code=500,
        content={"success": False, "errorCode": "INTERNAL_SERVER_ERROR", "message": "Internal server error", "request_id": request_id_from(request)},
    )


@app.get("/api/health")
async def health_check():
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
        return {"success": True, "status": "ok", "dependency": "postgres", "environment": settings.environment}
    except Exception:
        return {"success": True, "status": "degraded", "dependency": "postgres", "environment": settings.environment}


@app.get("/api/health/ai")
async def ai_health_check():
    provider = ai_provider_health()
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
async def full_health_check():
    return {
        "success": True,
        "status": "ok",
        "environment": settings.environment,
        "version": "api-map-20260605-2",
        "db": (await db_health_check()),
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
app.include_router(ai.router)
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
async def _start_scheduler():
    if not scheduler.running:
        scheduler.start()


@app.on_event("shutdown")
async def _stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
