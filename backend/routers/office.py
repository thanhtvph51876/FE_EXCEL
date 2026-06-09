import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from auth_policy import effective_role
from dependencies import get_current_user, get_db
from services.job_queue import JobQueue
from services.log_service import log_operation
from services.permission_service import can_upload_to_workspace, workspace_membership


router = APIRouter(prefix="/api/office", tags=["office"])


class WorkflowPayload(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    description: str = ""
    workspaceId: str | None = None
    inputRequirements: list[dict[str, Any]] = Field(default_factory=list)
    steps: list[dict[str, Any]] = Field(default_factory=list)
    outputs: list[dict[str, Any]] = Field(default_factory=list)
    schedule: dict[str, Any] = Field(default_factory=dict)
    status: str = "active"


class WorkflowRunPayload(BaseModel):
    fileIds: list[str] = Field(default_factory=list)
    parameters: dict[str, Any] = Field(default_factory=dict)
    idempotencyKey: str = ""


class WorkflowStatusPayload(BaseModel):
    status: str = Field(pattern="^(active|paused|archived)$")


def _json_value(value, default):
    if isinstance(value, (list, dict)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return default
    return default


def _json_dump(value) -> str:
    return json.dumps(value or ([] if isinstance(value, list) else {}), ensure_ascii=False)


def _size_to_bytes(value: str | None) -> int:
    text = str(value or "").strip().upper().replace(",", ".")
    if not text:
        return 0
    parts = text.split()
    try:
        number = float(parts[0])
    except (ValueError, IndexError):
        return 0
    unit = parts[1] if len(parts) > 1 else "B"
    factors = {"B": 1, "KB": 1024, "MB": 1024**2, "GB": 1024**3}
    return int(number * factors.get(unit, 1))


def _format_bytes(value: int) -> str:
    if value >= 1024**3:
        return f"{value / (1024**3):.1f} GB"
    if value >= 1024**2:
        return f"{value / (1024**2):.1f} MB"
    if value >= 1024:
        return f"{value / 1024:.1f} KB"
    return f"{value} B"


def _workflow_payload(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "workspaceId": row.get("workspace_id"),
        "name": row.get("name") or "",
        "description": row.get("description") or "",
        "inputRequirements": _json_value(row.get("input_requirements"), []),
        "steps": _json_value(row.get("steps"), []),
        "outputs": _json_value(row.get("outputs"), []),
        "schedule": _json_value(row.get("schedule"), {}),
        "status": row.get("status") or "active",
        "createdBy": row.get("created_by_snapshot") or "",
        "lastRunAt": row.get("last_run_at"),
        "lastJobId": row.get("last_job_id"),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def _task_payload(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "workspaceId": row.get("workspace_id"),
        "fileId": row.get("file_id"),
        "type": row.get("type"),
        "status": row.get("status"),
        "progress": row.get("progress") or 0,
        "payload": _json_value(row.get("payload"), {}),
        "errorMessage": row.get("error_message") or "",
        "resultRef": row.get("result_ref") or "",
        "outputId": row.get("output_id"),
        "createdAt": row.get("created_at"),
        "startedAt": row.get("started_at"),
        "finishedAt": row.get("finished_at"),
    }


def _file_summary(row: dict) -> dict:
    columns = _json_value(row.get("columns_metadata"), [])
    warning_columns = 0
    for column in columns:
        if not isinstance(column, dict):
            continue
        missing = column.get("missing") or column.get("missing_count") or column.get("empty") or column.get("empty_count") or 0
        duplicate = column.get("duplicates") or column.get("duplicate_count") or 0
        try:
            warning_columns += 1 if int(missing or 0) or int(duplicate or 0) else 0
        except (TypeError, ValueError):
            continue
    return {
        "id": row.get("id"),
        "workspaceId": row.get("workspace_id"),
        "name": row.get("name") or "",
        "size": row.get("size") or "",
        "rowCount": row.get("row_count") or 0,
        "colCount": row.get("col_count") or 0,
        "status": row.get("status") or "ready",
        "dataLabel": row.get("data_label") or "File nguồn",
        "category": row.get("category") or "source",
        "version": row.get("version_number") or 1,
        "isImportant": bool(row.get("is_important")),
        "duplicateOfFileId": row.get("duplicate_of_file_id"),
        "warningColumns": warning_columns,
        "uploadedAt": row.get("uploaded_at"),
    }


def _can_access_workspace(db, user: dict, workspace_id: str | None) -> bool:
    if not workspace_id:
        return True
    if effective_role(user) == "admin":
        return True
    return bool(workspace_membership(db, workspace_id, user.get("id")))


def _can_access_workflow(db, user: dict, row: dict) -> bool:
    if effective_role(user) == "admin":
        return True
    if str(row.get("user_id")) == str(user.get("id")):
        return True
    return bool(row.get("workspace_id") and workspace_membership(db, row.get("workspace_id"), user.get("id")))


def _can_mutate_workflow(db, user: dict, row: dict) -> bool:
    if effective_role(user) == "admin" or str(row.get("user_id")) == str(user.get("id")):
        return True
    return can_upload_to_workspace(db, user, row.get("workspace_id"))


def _get_workflow(db, workflow_id: str, user: dict, mutate: bool = False) -> dict:
    rows = db.table("saved_workflows").select("*").eq("id", workflow_id).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy workflow.")
    row = rows[0]
    allowed = _can_mutate_workflow(db, user, row) if mutate else _can_access_workflow(db, user, row)
    if not allowed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy workflow.")
    return row


@router.get("/dashboard")
async def office_dashboard(workspace_id: str | None = Query(default=None), current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    workspace_id = (workspace_id or "").strip() or None
    if not _can_access_workspace(db, current_user, workspace_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền xem workspace này.")
    user_id = current_user["id"]
    files = db.fetch(
        """
        SELECT DISTINCT f.*
        FROM files f
        LEFT JOIN workspace_members wm
            ON wm.workspace_id = f.workspace_id
            AND wm.user_id = %s
            AND wm.status = 'active'
        WHERE (f.user_id = %s OR wm.id IS NOT NULL)
            AND (%s IS NULL OR f.workspace_id = %s)
        ORDER BY f.uploaded_at DESC
        LIMIT 200
        """,
        [user_id, user_id, workspace_id, workspace_id],
    )
    jobs = db.fetch(
        """
        SELECT DISTINCT j.*
        FROM job_queue j
        LEFT JOIN workspace_members wm
            ON wm.workspace_id = j.workspace_id
            AND wm.user_id = %s
            AND wm.status = 'active'
        WHERE (j.user_id = %s OR wm.id IS NOT NULL)
            AND (%s IS NULL OR j.workspace_id = %s)
        ORDER BY j.created_at DESC
        LIMIT 50
        """,
        [user_id, user_id, workspace_id, workspace_id],
    )
    workflows = db.fetch(
        """
        SELECT DISTINCT w.*
        FROM saved_workflows w
        LEFT JOIN workspace_members wm
            ON wm.workspace_id = w.workspace_id
            AND wm.user_id = %s
            AND wm.status = 'active'
        WHERE (w.user_id = %s OR wm.id IS NOT NULL)
            AND w.status <> 'archived'
            AND (%s IS NULL OR w.workspace_id = %s)
        ORDER BY w.updated_at DESC
        LIMIT 50
        """,
        [user_id, user_id, workspace_id, workspace_id],
    )
    output_rows = db.fetch(
        """
        SELECT COUNT(*) AS count
        FROM output_files o
        LEFT JOIN workspace_members wm
            ON wm.workspace_id = o.workspace_id
            AND wm.user_id = %s
            AND wm.status = 'active'
        WHERE (o.user_id = %s OR wm.id IS NOT NULL)
            AND (%s IS NULL OR o.workspace_id = %s)
        """,
        [user_id, user_id, workspace_id, workspace_id],
    )
    summaries = [_file_summary(row) for row in files]
    warning_files = [item for item in summaries if item["status"] != "ready" or item["duplicateOfFileId"] or item["warningColumns"]]
    processing_jobs = [job for job in jobs if job.get("status") in {"queued", "running"}]
    storage_bytes = sum(_size_to_bytes(row.get("size")) for row in files)
    dashboard = {
        "stats": {
            "totalFiles": len(files),
            "readyFiles": len([row for row in files if (row.get("status") or "ready") == "ready"]),
            "warningFiles": len(warning_files),
            "processingTasks": len(processing_jobs),
            "totalRows": sum(int(row.get("row_count") or 0) for row in files),
            "storageBytes": storage_bytes,
            "storageDisplay": _format_bytes(storage_bytes),
            "workflowCount": len(workflows),
            "reportCount": int((output_rows[0] if output_rows else {}).get("count") or 0),
        },
        "recentFiles": summaries[:10],
        "recentTasks": [_task_payload(row) for row in jobs[:10]],
        "workflows": [_workflow_payload(row) for row in workflows[:10]],
        "alerts": [
            {
                "fileId": item["id"],
                "title": item["name"],
                "type": "duplicate" if item["duplicateOfFileId"] else ("status" if item["status"] != "ready" else "data_quality"),
                "message": "File bị trùng dữ liệu." if item["duplicateOfFileId"] else ("File chưa sẵn sàng." if item["status"] != "ready" else "Có cột cần kiểm tra dữ liệu."),
            }
            for item in warning_files[:8]
        ],
    }
    return {"success": True, "dashboard": dashboard}


@router.get("/workflows")
async def list_workflows(workspace_id: str | None = Query(default=None), current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    workspace_id = (workspace_id or "").strip() or None
    if not _can_access_workspace(db, current_user, workspace_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền xem workspace này.")
    rows = db.fetch(
        """
        SELECT DISTINCT w.*
        FROM saved_workflows w
        LEFT JOIN workspace_members wm
            ON wm.workspace_id = w.workspace_id
            AND wm.user_id = %s
            AND wm.status = 'active'
        WHERE (w.user_id = %s OR wm.id IS NOT NULL)
            AND w.status <> 'archived'
            AND (%s IS NULL OR w.workspace_id = %s)
        ORDER BY w.updated_at DESC
        """,
        [current_user["id"], current_user["id"], workspace_id, workspace_id],
    )
    return {"success": True, "workflows": [_workflow_payload(row) for row in rows]}


@router.post("/workflows", status_code=status.HTTP_201_CREATED)
async def create_workflow(payload: WorkflowPayload, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    workspace_id = (payload.workspaceId or "").strip() or None
    if not can_upload_to_workspace(db, current_user, workspace_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền tạo workflow trong workspace này.")
    if payload.status not in {"active", "paused", "archived"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Trạng thái workflow không hợp lệ.")
    row = {
        "user_id": current_user["id"],
        "workspace_id": workspace_id,
        "name": payload.name.strip(),
        "description": payload.description.strip()[:2000],
        "input_requirements": _json_dump(payload.inputRequirements),
        "steps": _json_dump(payload.steps),
        "outputs": _json_dump(payload.outputs),
        "schedule": _json_dump(payload.schedule),
        "status": payload.status,
        "created_by_snapshot": current_user.get("name") or current_user.get("email") or "",
    }
    saved = (db.table("saved_workflows").insert(row).execute().data or [row])[0]
    await log_operation(db, current_user["id"], "workflow", f"Tạo workflow {saved.get('name')}")
    return {"success": True, "workflow": _workflow_payload(saved)}


@router.get("/workflows/{workflow_id}")
async def get_workflow(workflow_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    return {"success": True, "workflow": _workflow_payload(_get_workflow(db, workflow_id, current_user))}


@router.put("/workflows/{workflow_id}")
async def update_workflow(workflow_id: str, payload: WorkflowPayload, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    row = _get_workflow(db, workflow_id, current_user, mutate=True)
    workspace_id = (payload.workspaceId or "").strip() or None
    if workspace_id != row.get("workspace_id") and not can_upload_to_workspace(db, current_user, workspace_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền chuyển workflow sang workspace này.")
    if payload.status not in {"active", "paused", "archived"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Trạng thái workflow không hợp lệ.")
    update = {
        "workspace_id": workspace_id,
        "name": payload.name.strip(),
        "description": payload.description.strip()[:2000],
        "input_requirements": _json_dump(payload.inputRequirements),
        "steps": _json_dump(payload.steps),
        "outputs": _json_dump(payload.outputs),
        "schedule": _json_dump(payload.schedule),
        "status": payload.status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    saved = (db.table("saved_workflows").update(update).eq("id", workflow_id).execute().data or [{**row, **update}])[0]
    await log_operation(db, current_user["id"], "workflow", f"Cập nhật workflow {saved.get('name')}")
    return {"success": True, "workflow": _workflow_payload(saved)}


@router.patch("/workflows/{workflow_id}/status")
async def update_workflow_status(workflow_id: str, payload: WorkflowStatusPayload, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    row = _get_workflow(db, workflow_id, current_user, mutate=True)
    update = {"status": payload.status, "updated_at": datetime.now(timezone.utc).isoformat()}
    saved = (db.table("saved_workflows").update(update).eq("id", workflow_id).execute().data or [{**row, **update}])[0]
    return {"success": True, "workflow": _workflow_payload(saved)}


@router.delete("/workflows/{workflow_id}")
async def archive_workflow(workflow_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    row = _get_workflow(db, workflow_id, current_user, mutate=True)
    update = {"status": "archived", "updated_at": datetime.now(timezone.utc).isoformat()}
    saved = (db.table("saved_workflows").update(update).eq("id", workflow_id).execute().data or [{**row, **update}])[0]
    await log_operation(db, current_user["id"], "workflow", f"Lưu trữ workflow {saved.get('name')}")
    return {"success": True, "workflow": _workflow_payload(saved)}


@router.post("/workflows/{workflow_id}/run", status_code=status.HTTP_201_CREATED)
async def run_workflow(workflow_id: str, payload: WorkflowRunPayload, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    row = _get_workflow(db, workflow_id, current_user, mutate=True)
    if row.get("status") == "archived":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Workflow đã lưu trữ, không thể chạy.")
    job = JobQueue(db).enqueue_job(
        "AI_AUTOPILOT",
        {
            "workflowId": workflow_id,
            "workflowName": row.get("name"),
            "fileIds": payload.fileIds,
            "parameters": payload.parameters,
            "steps": _json_value(row.get("steps"), []),
            "outputs": _json_value(row.get("outputs"), []),
        },
        current_user["id"],
        workspace_id=row.get("workspace_id"),
        file_id=(payload.fileIds[0] if payload.fileIds else None),
        idempotency_key=payload.idempotencyKey,
    )
    db.table("saved_workflows").update(
        {
            "last_run_at": datetime.now(timezone.utc).isoformat(),
            "last_job_id": job.get("id"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", workflow_id).execute()
    await log_operation(db, current_user["id"], "workflow", f"Chạy workflow {row.get('name')}")
    return {"success": True, "job": _task_payload(job)}
