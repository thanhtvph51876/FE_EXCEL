import hashlib
import io
import json
import re
import zipfile
import asyncio
from datetime import datetime, timezone
from uuid import uuid4

import openpyxl
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel, Field

from dependencies import get_current_user, get_db
from entitlements import tier_entitlement
from rate_limit import enforce_user_rate_limit
from metrics import increment_business_metric
from services.excel_service import build_statistics, format_file_size, parse_workbook
from services.http_headers import safe_attachment_headers
from services.log_service import log_operation
from services.permission_service import can_delete_file, can_read_file, can_upload_to_workspace
from services.storage_service import StorageService


router = APIRouter(prefix="/api/files", tags=["files"])
ALLOWED_EXTENSIONS = (".csv", ".xlsx", ".xls")
ALLOWED_CONTENT_TYPES = {
    "",
    "application/octet-stream",
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


class FileMetadataUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    dataLabel: str | None = Field(default=None, max_length=80)
    category: str | None = Field(default=None, max_length=60)
    isImportant: bool | None = None


def _safe_filename(filename: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", filename).strip("._") or "upload.xlsx"


def _validate_filename(filename: str) -> None:
    if "\x00" in filename or "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tên file không hợp lệ.")


def _validate_magic(filename: str, content: bytes) -> None:
    lower = filename.lower()
    if lower.endswith(".xlsx"):
        if not content.startswith(b"PK"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File không đúng định dạng.")
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                names = set(archive.namelist())
                required = {"[Content_Types].xml", "xl/workbook.xml"}
                if not required.issubset(names):
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File Excel không có cấu trúc workbook hợp lệ.")
                total_uncompressed = sum(info.file_size for info in archive.infolist())
                if total_uncompressed > max(50 * 1024 * 1024, len(content) * 80):
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File Excel nén bất thường, không an toàn để xử lý.")
        except zipfile.BadZipFile as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File không đúng định dạng.") from exc
    if lower.endswith(".xls") and not content.startswith(b"\xd0\xcf\x11\xe0"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File không đúng định dạng.")
    if lower.endswith(".csv") and b"\x00" in content[:4096]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File không đúng định dạng.")


def _validate_content_type(content_type: str | None) -> str:
    value = (content_type or "").split(";")[0].strip().lower()
    if value not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="MIME type của file không được hỗ trợ.")
    return value or "application/octet-stream"


def _xlsx_has_macros(filename: str, content: bytes) -> bool:
    if not filename.lower().endswith(".xlsx"):
        return False
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            return any(name.lower().endswith("vbaproject.bin") for name in archive.namelist())
    except zipfile.BadZipFile:
        return False


def _workbook_metadata(filename: str, content: bytes, parsed) -> dict:
    sheet_names = []
    if filename.lower().endswith(".xlsx"):
        try:
            workbook = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
            sheet_names = list(workbook.sheetnames)
            workbook.close()
        except Exception:
            sheet_names = []
    elif filename.lower().endswith(".csv"):
        sheet_names = ["CSV"]
    elif filename.lower().endswith(".xls"):
        sheet_names = ["Sheet1"]
    statistics = build_statistics(parsed.headers, parsed.rows[:1000], parsed.row_count)
    return {
        "sheet_count": max(1, len(sheet_names)),
        "sheet_names": sheet_names or ["Sheet1"],
        "columns_metadata": statistics.get("columns", []),
    }


def _storage_bytes(payload) -> bytes:
    if isinstance(payload, bytes):
        return payload
    if hasattr(payload, "content"):
        return payload.content
    if isinstance(payload, str):
        return payload.encode("utf-8")
    return bytes(payload)


def _json_value(value, default):
    if isinstance(value, (list, dict)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return default
    return default


def _file_payload(row: dict, parsed=None) -> dict:
    uploaded_at = row.get("uploaded_at") or datetime.now(timezone.utc).isoformat()
    payload = {
        "id": row.get("id"),
        "workspaceId": row.get("workspace_id"),
        "name": row.get("name"),
        "size": row.get("size"),
        "rowCount": row.get("row_count", 0),
        "colCount": row.get("col_count", 0),
        "status": row.get("status") or "ready",
        "errorMessage": row.get("error_message") or "",
        "uploadedAt": uploaded_at,
        "sha256": row.get("sha256") or "",
        "mimeType": row.get("mime_type") or "",
        "sheetCount": row.get("sheet_count") or 1,
        "sheetNames": _json_value(row.get("sheet_names"), []),
        "duplicateOfFileId": row.get("duplicate_of_file_id"),
        "hasMacros": bool(row.get("has_macros")),
        "dataLabel": row.get("data_label") or "File nguồn",
        "category": row.get("category") or "source",
        "version": row.get("version_number") or 1,
        "parentFileId": row.get("parent_file_id"),
        "isImportant": bool(row.get("is_important")),
        "uploadedBy": row.get("uploaded_by") or row.get("user_name") or row.get("user_id") or "",
    }
    if parsed is not None:
        payload.update(
            {
                "headers": parsed.headers,
                "rows": parsed.preview_rows,
                "totalRows": parsed.row_count,
                "statistics": build_statistics(parsed.headers, parsed.rows, parsed.row_count),
            }
        )
    return payload


def _get_file_for_read(db, file_id: str, current_user: dict) -> dict:
    response = db.table("files").select("*").eq("id", file_id).limit(1).execute()
    if not response.data or not can_read_file(db, current_user, response.data[0]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tệp tin.")
    return response.data[0]


def _get_file_for_delete(db, file_id: str, current_user: dict) -> dict:
    response = db.table("files").select("*").eq("id", file_id).limit(1).execute()
    if not response.data or not can_delete_file(db, current_user, response.data[0]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tệp tin.")
    return response.data[0]


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_file(file: UploadFile = File(...), workspace_id: str | None = Form(default=None), current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    workspace_id = (workspace_id or "").strip() or None
    if not can_upload_to_workspace(db, current_user, workspace_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền upload vào workspace này.")
    if workspace_id:
        workspace_rows = db.table("workspaces").select("id").eq("id", workspace_id).limit(1).execute().data or []
        if not workspace_rows:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy workspace.")
    enforce_user_rate_limit(current_user["id"], "files:upload", 20, 3600)
    entitlement = tier_entitlement(current_user.get("tier"))
    count_rows = db.fetch("SELECT COUNT(*) AS cnt FROM files WHERE user_id = %s", [current_user["id"]])
    file_count = int((count_rows[0] if count_rows else {}).get("cnt") or 0)
    if file_count >= int(entitlement["max_files"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usage limit reached for your current plan.")
    filename = file.filename or "upload.xlsx"
    _validate_filename(filename)
    if not filename.lower().endswith(ALLOWED_EXTENSIONS):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tệp tin tải lên không đúng định dạng Excel/CSV.")
    content = await file.read()
    content_type = _validate_content_type(file.content_type)
    _validate_magic(filename, content)
    max_bytes = int(entitlement["max_file_size_mb"]) * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File size exceeds your current plan limit.")
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tệp tin rỗng.")
    sha256 = hashlib.sha256(content).hexdigest()
    has_macros = _xlsx_has_macros(filename, content)
    if has_macros:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File Excel có macro/VBA không được phép upload.")
    user_id = current_user["id"]
    storage_prefix = f"workspaces/{workspace_id}" if workspace_id else user_id
    storage_path = f"{storage_prefix}/{uuid4()}_{_safe_filename(filename)}"
    storage = StorageService(db)
    try:
        storage.upload_bytes(storage_path, content, content_type)
    except Exception as exc:
        message = "Không thể lưu file vào local storage. Hãy kiểm tra LOCAL_STORAGE_DIR trong backend/.env."
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=message) from exc
    try:
        parsed = await asyncio.to_thread(parse_workbook, filename, content)
    except Exception as exc:
        db.table("files").insert(
            {
                "user_id": user_id,
                "name": filename,
                "path": storage_path,
                "size": format_file_size(len(content)),
                "size_bytes": len(content),
                "row_count": 0,
                "col_count": 0,
                "status": "failed",
                "error_message": "File parse failed",
            }
        ).execute()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không thể đọc dữ liệu Excel/CSV.") from exc
    if not parsed.headers:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tệp không có dòng tiêu đề.")
    if parsed.row_count > int(entitlement["max_rows_per_file"]):
        try:
            storage.remove([storage_path])
        except Exception:
            pass
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File row count exceeds your current plan limit. Please upgrade to process larger files.")
    workbook_meta = _workbook_metadata(filename, content, parsed)
    previous_versions = db.fetch(
        """
        SELECT id, version_number
        FROM files
        WHERE user_id = %s
            AND name = %s
            AND ((%s IS NULL AND workspace_id IS NULL) OR workspace_id = %s)
        ORDER BY uploaded_at DESC
        LIMIT 1
        """,
        [user_id, filename, workspace_id, workspace_id],
    )
    parent_file_id = previous_versions[0]["id"] if previous_versions else None
    version_number = int((previous_versions[0] if previous_versions else {}).get("version_number") or 0) + 1
    duplicate_rows = db.fetch(
        """
        SELECT id
        FROM files
        WHERE user_id = %s
            AND sha256 = %s
            AND ((%s IS NULL AND workspace_id IS NULL) OR workspace_id = %s)
        LIMIT 1
        """,
        [user_id, sha256, workspace_id, workspace_id],
    )
    duplicate_of_file_id = duplicate_rows[0]["id"] if duplicate_rows else None

    metadata = {
        "user_id": user_id,
        "name": filename,
        "path": storage_path,
        "size": format_file_size(len(content)),
        "size_bytes": len(content),
        "row_count": parsed.row_count,
        "col_count": parsed.col_count,
        "status": "ready",
        "error_message": "",
        "sha256": sha256,
        "mime_type": content_type,
        "sheet_count": workbook_meta["sheet_count"],
        "sheet_names": json.dumps(workbook_meta["sheet_names"], ensure_ascii=False),
        "columns_metadata": json.dumps(workbook_meta["columns_metadata"], ensure_ascii=False),
        "duplicate_of_file_id": duplicate_of_file_id,
        "workspace_id": workspace_id,
        "has_macros": has_macros,
        "data_label": "File nguồn",
        "category": "source",
        "version_number": version_number,
        "parent_file_id": parent_file_id,
        "is_important": False,
    }
    try:
        response = db.table("files").insert(metadata).execute()
    except Exception as exc:
        try:
            storage.remove([storage_path])
        except Exception:
            pass
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Không thể lưu metadata file vào bảng files.") from exc
    row = response.data[0] if response.data else {**metadata, "id": str(uuid4())}
    await log_operation(db, user_id, "file", f"Tải lên file {filename}")
    increment_business_metric(db, "file_upload_count", 1, {"workspace": "yes" if workspace_id else "no"})
    return _file_payload(row, parsed)


@router.get("")
async def list_files(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    rows = db.fetch(
        """
        SELECT DISTINCT f.*
        FROM files f
        LEFT JOIN workspace_members wm
            ON wm.workspace_id = f.workspace_id
            AND wm.user_id = %s
            AND wm.status = 'active'
        WHERE f.user_id = %s OR wm.id IS NOT NULL
        ORDER BY f.uploaded_at DESC
        LIMIT %s OFFSET %s
        """,
        [current_user["id"], current_user["id"], limit, offset],
    )
    return [_file_payload(row) for row in rows]


@router.get("/{file_id}/preview")
async def preview_file(file_id: str, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    row = _get_file_for_read(db, file_id, current_user)
    try:
        content = _storage_bytes(StorageService(db).download_bytes(row["path"]))
        parsed = await asyncio.to_thread(parse_workbook, row["name"], content)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Không thể tải hoặc đọc preview tệp.") from exc
    return {"id": row["id"], "name": row["name"], "headers": parsed.headers, "rows": parsed.preview_rows, "totalRows": parsed.row_count}


@router.get("/{file_id}/download")
async def download_file(file_id: str, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    row = _get_file_for_read(db, file_id, current_user)
    content = _storage_bytes(StorageService(db).download_bytes(row["path"]))
    return Response(
        content=content,
        media_type=row.get("mime_type") or "application/octet-stream",
        headers=safe_attachment_headers(str(row.get("name") or "excelai-file.xlsx")),
    )


@router.patch("/{file_id}/metadata")
async def update_file_metadata(file_id: str, payload: FileMetadataUpdate, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    row = _get_file_for_delete(db, file_id, current_user)
    update: dict = {}
    if payload.name is not None:
        new_name = payload.name.strip()
        _validate_filename(new_name)
        if not new_name:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Tên file không được để trống.")
        update["name"] = new_name
    if payload.dataLabel is not None:
        update["data_label"] = payload.dataLabel.strip()[:80] or "File nguồn"
    if payload.category is not None:
        update["category"] = payload.category.strip()[:60] or "source"
    if payload.isImportant is not None:
        update["is_important"] = bool(payload.isImportant)
    if not update:
        return _file_payload(row)
    rows = db.table("files").update(update).eq("id", file_id).execute().data or []
    updated = rows[0] if rows else {**row, **update}
    await log_operation(db, current_user["id"], "file", f"Cập nhật metadata file {updated.get('name') or row.get('name')}")
    return _file_payload(updated)


@router.delete("/{file_id}")
async def delete_file(file_id: str, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    row = _get_file_for_delete(db, file_id, current_user)
    try:
        StorageService(db).remove([row["path"]])
    except Exception:
        pass
    db.table("files").delete().eq("id", file_id).execute()
    await log_operation(db, current_user["id"], "file", f"Xóa file {row['name']}")
    db.table("operation_logs").insert(
        {
            "user_id": current_user["id"],
            "type": "file_audit",
            "action": f"file_deleted id={file_id} workspace={row.get('workspace_id') or ''} owner={row.get('user_id')}",
        }
    ).execute()
    return {"success": True, "message": "Đã xóa tệp thành công"}
