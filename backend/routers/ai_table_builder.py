from __future__ import annotations

import csv
import io
import json
import math
import re
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from dependencies import get_current_user, get_db
from entitlements import require_entitlement
from services.excel_service import build_statistics, format_file_size, parse_workbook, to_number
from services.gemini_service import generate_json
from services.log_service import log_operation
from services.output_service import XLSX_CONTENT_TYPE, build_xlsx, safe_download_name, store_output
from services.permission_service import can_read_file, can_read_output
from services.quota_service import check_and_increment, mark_failed_usage
from services.storage_service import StorageService


router = APIRouter(prefix="/api/ai-table-builder", tags=["ai-table-builder"])

CSV_CONTENT_TYPE = "text/csv"

SYSTEM_PROMPT = """
Bạn là AI Table Builder của ExcelAI.
Tạo schema bảng và dữ liệu theo yêu cầu người dùng.
Không dùng dữ liệu cố định. Dữ liệu mẫu chỉ được sinh theo DESCRIPTION và CONFIG.
Nếu SOURCE_CONTEXT có dữ liệu file thật thì phải bám theo cột/dòng thật.
Trả lời ONLY JSON hợp lệ:
{
  "title": "Tên bảng",
  "columns": [
    {"key": "customerId", "label": "Mã khách hàng", "type": "text", "required": true}
  ],
  "rows": [
    {"customerId": "KH0001"}
  ],
  "formulas": [
    {"column": "total", "expression": "=quantity*unitPrice", "description": "Thành tiền"}
  ],
  "notes": "Ghi chú",
  "confidence": 0-100
}
"""


class ExternalApiConfig(BaseModel):
    endpoint: str = ""
    method: str = "GET"
    headers: dict[str, str] = Field(default_factory=dict)
    body: Any = None


class TableSource(BaseModel):
    type: str = "ai_generated"
    fileId: str | None = None
    sheetName: str | None = None
    externalApi: ExternalApiConfig | None = None


class TableColumn(BaseModel):
    name: str
    type: str = "text"
    required: bool = False


class GenerateTableRequest(BaseModel):
    description: str = Field(min_length=1, max_length=4000)
    tableType: str = "custom"
    mode: str = Field(default="ai_generated", pattern="^(empty|ai_generated|workspace_file|external_api)$")
    rowCount: int = Field(default=20, ge=0, le=1000)
    language: str = "vi"
    dateFormat: str = "DD/MM/YYYY"
    autoFormula: bool = True
    normalizeColumns: bool = True
    source: TableSource | None = None
    columns: list[TableColumn] = Field(default_factory=list)


class ExportTableRequest(BaseModel):
    format: str = Field(pattern="^(csv|xlsx)$")


def _storage_bytes(payload) -> bytes:
    if isinstance(payload, bytes):
        return payload
    if hasattr(payload, "content"):
        return payload.content
    if isinstance(payload, str):
        return payload.encode("utf-8")
    return bytes(payload)


def _json_value(value, default):
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return default
    return default


def _safe_key(label: str, fallback: str) -> str:
    text = re.sub(r"[^A-Za-z0-9]+", " ", label or "").strip()
    if not text:
        return fallback
    parts = text.split()
    key = parts[0].lower() + "".join(part[:1].upper() + part[1:].lower() for part in parts[1:])
    return key or fallback


def _normalize_columns(raw_columns: list[dict] | list[str]) -> list[dict]:
    columns = []
    seen = set()
    for index, item in enumerate(raw_columns):
        if isinstance(item, dict):
            label = str(item.get("label") or item.get("name") or item.get("key") or f"Cột {index + 1}")
            key = str(item.get("key") or _safe_key(label, f"col{index + 1}"))
            col_type = str(item.get("type") or "text")
            required = bool(item.get("required"))
        else:
            label = str(item or f"Cột {index + 1}")
            key = _safe_key(label, f"col{index + 1}")
            col_type = "text"
            required = False
        base = key
        suffix = 2
        while key in seen:
            key = f"{base}{suffix}"
            suffix += 1
        seen.add(key)
        columns.append({"key": key, "label": label, "type": col_type, "required": required})
    return columns


def _rows_from_lists(columns: list[dict], rows: list[list[str]]) -> list[dict]:
    output = []
    for row in rows:
        output.append({column["key"]: row[index] if index < len(row) else "" for index, column in enumerate(columns)})
    return output


def _rows_to_lists(columns: list[dict], rows: list[dict]) -> list[list[Any]]:
    return [[row.get(column["key"], "") for column in columns] for row in rows]


def _get_file_for_read(db, file_id: str, current_user: dict) -> dict:
    rows = db.table("files").select("*").eq("id", file_id).limit(1).execute().data or []
    if not rows or not can_read_file(db, current_user, rows[0]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tệp nguồn.")
    return rows[0]


def _detect_type(values: list[Any]) -> str:
    filled = [str(value).strip() for value in values if str(value or "").strip()]
    if not filled:
        return "text"
    email_count = sum(1 for value in filled if re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", value))
    phone_count = sum(1 for value in filled if re.match(r"^\+?[0-9]{9,15}$", re.sub(r"[\s\-\(\)]", "", value)))
    number_count = sum(1 for value in filled if math.isfinite(to_number(value)) and re.search(r"\d", value))
    if email_count / len(filled) >= 0.6:
        return "email"
    if phone_count / len(filled) >= 0.6:
        return "phone"
    if number_count / len(filled) >= 0.7:
        return "number"
    if len(set(filled)) <= max(12, len(filled) * 0.35):
        return "category"
    return "text"


def _workspace_file_table(db, current_user: dict, payload: GenerateTableRequest) -> tuple[dict, dict]:
    source = payload.source or TableSource(type="workspace_file")
    if not source.fileId:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Vui lòng chọn file workspace.")
    file_row = _get_file_for_read(db, source.fileId, current_user)
    content = _storage_bytes(StorageService(db).download_bytes(file_row["path"]))
    parsed = parse_workbook(file_row["name"], content, source.sheetName)
    columns = _normalize_columns([{"label": header, "type": _detect_type([row[idx] if idx < len(row) else "" for row in parsed.rows])} for idx, header in enumerate(parsed.headers)])
    rows = _rows_from_lists(columns, parsed.rows[: payload.rowCount or len(parsed.rows)])
    context = {
        "fileName": file_row.get("name"),
        "sheetName": source.sheetName or "CSV",
        "statistics": build_statistics(parsed.headers, parsed.rows, parsed.row_count),
    }
    return {"title": payload.description[:80] or file_row.get("name"), "columns": columns, "rows": rows, "formulas": [], "notes": "Bảng được tạo từ file thật trong workspace.", "confidence": 96}, context


def _flatten(value: Any, prefix: str = "") -> dict[str, Any]:
    if isinstance(value, dict):
        output = {}
        for key, child in value.items():
            child_key = f"{prefix}.{key}" if prefix else str(key)
            output.update(_flatten(child, child_key))
        return output
    if isinstance(value, list):
        return {prefix or "value": json.dumps(value, ensure_ascii=False)}
    return {prefix or "value": value}


async def _external_api_table(payload: GenerateTableRequest) -> tuple[dict, dict]:
    config = (payload.source or TableSource(type="external_api")).externalApi
    if not config or not config.endpoint:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Vui lòng nhập API endpoint.")
    method = config.method.upper()
    if method not in {"GET", "POST"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Method API chỉ hỗ trợ GET/POST.")
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.request(method, config.endpoint, headers=config.headers or {}, json=config.body if method == "POST" else None)
        response.raise_for_status()
        text = response.text
        content_type = response.headers.get("content-type", "")
    if "json" in content_type:
        data = response.json()
        if isinstance(data, dict):
            first_list = next((value for value in data.values() if isinstance(value, list)), None)
            data = first_list if first_list is not None else [data]
        if not isinstance(data, list):
            data = [data]
        flat_rows = [_flatten(item) for item in data[: payload.rowCount or 100]]
    else:
        reader = csv.DictReader(io.StringIO(text))
        flat_rows = [dict(row) for row in list(reader)[: payload.rowCount or 100]]
    labels = list(dict.fromkeys(key for row in flat_rows for key in row.keys()))
    columns = _normalize_columns([{"label": label, "type": _detect_type([row.get(label, "") for row in flat_rows])} for label in labels])
    rows = [{column["key"]: row.get(column["label"], "") for column in columns} for row in flat_rows]
    return {"title": payload.description[:80] or "Bảng từ API thật", "columns": columns, "rows": rows, "formulas": [], "notes": "Bảng được tạo từ API thật.", "confidence": 90}, {"endpoint": config.endpoint}


async def _ai_generated_table(current_user: dict, db, payload: GenerateTableRequest) -> tuple[dict, dict]:
    ai_input = {
        "DESCRIPTION": payload.description,
        "CONFIG": {
            "tableType": payload.tableType,
            "rowCount": 0 if payload.mode == "empty" else payload.rowCount,
            "language": payload.language,
            "dateFormat": payload.dateFormat,
            "autoFormula": payload.autoFormula,
            "normalizeColumns": payload.normalizeColumns,
            "columns": [column.model_dump() for column in payload.columns],
            "mode": payload.mode,
        },
    }
    try:
        result = await generate_json(SYSTEM_PROMPT, json.dumps(ai_input, ensure_ascii=False))
    except HTTPException:
        await mark_failed_usage(current_user["id"], "table_builder")
        raise
    except Exception as exc:
        await mark_failed_usage(current_user["id"], "table_builder")
        detail = getattr(exc, "detail", str(exc))
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"AI provider chưa phản hồi: {detail}") from exc
    if not isinstance(result.get("columns"), list) or not result["columns"]:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI không trả về schema cột hợp lệ.")
    columns = _normalize_columns(result.get("columns"))
    rows_raw = result.get("rows") if isinstance(result.get("rows"), list) else []
    rows = []
    for item in rows_raw[: (0 if payload.mode == "empty" else payload.rowCount)]:
        if isinstance(item, dict):
            rows.append({column["key"]: item.get(column["key"], item.get(column["label"], "")) for column in columns})
        elif isinstance(item, list):
            rows.append({column["key"]: item[index] if index < len(item) else "" for index, column in enumerate(columns)})
    return {
        "title": str(result.get("title") or payload.description[:80] or "Bảng AI"),
        "columns": columns,
        "rows": rows,
        "formulas": result.get("formulas") if payload.autoFormula and isinstance(result.get("formulas"), list) else [],
        "notes": str(result.get("notes") or "Bảng được sinh qua backend AI."),
        "confidence": max(0, min(100, int(result.get("confidence") or 88))),
    }, {}


def _table_document(base: dict, payload: GenerateTableRequest, context: dict | None = None) -> dict:
    created_at = datetime.now(timezone.utc).isoformat()
    columns = base["columns"]
    rows = base["rows"]
    return {
        "tableId": str(uuid4()),
        "status": "completed",
        "title": str(base.get("title") or "Bảng AI")[:180],
        "columns": columns,
        "rows": rows,
        "totalRows": len(rows),
        "totalColumns": len(columns),
        "confidence": int(base.get("confidence") or 88),
        "estimatedTime": max(6, min(90, int((len(rows) * max(1, len(columns))) / 80) + 10)),
        "createdAt": created_at,
        "formulas": base.get("formulas") or [],
        "notes": base.get("notes") or "",
        "config": payload.model_dump(),
        "context": context or {},
    }


def _store_table(db, current_user: dict, table: dict, source_file_id: str | None = None, workspace_id: str | None = None) -> dict:
    safe_name = safe_download_name(table.get("title") or "ai-table", "json")
    storage_path = f"{current_user['id']}/ai-tables/{table['tableId']}_{safe_name}"
    StorageService(db).upload_bytes(storage_path, json.dumps(table, ensure_ascii=False).encode("utf-8"), "application/json")
    row = {
        "id": table["tableId"],
        "user_id": current_user["id"],
        "source_file_id": source_file_id,
        "output_type": "json",
        "operation_type": "ai_table_builder",
        "display_name": safe_name,
        "storage_path": storage_path,
        "content_type": "application/json",
        "metadata": json.dumps({"title": table["title"], "rows": table["totalRows"], "columns": table["totalColumns"], "confidence": table["confidence"]}, ensure_ascii=False),
        "workspace_id": workspace_id,
        "created_at": table["createdAt"],
    }
    response = db.table("output_files").insert(row).execute()
    return response.data[0] if response.data else row


def _public_file_row(row: dict) -> dict:
    return {k: v for k, v in row.items() if k != "path"}


def _get_table_row(db, table_id: str, current_user: dict) -> dict:
    rows = db.table("output_files").select("*").eq("id", table_id).limit(1).execute().data or []
    if not rows or not can_read_output(db, current_user, rows[0]) or rows[0].get("operation_type") != "ai_table_builder":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bảng.")
    return rows[0]


def _read_table(db, row: dict) -> dict:
    content = _storage_bytes(StorageService(db).download_bytes(row["storage_path"]))
    return json.loads(content.decode("utf-8"))


@router.post("/generate")
async def generate_table(payload: GenerateTableRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    require_entitlement(current_user, "can_use_report_builder")
    await check_and_increment(current_user["id"], db, "table_builder")
    source_file_id = None
    workspace_id = None
    if payload.mode == "workspace_file":
        base, context = _workspace_file_table(db, current_user, payload)
        source_file_id = (payload.source or TableSource()).fileId
        if source_file_id:
            workspace_id = _get_file_for_read(db, source_file_id, current_user).get("workspace_id")
    elif payload.mode == "external_api":
        base, context = await _external_api_table(payload)
    else:
        base, context = await _ai_generated_table(current_user, db, payload)
    table = _table_document(base, payload, context)
    _store_table(db, current_user, table, source_file_id, workspace_id)
    await log_operation(db, current_user["id"], "table", f"AI Table Builder: {table['title'][:100]}")
    return table


@router.get("/history")
async def table_history(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    rows = db.fetch(
        """
        SELECT id, metadata, created_at, source_file_id
        FROM output_files
        WHERE user_id = %s AND operation_type = 'ai_table_builder'
        ORDER BY created_at DESC
        LIMIT 50
        """,
        [current_user["id"]],
    )
    return {"items": [{"tableId": row["id"], "createdAt": row.get("created_at"), "sourceFileId": row.get("source_file_id"), **_json_value(row.get("metadata"), {})} for row in rows]}


@router.get("/{table_id}")
async def get_table(table_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    return _read_table(db, _get_table_row(db, table_id, current_user))


@router.post("/{table_id}/export")
async def export_table(table_id: str, payload: ExportTableRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    row = _get_table_row(db, table_id, current_user)
    table = _read_table(db, row)
    headers = [column["label"] for column in table["columns"]]
    data_rows = _rows_to_lists(table["columns"], table["rows"])
    if payload.format == "xlsx":
        require_entitlement(current_user, "can_export_xlsx")
        content = build_xlsx({table["title"][:31]: (headers, data_rows)})
        output = store_output(db, current_user["id"], content, f"{table['title']}.xlsx", "xlsx", "ai_table_builder_export", XLSX_CONTENT_TYPE, row.get("source_file_id"), {"tableId": table_id, "title": table["title"]}, row.get("workspace_id"))
    else:
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(headers)
        writer.writerows(data_rows)
        content = ("\ufeff" + buffer.getvalue()).encode("utf-8")
        output = store_output(db, current_user["id"], content, f"{table['title']}.csv", "csv", "ai_table_builder_export", CSV_CONTENT_TYPE, row.get("source_file_id"), {"tableId": table_id, "title": table["title"]}, row.get("workspace_id"))
    return {"downloadUrl": f"/api/exports/{output['id']}/download", "output": {k: v for k, v in output.items() if k != "storage_path"}}


@router.post("/{table_id}/save-to-workspace")
async def save_table_to_workspace(table_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    output_row = _get_table_row(db, table_id, current_user)
    table = _read_table(db, output_row)
    headers = [column["label"] for column in table["columns"]]
    data_rows = _rows_to_lists(table["columns"], table["rows"])
    content = build_xlsx({table["title"][:31]: (headers, data_rows)})
    file_id = str(uuid4())
    file_name = safe_download_name(table["title"], "xlsx")
    storage_prefix = f"workspaces/{output_row.get('workspace_id')}" if output_row.get("workspace_id") else current_user["id"]
    storage_path = f"{storage_prefix}/{file_id}_{file_name}"
    StorageService(db).upload_bytes(storage_path, content, XLSX_CONTENT_TYPE)
    metadata = {
        "id": file_id,
        "user_id": current_user["id"],
        "name": file_name,
        "path": storage_path,
        "size": format_file_size(len(content)),
        "size_bytes": len(content),
        "row_count": len(data_rows),
        "col_count": len(headers),
        "status": "ready",
        "error_message": "",
        "mime_type": XLSX_CONTENT_TYPE,
        "sheet_count": 1,
        "sheet_names": json.dumps([table["title"][:31]], ensure_ascii=False),
        "columns_metadata": json.dumps(build_statistics(headers, data_rows, len(data_rows)).get("columns", []), ensure_ascii=False),
        "workspace_id": output_row.get("workspace_id"),
        "data_label": "AI Table Builder",
        "category": "generated",
        "version_number": 1,
        "is_important": False,
    }
    rows = db.table("files").insert(metadata).execute().data or []
    await log_operation(db, current_user["id"], "file", f"Lưu bảng AI vào workspace: {file_name[:120]}")
    return {"success": True, "file": _public_file_row(rows[0] if rows else metadata)}
