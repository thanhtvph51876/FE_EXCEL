from __future__ import annotations

import json
import math
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from dependencies import get_current_user, get_db
from services.excel_service import list_workbook_sheets, parse_workbook, to_number
from services.log_service import log_operation
from services.permission_service import can_read_file
from services.storage_service import StorageService


router = APIRouter(tags=["reports"])

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PHONE_RE = re.compile(r"^\+?[0-9]{9,15}$")
CATEGORY_PRIORITY = ("orgin", "org_in", "org", "role", "status", "department", "dept", "type", "category")
NUMBER_PRIORITY = ("amount", "revenue", "sales", "total", "price", "value", "qty", "quantity", "doanhthu", "doanh_thu", "tổng", "tong", "giá", "gia")


class AutoReportCreate(BaseModel):
    fileId: str
    sheetName: str | None = None


def _json_value(value: Any, default: Any) -> Any:
    if isinstance(value, (list, dict)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return default
    return default


def _file_payload(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "fileId": row.get("id"),
        "workspaceId": row.get("workspace_id"),
        "name": row.get("name"),
        "fileName": row.get("name"),
        "size": row.get("size"),
        "rowCount": row.get("row_count", 0),
        "colCount": row.get("col_count", 0),
        "status": row.get("status") or "ready",
        "uploadedAt": row.get("uploaded_at"),
        "sheetCount": row.get("sheet_count") or 1,
        "sheetNames": _json_value(row.get("sheet_names"), []),
    }


def _get_file_for_read(db, file_id: str, current_user: dict) -> dict:
    rows = db.table("files").select("*").eq("id", file_id).limit(1).execute().data or []
    if not rows or not can_read_file(db, current_user, rows[0]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tệp tin.")
    return rows[0]


def _read_file(db, row: dict) -> bytes:
    try:
        return StorageService(db).download_bytes(row["path"])
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Không thể tải file từ storage.") from exc


def _normalize_cell(value: Any) -> str:
    return str(value or "").strip()


def _normalize_row(row: list[str], width: int) -> tuple[str, ...]:
    values = [re.sub(r"\s+", " ", _normalize_cell(row[idx]).lower()) if idx < len(row) else "" for idx in range(width)]
    return tuple(values)


def _column_values(rows: list[list[str]], index: int) -> list[str]:
    return [_normalize_cell(row[index] if index < len(row) else "") for row in rows]


def _looks_like_email_header(header: str) -> bool:
    value = header.lower()
    return "email" in value or "mail" in value or "thư" in value


def _looks_like_phone_header(header: str) -> bool:
    value = header.lower()
    return any(key in value for key in ("phone", "tel", "mobile", "sdt", "sđt", "điện thoại"))


def _looks_like_date(value: str) -> bool:
    if not value:
        return False
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d"):
        try:
            datetime.strptime(value, fmt)
            return True
        except ValueError:
            continue
    return False


def _is_number(value: str) -> bool:
    if not value:
        return False
    cleaned = re.sub(r"[^\d,\.\-]", "", value)
    return cleaned not in ("", "-", ".", ",") and math.isfinite(to_number(value))


def _detect_column_types(headers: list[str], rows: list[list[str]]) -> list[dict]:
    types = []
    total = max(1, len(rows))
    for index, header in enumerate(headers):
        values = [value for value in _column_values(rows, index) if value]
        non_empty = max(1, len(values))
        unique_count = len(set(values))
        number_ratio = sum(1 for value in values if _is_number(value)) / non_empty
        date_ratio = sum(1 for value in values if _looks_like_date(value)) / non_empty
        email_ratio = sum(1 for value in values if EMAIL_RE.match(value)) / non_empty
        phone_ratio = sum(1 for value in values if PHONE_RE.match(re.sub(r"[\s\-\(\)]", "", value))) / non_empty
        lowered = header.lower()
        if _looks_like_email_header(header) or email_ratio >= 0.7:
            column_type = "email"
        elif _looks_like_phone_header(header) or phone_ratio >= 0.7:
            column_type = "phone"
        elif number_ratio >= 0.7:
            column_type = "number"
        elif date_ratio >= 0.7:
            column_type = "date"
        elif values and (unique_count <= max(12, total * 0.35) or any(key in lowered for key in CATEGORY_PRIORITY)):
            column_type = "category"
        else:
            column_type = "text"
        types.append({"name": header, "type": column_type, "nonEmpty": len(values), "unique": unique_count})
    return types


def _choose_category_column(headers: list[str], rows: list[list[str]], column_types: list[dict]) -> int | None:
    lowered = [header.lower().replace(" ", "") for header in headers]
    for key in CATEGORY_PRIORITY:
        for index, header in enumerate(lowered):
            if key in header:
                return index
    category_indexes = [idx for idx, item in enumerate(column_types) if item["type"] == "category"]
    if not category_indexes:
        return None
    return sorted(category_indexes, key=lambda idx: column_types[idx]["unique"])[0]


def _choose_number_column(headers: list[str], column_types: list[dict]) -> int | None:
    number_indexes = [idx for idx, item in enumerate(column_types) if item["type"] == "number"]
    if not number_indexes:
        return None
    normalized = [header.lower().replace(" ", "").replace("-", "_") for header in headers]
    for key in NUMBER_PRIORITY:
        for index in number_indexes:
            if key in normalized[index]:
                return index
    non_identifier = [
        index for index in number_indexes
        if not any(key in normalized[index] for key in ("id", "key", "code", "mã", "ma"))
    ]
    return non_identifier[0] if non_identifier else number_indexes[0]


def _build_report(row: dict, parsed, sheet_name: str | None) -> dict:
    headers = parsed.headers
    rows = parsed.rows
    total_rows = len(rows)
    total_columns = len(headers)
    total_cells = total_rows * total_columns
    missing_by_column: dict[str, int] = {}
    missing_cells = 0
    missing_rows = 0
    for data_row in rows:
        row_missing = 0
        for index, header in enumerate(headers):
            value = _normalize_cell(data_row[index] if index < len(data_row) else "")
            if value == "":
                missing_cells += 1
                row_missing += 1
                missing_by_column[header] = missing_by_column.get(header, 0) + 1
        if row_missing:
            missing_rows += 1

    seen: set[tuple[str, ...]] = set()
    duplicate_rows = 0
    for data_row in rows:
        key = _normalize_row(data_row, total_columns)
        if key in seen:
            duplicate_rows += 1
        else:
            seen.add(key)

    column_types = _detect_column_types(headers, rows)
    valid_email_count = invalid_email_count = valid_phone_count = invalid_phone_count = 0
    for index, item in enumerate(column_types):
        values = [value for value in _column_values(rows, index) if value]
        if item["type"] == "email":
            valid_email_count += sum(1 for value in values if EMAIL_RE.match(value))
            invalid_email_count += sum(1 for value in values if not EMAIL_RE.match(value))
        if item["type"] == "phone":
            cleaned_values = [re.sub(r"[\s\-\(\)]", "", value) for value in values]
            valid_phone_count += sum(1 for value in cleaned_values if PHONE_RE.match(value))
            invalid_phone_count += sum(1 for value in cleaned_values if not PHONE_RE.match(value))

    duplicate_percent = (duplicate_rows / total_rows * 100) if total_rows else 0
    missing_percent = (missing_cells / total_cells * 100) if total_cells else 0
    invalid_formats = invalid_email_count + invalid_phone_count
    format_checks = valid_email_count + invalid_email_count + valid_phone_count + invalid_phone_count
    invalid_format_percent = (invalid_formats / format_checks * 100) if format_checks else 0
    quality_score = max(0, min(100, 100 - missing_percent * 0.45 - duplicate_percent * 0.35 - invalid_format_percent * 0.2))

    number_index = _choose_number_column(headers, column_types)
    category_index = _choose_category_column(headers, rows, column_types)
    if number_index is not None:
        chart_data = [
            {"label": _normalize_cell(data_row[0] if data_row else "") or f"Dòng {idx + 2}", "value": to_number(data_row[number_index] if number_index < len(data_row) else "")}
            for idx, data_row in enumerate(rows[:20])
        ]
        chart_label = headers[number_index]
    elif category_index is not None:
        counts = Counter(value or "(Trống)" for value in _column_values(rows, category_index))
        chart_data = [{"label": label, "value": count} for label, count in counts.most_common(20)]
        chart_label = headers[category_index]
    else:
        chart_data = [{"label": header, "value": missing_by_column.get(header, 0)} for header in headers[:20]]
        chart_label = "Dữ liệu thiếu theo cột"

    distribution: list[dict] = []
    if category_index is not None:
        counts = Counter(value or "(Trống)" for value in _column_values(rows, category_index))
        distribution = [{"label": label, "value": count, "percent": round(count / max(1, total_rows) * 100, 2)} for label, count in counts.most_common(10)]

    insights = []
    if duplicate_rows:
        insights.append(f"Dữ liệu có {duplicate_rows} dòng trùng lặp, nên kiểm tra trước khi xuất báo cáo.")
    if missing_by_column:
        top_missing = sorted(missing_by_column.items(), key=lambda item: item[1], reverse=True)[:3]
        insights.extend([f"Cột {name} thiếu {count} giá trị." for name, count in top_missing if count])
    if invalid_email_count:
        insights.append(f"Cột email có {invalid_email_count} giá trị sai định dạng.")
    if invalid_phone_count:
        insights.append(f"Cột phone có {invalid_phone_count} giá trị sai định dạng.")
    if distribution:
        top_category = distribution[0]
        category_name = headers[category_index] if category_index is not None else "category"
        insights.append(f"Phân bố {category_name} tập trung chủ yếu ở {top_category['label']} ({top_category['percent']}%).")
    if not insights:
        insights.append(f"Sheet có {total_rows} dòng và {total_columns} cột, chưa phát hiện vấn đề nổi bật.")

    return {
        "fileId": row.get("id"),
        "fileName": row.get("name"),
        "sheetName": sheet_name or "CSV",
        "totalRows": total_rows,
        "totalColumns": total_columns,
        "duplicateRows": duplicate_rows,
        "duplicatePercent": round(duplicate_percent, 2),
        "missingCells": missing_cells,
        "missingRows": missing_rows,
        "missingByColumn": missing_by_column,
        "validEmailCount": valid_email_count,
        "invalidEmailCount": invalid_email_count,
        "validPhoneCount": valid_phone_count,
        "invalidPhoneCount": invalid_phone_count,
        "columnTypes": column_types,
        "qualityScore": round(quality_score, 1),
        "chartData": chart_data,
        "chartLabel": chart_label,
        "categoryDistribution": distribution,
        "insights": insights,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/api/workspace/files")
async def workspace_files(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    rows = db.fetch(
        """
        SELECT DISTINCT f.*
        FROM files f
        LEFT JOIN workspace_members wm
            ON wm.workspace_id = f.workspace_id
            AND wm.user_id = %s
            AND wm.status = 'active'
        WHERE (f.user_id = %s OR wm.id IS NOT NULL)
            AND COALESCE(f.status, 'ready') = 'ready'
        ORDER BY f.uploaded_at DESC
        """,
        [current_user["id"], current_user["id"]],
    )
    return [_file_payload(row) for row in rows]


@router.get("/api/workspace/files/{file_id}/sheets")
async def workspace_file_sheets(file_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    row = _get_file_for_read(db, file_id, current_user)
    content = _read_file(db, row)
    try:
        sheets = list_workbook_sheets(row["name"], content)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không thể đọc danh sách sheet của file.") from exc
    return {"fileId": file_id, "fileName": row.get("name"), "sheets": sheets}


@router.get("/api/workspace/files/{file_id}/preview")
async def workspace_file_preview(
    file_id: str,
    sheetName: str | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=200),
    search: str = "",
    sortBy: str = "",
    sortOrder: str = Query(default="asc", pattern="^(asc|desc)$"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    row = _get_file_for_read(db, file_id, current_user)
    content = _read_file(db, row)
    try:
        parsed = parse_workbook(row["name"], content, sheetName)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không thể đọc dữ liệu trong sheet.") from exc
    rows = parsed.rows
    headers = parsed.headers
    if search.strip():
        needle = search.strip().lower()
        rows = [data_row for data_row in rows if needle in " ".join(_normalize_cell(cell).lower() for cell in data_row)]
    if sortBy and sortBy in headers:
        index = headers.index(sortBy)
        rows = sorted(rows, key=lambda data_row: _normalize_cell(data_row[index] if index < len(data_row) else "").lower(), reverse=sortOrder == "desc")
    total_rows = len(rows)
    start = (page - 1) * limit
    page_rows = rows[start : start + limit]
    return {
        "fileId": file_id,
        "fileName": row.get("name"),
        "sheetName": sheetName or "CSV",
        "columns": headers,
        "headers": headers,
        "rows": page_rows,
        "page": page,
        "limit": limit,
        "totalRows": total_rows,
        "totalPages": math.ceil(total_rows / limit) if limit else 1,
    }


@router.get("/api/reports/auto")
async def get_auto_report(fileId: str, sheetName: str | None = None, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    row = _get_file_for_read(db, fileId, current_user)
    content = _read_file(db, row)
    try:
        parsed = parse_workbook(row["name"], content, sheetName)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không thể phân tích file báo cáo.") from exc
    return _build_report(row, parsed, sheetName)


@router.post("/api/reports/auto")
async def create_auto_report(payload: AutoReportCreate, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    report = await get_auto_report(payload.fileId, payload.sheetName, current_user, db)
    history_payload = {
        "fileId": report["fileId"],
        "fileName": str(report["fileName"] or "")[:70],
        "sheetName": str(report["sheetName"] or "")[:40],
        "totalRows": report["totalRows"],
        "qualityScore": report["qualityScore"],
    }
    await log_operation(db, current_user["id"], "auto_report", json.dumps(history_payload, ensure_ascii=False, separators=(",", ":")), 0)
    return {"success": True, "report": report}


@router.get("/api/reports/history")
async def report_history(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    rows = db.fetch(
        """
        SELECT id, action, created_at
        FROM operation_logs
        WHERE user_id = %s AND type = 'auto_report'
        ORDER BY created_at DESC
        LIMIT 50
        """,
        [current_user["id"]],
    )
    history = []
    for row in rows:
        payload = _json_value(row.get("action"), {})
        if isinstance(payload, dict):
            history.append({"id": row.get("id"), "createdAt": row.get("created_at"), **payload})
    return {"items": history}
