from __future__ import annotations

from collections import Counter
import json
from threading import Lock
from datetime import date


_lock = Lock()
_requests_total: Counter[tuple[str, str, int]] = Counter()
_latency_total_ms: Counter[tuple[str, str]] = Counter()


def record_request(method: str, path: str, status_code: int, latency_ms: int) -> None:
    route = path.split("?")[0][:200]
    key = (method.upper(), route, int(status_code))
    latency_key = (method.upper(), route)
    with _lock:
        _requests_total[key] += 1
        _latency_total_ms[latency_key] += max(0, int(latency_ms))


def increment_business_metric(db, metric_name: str, value: int | float = 1, dimensions: dict | None = None) -> None:
    dimensions_json = json.dumps(dimensions or {}, ensure_ascii=False, sort_keys=True)
    db.fetch(
        """
        INSERT INTO business_metrics (metric_date, metric_name, metric_value, dimensions, updated_at)
        VALUES (%s, %s, %s, %s::jsonb, NOW())
        ON CONFLICT (metric_date, metric_name, dimensions)
        DO UPDATE SET metric_value = business_metrics.metric_value + EXCLUDED.metric_value, updated_at = NOW()
        """,
        [date.today().isoformat(), metric_name, value, dimensions_json],
        commit=True,
    )


def persist_request_metrics(db, request_id: str, method: str, path: str, status_code: int, latency_ms: int, user_id: str | None = None) -> None:
    route = path.split("?")[0][:300]
    db.table("api_request_logs").insert(
        {
            "request_id": request_id,
            "method": method.upper()[:12],
            "path": route,
            "status_code": int(status_code),
            "latency_ms": max(0, int(latency_ms)),
            "user_id": user_id,
        }
    ).execute()
    increment_business_metric(db, "request_count", 1, {"method": method.upper(), "path": route, "status": str(status_code)})
    if status_code >= 400:
        increment_business_metric(db, "error_count", 1, {"status": str(status_code)})
    if status_code in {401, 403, 404}:
        increment_business_metric(db, "permission_denied_count", 1, {"status": str(status_code), "path": route})


def prometheus_text() -> str:
    lines = [
        "# HELP excelai_http_requests_total Total HTTP requests handled by ExcelAI.",
        "# TYPE excelai_http_requests_total counter",
    ]
    with _lock:
        for (method, route, status_code), count in sorted(_requests_total.items()):
            lines.append(f'excelai_http_requests_total{{method="{method}",route="{route}",status_code="{status_code}"}} {count}')
        lines.append("# HELP excelai_http_request_latency_ms_total Total HTTP request latency in milliseconds.")
        lines.append("# TYPE excelai_http_request_latency_ms_total counter")
        for (method, route), total in sorted(_latency_total_ms.items()):
            lines.append(f'excelai_http_request_latency_ms_total{{method="{method}",route="{route}"}} {total}')
    return "\n".join(lines) + "\n"
