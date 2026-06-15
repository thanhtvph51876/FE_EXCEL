from __future__ import annotations

import json
import math
import re
from collections import Counter
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response

from dependencies import get_current_user, get_db
from entitlements import require_entitlement
from metrics import increment_business_metric
from services.excel_service import build_statistics, format_file_size, list_workbook_sheets, parse_workbook, to_number
from services.http_headers import safe_attachment_headers
from services.log_service import log_operation
from services.output_service import XLSX_CONTENT_TYPE, build_xlsx, safe_download_name
from services.permission_service import can_read_file
from services.storage_service import StorageService


router = APIRouter(tags=["data-cleaning"])

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
VN_PHONE_RE = re.compile(r"^(\+84|0)(3|5|7|8|9)\d{8}$")
SPECIAL_RE = re.compile(r"[^\w\s@.\-+/%:,À-ỹ]", re.UNICODE)
PREVIEW_JOBS: dict[str, dict] = {}


def _storage_bytes(payload) -> bytes:
    if isinstance(payload, bytes):
        return payload
    if hasattr(payload, "content"):
        return payload.content
    if isinstance(payload, str):
        return payload.encode("utf-8")
    return bytes(payload)


def _get_file_for_read(db, file_id: str, current_user: dict) -> dict:
    rows = db.table("files").select("*").eq("id", file_id).limit(1).execute().data or []
    if not rows or not can_read_file(db, current_user, rows[0]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tệp nguồn.")
    return rows[0]


def _read_file(db, row: dict) -> bytes:
    return _storage_bytes(StorageService(db).download_bytes(row["path"]))


def _parse_file(db, file_id: str, current_user: dict, sheet_name: str | None = None):
    row = _get_file_for_read(db, file_id, current_user)
    try:
        parsed = parse_workbook(row["name"], _read_file(db, row), sheet_name)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không thể đọc dữ liệu file thật.") from exc
    return row, parsed


def _column_type(header: str, values: list[str]) -> str:
    name = header.lower()
    non_empty = [value for value in values if str(value).strip()]
    if "email" in name or "mail" in name or any(EMAIL_RE.match(value.strip().lower()) for value in non_empty[:50]):
        return "email"
    if "phone" in name or "điện thoại" in name or "sdt" in name or "số điện" in name:
        return "phone"
    if "ngày" in name or "date" in name or "birth" in name:
        return "date"
    if "tiền" in name or "amount" in name or "price" in name or "doanh thu" in name:
        return "currency"
    if "%" in name or "percent" in name or "tỷ lệ" in name:
        return "percentage"
    numeric = sum(1 for value in non_empty if to_number(value) != 0 or str(value).strip() in {"0", "0.0"})
    if non_empty and numeric / max(1, len(non_empty)) >= 0.7:
        return "number"
    if non_empty and len(set(non_empty)) <= max(10, len(non_empty) * 0.2):
        return "category"
    return "text"


def _parse_date(value: str) -> datetime | None:
    for fmt in ("%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(value.strip(), fmt)
        except ValueError:
            continue
    return None


def _format_date(value: datetime, fmt: str) -> str:
    mapping = {"YYYY-MM-DD": "%Y-%m-%d", "DD/MM/YYYY": "%d/%m/%Y", "MM/DD/YYYY": "%m/%d/%Y"}
    return value.strftime(mapping.get(fmt, "%Y-%m-%d"))


def _normalize_phone(value: str, country: str = "VN") -> str:
    raw = re.sub(r"[^\d+]", "", value.strip())
    if country.upper() == "VN":
        if raw.startswith("0084"):
            raw = "+" + raw[2:]
        elif raw.startswith("84"):
            raw = "+" + raw
        elif raw.startswith("0"):
            raw = "+84" + raw[1:]
    return raw


def _title_case_vi(value: str) -> str:
    return " ".join(part[:1].upper() + part[1:].lower() for part in value.strip().split())


def _most_frequent(values: list[str]) -> str:
    counter = Counter(value for value in values if value != "")
    return counter.most_common(1)[0][0] if counter else ""


def _clean_cell(value: str, header: str, col_type: str, rules: dict, options: dict, column_values: list[str]) -> tuple[str, list[dict], list[dict]]:
    before = str(value or "")
    after = before
    changes: list[dict] = []
    errors: list[dict] = []

    def change(rule: str, new_value: str) -> None:
        nonlocal after
        if new_value != after:
            changes.append({"column": header, "rule": rule, "before": after, "after": new_value})
            after = new_value

    if rules.get("trimWhitespace"):
        change("trimWhitespace", re.sub(r"\s+", " ", after).strip())
    if not after:
        errors.append({"type": "missing_value", "label": "Giá trị thiếu"})
        if rules.get("fillMissingValues"):
            strategy = options.get("missingValueStrategy") or "keep_empty"
            if strategy == "default_value":
                change("fillMissingValues", str(options.get("defaultValue") or "N/A"))
            elif strategy == "most_frequent":
                change("fillMissingValues", _most_frequent(column_values))
            elif strategy in {"mean", "median"} and col_type in {"number", "currency", "percentage"}:
                numbers = sorted(to_number(item) for item in column_values if str(item).strip())
                if numbers:
                    value_num = sum(numbers) / len(numbers) if strategy == "mean" else numbers[len(numbers) // 2]
                    change("fillMissingValues", str(round(value_num, 2)))
    if rules.get("normalizeEmail") and col_type == "email":
        normalized = after.strip().lower()
        change("normalizeEmail", normalized)
        if normalized and not EMAIL_RE.match(normalized):
            errors.append({"type": "invalid_email", "label": "Email không hợp lệ"})
    if rules.get("normalizePhone") and col_type == "phone":
        normalized = _normalize_phone(after, options.get("phoneCountry") or "VN")
        change("normalizePhone", normalized)
        if normalized and not VN_PHONE_RE.match(normalized):
            errors.append({"type": "invalid_phone", "label": "SĐT không hợp lệ"})
    if rules.get("normalizeDate") and col_type == "date":
        parsed = _parse_date(after)
        if parsed:
            change("normalizeDate", _format_date(parsed, options.get("dateFormat") or "YYYY-MM-DD"))
        elif after:
            errors.append({"type": "invalid_date", "label": "Ngày sai định dạng"})
    if rules.get("normalizeNumber") and col_type == "number" and after:
        change("normalizeNumber", str(to_number(after)))
    if rules.get("normalizeCurrency") and col_type == "currency" and after:
        change("normalizeCurrency", str(to_number(after)))
    if rules.get("normalizePercentage") and col_type == "percentage" and after:
        text = after.replace("%", "").strip()
        number = to_number(text)
        change("normalizePercentage", str(round(number / 100, 4) if "%" in after else number))
    if rules.get("normalizeStatus") and col_type == "category" and after:
        status_map = {"active": "Active", "inactive": "Inactive", "yes": "Yes", "no": "No", "true": "True", "false": "False"}
        change("normalizeStatus", status_map.get(after.strip().lower(), _title_case_vi(after)))
    if rules.get("normalizeCase") and col_type in {"text", "category"} and after:
        change("normalizeCase", _title_case_vi(after))
    if rules.get("removeSpecialCharacters") and col_type not in {"email", "phone"} and after:
        new_value = SPECIAL_RE.sub("", after)
        if new_value != after:
            errors.append({"type": "special_character", "label": "Ký tự đặc biệt"})
            change("removeSpecialCharacters", new_value)
    return after, changes, errors


def _duplicate_indexes(rows: list[list[str]], strategy: str) -> set[int]:
    buckets: dict[str, list[int]] = {}
    for idx, row in enumerate(rows):
        key = json.dumps([str(cell).strip().lower() for cell in row], ensure_ascii=False)
        buckets.setdefault(key, []).append(idx)
    remove: set[int] = set()
    for indexes in buckets.values():
        if len(indexes) <= 1:
            continue
        if strategy == "keep_last":
            remove.update(indexes[:-1])
        elif strategy == "remove_all":
            remove.update(indexes)
        else:
            remove.update(indexes[1:])
    return remove


def _clean_dataset(headers: list[str], rows: list[list[str]], selected_columns: list[str], rules: dict, options: dict, page: int, limit: int) -> dict:
    selected = [column for column in selected_columns if column in headers] or headers
    col_indexes = [headers.index(column) for column in selected]
    column_values = {header: [row[idx] if idx < len(row) else "" for row in rows] for idx, header in enumerate(headers)}
    column_types = {header: _column_type(header, values) for header, values in column_values.items()}
    duplicate_remove = _duplicate_indexes(rows, options.get("duplicateStrategy") or "keep_first") if rules.get("removeDuplicates") else set()
    preview_rows = []
    cleaned_rows: list[list[str]] = []
    error_counter: Counter[str] = Counter()
    error_labels: dict[str, str] = {}
    normalized_cells = 0
    missing_values = 0
    for row_idx, row in enumerate(rows):
        padded = row[:] + [""] * max(0, len(headers) - len(row))
        after_row = padded[: len(headers)]
        row_changes: list[dict] = []
        row_errors: list[dict] = []
        for col_idx in col_indexes:
            header = headers[col_idx]
            value = padded[col_idx] if col_idx < len(padded) else ""
            if value == "":
                missing_values += 1
            after, changes, errors = _clean_cell(value, header, column_types[header], rules, options, column_values[header])
            after_row[col_idx] = after
            row_changes.extend(changes)
            row_errors.extend(errors)
        if row_idx in duplicate_remove:
            row_errors.append({"type": "duplicate_row", "label": "Dòng trùng"})
        for error in row_errors:
            error_counter[error["type"]] += 1
            error_labels[error["type"]] = error["label"]
        normalized_cells += len(row_changes)
        if options.get("missingValueStrategy") == "remove_row" and any(not after_row[idx] for idx in col_indexes):
            continue
        if row_idx not in duplicate_remove:
            cleaned_rows.append(after_row)
        if row_changes or row_errors:
            preview_rows.append(
                {
                    "rowIndex": row_idx + 2,
                    "before": {headers[i]: padded[i] if i < len(padded) else "" for i in range(len(headers))},
                    "after": {headers[i]: after_row[i] if i < len(after_row) else "" for i in range(len(headers))},
                    "changes": row_changes,
                    "errors": row_errors,
                }
            )
    total_errors = sum(error_counter.values())
    breakdown = [
        {"type": key, "label": error_labels.get(key, key), "count": count, "percent": round(count * 100 / max(1, total_errors), 1)}
        for key, count in error_counter.most_common()
    ]
    total_cells = max(1, len(rows) * max(1, len(headers)))
    quality_before = max(0, round(100 - (total_errors * 100 / total_cells), 1))
    quality_after = min(100, round(quality_before + (normalized_cells * 100 / total_cells), 1))
    start = (page - 1) * limit
    insights = []
    for item in breakdown[:4]:
        insights.append(f"Phát hiện {item['count']} {item['label'].lower()}.")
    if rules.get("removeDuplicates") and len(duplicate_remove):
        insights.append(f"Đã loại bỏ {len(duplicate_remove)} dòng trùng theo chiến lược đã chọn.")
    if normalized_cells:
        insights.append(f"Đã chuẩn hóa {normalized_cells} ô dữ liệu từ file thật.")
    if not insights:
        insights.append("Chưa phát hiện lỗi nổi bật trong phạm vi cột đã chọn.")
    return {
        "summary": {
            "totalRows": len(rows),
            "totalColumns": len(headers),
            "errorsFound": total_errors,
            "duplicateRows": len(duplicate_remove),
            "normalizedCells": normalized_cells,
            "missingValues": missing_values,
            "qualityBefore": quality_before,
            "qualityAfter": quality_after,
            "confidence": min(99, max(70, round(quality_after))),
            "estimatedTime": max(1, min(120, math.ceil(len(rows) * max(1, len(col_indexes)) / 250))),
            "rowsAfter": len(cleaned_rows),
        },
        "errorBreakdown": breakdown,
        "previewRows": preview_rows[start : start + limit],
        "insights": insights,
        "cleanedRows": cleaned_rows,
    }


@router.get("/api/workspace/files/{file_id}/columns")
async def workspace_file_columns(file_id: str, sheetName: str | None = None, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    _, parsed = _parse_file(db, file_id, current_user, sheetName)
    stats = build_statistics(parsed.headers, parsed.rows, len(parsed.rows))
    columns = []
    for index, header in enumerate(parsed.headers):
        values = [row[index] if index < len(row) else "" for row in parsed.rows]
        col_type = _column_type(header, values)
        invalid = 0
        if col_type == "email":
            invalid = sum(1 for value in values if value and not EMAIL_RE.match(value.strip().lower()))
        elif col_type == "phone":
            invalid = sum(1 for value in values if value and not VN_PHONE_RE.match(_normalize_phone(value)))
        elif col_type == "date":
            invalid = sum(1 for value in values if value and not _parse_date(value))
        stat = next((item for item in stats["columns"] if item["name"] == header), {})
        columns.append({"key": header, "label": header, "type": col_type, "missingCount": stat.get("missingCount", 0), "invalidCount": invalid})
    return {"fileId": file_id, "sheetName": sheetName or "CSV", "columns": columns}


@router.get("/api/workspace/files/{file_id}/download")
async def workspace_file_download(file_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    row = _get_file_for_read(db, file_id, current_user)
    content = _read_file(db, row)
    return Response(
        content=content,
        media_type=row.get("mime_type") or "application/octet-stream",
        headers=safe_attachment_headers(str(row.get("name") or "excelai-file.xlsx")),
    )


@router.post("/api/data-cleaning/preview")
async def data_cleaning_preview(payload: dict, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    require_entitlement(current_user, "can_use_clean")
    file_id = str(payload.get("fileId") or "")
    if not file_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Vui lòng chọn file nguồn.")
    source, parsed = _parse_file(db, file_id, current_user, payload.get("sheetName"))
    selected_columns = payload.get("selectedColumns") or []
    rules = payload.get("rules") or {}
    if not selected_columns:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Vui lòng chọn ít nhất một cột.")
    if not any(bool(value) for value in rules.values()):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Vui lòng chọn ít nhất một quy tắc làm sạch.")
    options = payload.get("options") or {}
    page = int(payload.get("page") or 1)
    limit = min(100, int(payload.get("limit") or 20))
    result = _clean_dataset(parsed.headers, parsed.rows, selected_columns, rules, options, page, limit)
    job_id = f"clean_preview_{uuid4()}"
    PREVIEW_JOBS[job_id] = {
        "userId": current_user["id"],
        "fileId": file_id,
        "fileName": source.get("name"),
        "workspaceId": source.get("workspace_id"),
        "sheetName": payload.get("sheetName"),
        "headers": parsed.headers,
        "cleanedRows": result.pop("cleanedRows"),
        "summary": result["summary"],
        "rules": rules,
        "options": options,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    return {"jobId": job_id, "status": "completed", **result}


@router.post("/api/data-cleaning/apply")
async def data_cleaning_apply(payload: dict, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    require_entitlement(current_user, "can_use_clean")
    job_id = str(payload.get("previewJobId") or "")
    job = PREVIEW_JOBS.get(job_id)
    if not job or job.get("userId") != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy preview job. Hãy chạy lại xem trước.")
    save_mode = payload.get("saveMode") or "new_file"
    if save_mode != "new_file":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Ghi đè file gốc chưa được bật. Hãy lưu thành file mới.")
    file_name = safe_download_name(payload.get("outputFileName") or f"cleaned_{job['fileName']}", "xlsx")
    content = build_xlsx(
        {
            "Cleaned Data": (job["headers"], job["cleanedRows"]),
            "Cleaning Summary": (["Metric", "Value"], [[key, value] for key, value in job["summary"].items()]),
        }
    )
    file_id = str(uuid4())
    storage_prefix = f"workspaces/{job.get('workspaceId')}" if job.get("workspaceId") else current_user["id"]
    storage_path = f"{storage_prefix}/{file_id}_{file_name}"
    StorageService(db).upload_bytes(storage_path, content, XLSX_CONTENT_TYPE)
    metadata = {
        "id": file_id,
        "user_id": current_user["id"],
        "name": file_name,
        "path": storage_path,
        "size": format_file_size(len(content)),
        "size_bytes": len(content),
        "row_count": len(job["cleanedRows"]),
        "col_count": len(job["headers"]),
        "status": "ready",
        "error_message": "",
        "mime_type": XLSX_CONTENT_TYPE,
        "sheet_count": 2,
        "sheet_names": json.dumps(["Cleaned Data", "Cleaning Summary"], ensure_ascii=False),
        "columns_metadata": json.dumps(build_statistics(job["headers"], job["cleanedRows"], len(job["cleanedRows"])).get("columns", []), ensure_ascii=False),
        "workspace_id": job.get("workspaceId"),
        "data_label": "Cleaned Data",
        "category": "cleaned",
        "version_number": 1,
        "is_important": False,
    }
    rows = db.table("files").insert(metadata).execute().data or []
    db.table("operation_logs").insert({"user_id": current_user["id"], "type": "cleaning", "action": f"data_cleaning_apply: {file_name}"}).execute()
    await log_operation(db, current_user["id"], "cleaning", f"Lưu file đã làm sạch: {file_name}")
    increment_business_metric(db, "data_cleaning_apply_count", 1, {"saveMode": save_mode})
    file_row = rows[0] if rows else metadata
    return {
        "cleanedFileId": file_id,
        "fileName": file_name,
        "downloadUrl": f"/api/files/{file_id}/download",
        "status": "completed",
        "summary": {"totalRows": len(job["cleanedRows"]), "normalizedCells": job["summary"].get("normalizedCells", 0), "removedDuplicates": job["summary"].get("duplicateRows", 0), "qualityAfter": job["summary"].get("qualityAfter", 0)},
        "file": {k: v for k, v in file_row.items() if k != "path"},
    }


@router.get("/api/data-cleaning/history")
async def data_cleaning_history(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    rows = db.fetch(
        """
        SELECT id, action, created_at
        FROM operation_logs
        WHERE user_id = %s AND type = 'cleaning'
        ORDER BY created_at DESC
        LIMIT 50
        """,
        [current_user["id"]],
    )
    return {"items": rows}


@router.get("/api/data-cleaning/jobs/{job_id}")
async def data_cleaning_job(job_id: str, current_user: dict = Depends(get_current_user)):
    job = PREVIEW_JOBS.get(job_id)
    if not job or job.get("userId") != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy job.")
    return {"jobId": job_id, "status": "completed", "summary": job.get("summary"), "createdAt": job.get("createdAt")}
