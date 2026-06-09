from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from dependencies import get_current_user, get_db
from services.job_queue import JobQueue, can_access_job, can_cancel_job
from services.permission_service import can_read_file, can_upload_to_workspace


router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _job_payload(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "type": row.get("type"),
        "status": row.get("status"),
        "progress": row.get("progress") or 0,
        "userId": row.get("user_id"),
        "workspaceId": row.get("workspace_id"),
        "fileId": row.get("file_id"),
        "errorMessage": row.get("error_message") or "",
        "resultRef": row.get("result_ref") or "",
        "outputId": row.get("output_id"),
        "createdAt": row.get("created_at"),
        "startedAt": row.get("started_at"),
        "finishedAt": row.get("finished_at"),
    }


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def create_job(request: Request, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payload job không hợp lệ.")
    workspace_id = (payload.get("workspace_id") or payload.get("workspaceId") or "").strip() or None
    file_id = (payload.get("file_id") or payload.get("fileId") or "").strip() or None
    if workspace_id and not can_upload_to_workspace(db, current_user, workspace_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền tạo job trong workspace này.")
    if file_id:
        rows = db.table("files").select("*").eq("id", file_id).limit(1).execute().data or []
        if not rows or not can_read_file(db, current_user, rows[0]):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy file cho job.")
        workspace_id = workspace_id or rows[0].get("workspace_id")
    job = JobQueue(db).enqueue_job(
        payload.get("type") or payload.get("jobType"),
        payload.get("payload") if isinstance(payload.get("payload"), dict) else {},
        current_user["id"],
        workspace_id=workspace_id,
        file_id=file_id,
        idempotency_key=str(payload.get("idempotency_key") or payload.get("idempotencyKey") or ""),
    )
    return {"success": True, "job": _job_payload(job)}


@router.get("")
async def list_jobs(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    rows = db.fetch(
        """
        SELECT DISTINCT j.*
        FROM job_queue j
        LEFT JOIN workspace_members wm
            ON wm.workspace_id = j.workspace_id
            AND wm.user_id = %s
            AND wm.status = 'active'
        WHERE j.user_id = %s OR wm.id IS NOT NULL
        ORDER BY j.created_at DESC
        LIMIT 100
        """,
        [current_user["id"], current_user["id"]],
    )
    return {"success": True, "jobs": [_job_payload(row) for row in rows]}


@router.get("/{job_id}")
async def get_job(job_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    job = JobQueue(db).get_job(job_id)
    if not job or not can_access_job(db, current_user, job):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy job.")
    return {"success": True, "job": _job_payload(job)}


@router.post("/{job_id}/cancel")
async def cancel_job(job_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    queue = JobQueue(db)
    job = queue.get_job(job_id)
    if not job or not can_access_job(db, current_user, job):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy job.")
    if not can_cancel_job(db, current_user, job):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền hủy job này.")
    return {"success": True, "job": _job_payload(queue.cancel_job(job_id))}
