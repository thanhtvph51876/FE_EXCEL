from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status

from pg_client import PgClient
from services.permission_service import workspace_membership
from auth_policy import effective_role
from metrics import increment_business_metric


JOB_TYPES = {
    "FILE_PROCESSING",
    "AI_CLEAN_DATA",
    "AI_RECONCILE",
    "AI_AUTOPILOT",
    "EXPORT_DOCX",
    "EXPORT_PDF",
    "EXPORT_XLSX",
    "AI_EVAL_BATCH",
}
JOB_STATUSES = {"queued", "running", "succeeded", "failed", "cancelled"}


def _json_payload(value: Any) -> str:
    if isinstance(value, str):
        try:
            json.loads(value)
            return value
        except json.JSONDecodeError:
            return "{}"
    return json.dumps(value or {}, ensure_ascii=False)


class JobQueue:
    def __init__(self, db: PgClient):
        self.db = db

    def enqueue_job(
        self,
        job_type: str,
        payload: dict,
        user_id: str,
        workspace_id: str | None = None,
        file_id: str | None = None,
        idempotency_key: str = "",
    ) -> dict:
        normalized_type = (job_type or "").strip().upper()
        if normalized_type not in JOB_TYPES:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Job type không hợp lệ.")
        if idempotency_key:
            existing = self.db.table("job_queue").select("*").eq("idempotency_key", idempotency_key).limit(1).execute().data or []
            if existing:
                return existing[0]
        row = {
            "user_id": user_id,
            "workspace_id": workspace_id,
            "file_id": file_id,
            "type": normalized_type,
            "status": "queued",
            "progress": 0,
            "payload": _json_payload(self._safe_payload(payload)),
            "idempotency_key": idempotency_key[:180],
        }
        saved = (self.db.table("job_queue").insert(row).execute().data or [row])[0]
        increment_business_metric(self.db, "job_count_by_status", 1, {"type": normalized_type, "status": "queued"})
        return saved

    def get_job(self, job_id: str) -> dict | None:
        rows = self.db.table("job_queue").select("*").eq("id", job_id).limit(1).execute().data or []
        return rows[0] if rows else None

    def list_jobs(self, user_id: str | None = None, workspace_id: str | None = None) -> list[dict]:
        query = self.db.table("job_queue").select("*")
        if user_id:
            query = query.eq("user_id", user_id)
        if workspace_id:
            query = query.eq("workspace_id", workspace_id)
        return query.order("created_at", desc=True).limit(100).execute().data or []

    def update_job_status(self, job_id: str, status_value: str, progress: int | None = None, error_message: str = "", result_ref: str = "", output_id: str | None = None) -> dict:
        if status_value not in JOB_STATUSES:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Job status không hợp lệ.")
        now = datetime.now(timezone.utc).isoformat()
        update = {"status": status_value}
        if progress is not None:
            update["progress"] = max(0, min(100, int(progress)))
        if status_value == "running":
            update["started_at"] = now
        if status_value in {"succeeded", "failed", "cancelled"}:
            update["finished_at"] = now
        if error_message:
            update["error_message"] = self._safe_error(error_message)
        if result_ref:
            update["result_ref"] = result_ref[:255]
        if output_id:
            update["output_id"] = output_id
        rows = self.db.table("job_queue").update(update).eq("id", job_id).execute().data or []
        if not rows:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy job.")
        increment_business_metric(self.db, "job_count_by_status", 1, {"type": rows[0].get("type") or "UNKNOWN", "status": status_value})
        if status_value == "failed":
            increment_business_metric(self.db, "failed_jobs", 1, {"type": rows[0].get("type") or "UNKNOWN"})
        return rows[0]

    def cancel_job(self, job_id: str) -> dict:
        job = self.get_job(job_id)
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy job.")
        if job.get("status") in {"succeeded", "failed", "cancelled"}:
            return job
        return self.update_job_status(job_id, "cancelled", progress=int(job.get("progress") or 0))

    @staticmethod
    def _safe_payload(payload: dict) -> dict:
        blocked = {"token", "accessToken", "refreshToken", "apiKey", "password", "secret"}
        safe = {}
        for key, value in (payload or {}).items():
            if str(key) in blocked:
                continue
            safe[key] = value
        return safe

    @staticmethod
    def _safe_error(message: str) -> str:
        first = str(message or "").splitlines()[0]
        return first[:500]


def can_access_job(db: PgClient, user: dict, job: dict) -> bool:
    if effective_role(user) == "admin":
        return True
    if str(job.get("user_id")) == str(user.get("id")):
        return True
    return bool(job.get("workspace_id") and workspace_membership(db, job.get("workspace_id"), user.get("id")))


def can_cancel_job(db: PgClient, user: dict, job: dict) -> bool:
    if effective_role(user) == "admin" or str(job.get("user_id")) == str(user.get("id")):
        return True
    membership = workspace_membership(db, job.get("workspace_id"), user.get("id"))
    return (membership or {}).get("role") in {"owner", "admin", "manager"}
