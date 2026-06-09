from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from dependencies import get_current_user, get_db
from entitlements import require_entitlement, tier_entitlement
from metrics import increment_business_metric
from models.schemas import CleanExportRequest, DocxExportRequest, PdfExportRequest, ReconcileExportRequest, TableXlsxExportRequest
from services.excel_service import clean_value, parse_workbook, to_number
from services.log_service import log_operation
from services.output_service import DOCX_CONTENT_TYPE, PDF_CONTENT_TYPE, XLSX_CONTENT_TYPE, build_docx, build_pdf, build_xlsx, store_output
from services.permission_service import can_read_file, can_read_output
from services.storage_service import StorageService


router = APIRouter(prefix="/api/exports", tags=["exports"])


def _storage_bytes(payload) -> bytes:
    if isinstance(payload, bytes):
        return payload
    if hasattr(payload, "content"):
        return payload.content
    if isinstance(payload, str):
        return payload.encode("utf-8")
    return bytes(payload)


def _get_readable_file(db, file_id: str, current_user: dict) -> dict:
    response = db.table("files").select("*").eq("id", file_id).limit(1).execute()
    if not response.data or not can_read_file(db, current_user, response.data[0]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tệp tin.")
    return response.data[0]


def _parse_file(db, file_id: str, current_user: dict):
    row = _get_readable_file(db, file_id, current_user)
    content = _storage_bytes(StorageService(db).download_bytes(row["path"]))
    return row, parse_workbook(row["name"], content)


def _json_meta(value: Any) -> dict:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def _export_quota_check(db, user: dict) -> None:
    entitlement = tier_entitlement(user.get("tier"))
    limit = int(entitlement.get("max_exports_per_month") or 0)
    if limit <= 0:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This feature is not available on your current plan.")
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    rows = (
        db.table("output_files")
        .select("id")
        .eq("user_id", user["id"])
        .gte("created_at", month_start)
        .execute()
        .data
        or []
    )
    if len(rows) >= limit:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Usage limit reached for your current plan.")


def _reconcile_rows(parsed_a, parsed_b, payload: ReconcileExportRequest) -> tuple[dict, list[list[Any]]]:
    key_a_idx = parsed_a.headers.index(payload.keyA)
    key_b_idx = parsed_b.headers.index(payload.keyB)
    val_a_idx = parsed_a.headers.index(payload.valA)
    val_b_idx = parsed_b.headers.index(payload.valB)
    map_a: dict[str, list[tuple[int, list[str]]]] = {}
    map_b: dict[str, list[tuple[int, list[str]]]] = {}
    for index, row in enumerate(parsed_a.rows, start=2):
        key = row[key_a_idx].strip() if key_a_idx < len(row) else ""
        if key:
            map_a.setdefault(key, []).append((index, row))
    for index, row in enumerate(parsed_b.rows, start=2):
        key = row[key_b_idx].strip() if key_b_idx < len(row) else ""
        if key:
            map_b.setdefault(key, []).append((index, row))

    summary = {"matched": 0, "missing_in_left": 0, "missing_in_right": 0, "value_mismatch": 0, "duplicate_key": 0, "total_diff": 0.0}
    details: list[list[Any]] = []
    all_keys = sorted(set(map_a.keys()) | set(map_b.keys()))
    for key in all_keys:
        left_items = map_a.get(key, [])
        right_items = map_b.get(key, [])
        if len(left_items) > 1 or len(right_items) > 1:
            summary["duplicate_key"] += 1
            details.append([key, "duplicate_key", len(left_items), len(right_items), "", "", "Key bị trùng ở một hoặc hai file"])
            continue
        if not left_items:
            summary["missing_in_left"] += 1
            row_b_num, row_b = right_items[0]
            details.append([key, "missing_in_left", "", row_b_num, "", row_b[val_b_idx] if val_b_idx < len(row_b) else "", "Thiếu ở file trái"])
            continue
        if not right_items:
            summary["missing_in_right"] += 1
            row_a_num, row_a = left_items[0]
            details.append([key, "missing_in_right", row_a_num, "", row_a[val_a_idx] if val_a_idx < len(row_a) else "", "", "Thiếu ở file phải"])
            continue
        row_a_num, row_a = left_items[0]
        row_b_num, row_b = right_items[0]
        val_a = to_number(row_a[val_a_idx] if val_a_idx < len(row_a) else "")
        val_b = to_number(row_b[val_b_idx] if val_b_idx < len(row_b) else "")
        diff = val_a - val_b
        if abs(diff) < 0.01:
            summary["matched"] += 1
            status_name = "matched"
        else:
            summary["value_mismatch"] += 1
            summary["total_diff"] += diff
            status_name = "value_mismatch"
        details.append([key, status_name, row_a_num, row_b_num, val_a, val_b, diff])
    return summary, details


@router.get("")
async def list_outputs(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    rows = db.fetch(
        """
        SELECT DISTINCT o.*
        FROM output_files o
        LEFT JOIN workspace_members wm
            ON wm.workspace_id = o.workspace_id
            AND wm.user_id = %s
            AND wm.status = 'active'
        WHERE o.user_id = %s OR wm.id IS NOT NULL
        ORDER BY o.created_at DESC
        LIMIT 100
        """,
        [current_user["id"], current_user["id"]],
    )
    return {"outputs": [{k: v for k, v in row.items() if k != "storage_path"} | {"metadata": _json_meta(row.get("metadata"))} for row in rows]}


@router.get("/{output_id}/download")
async def download_output(output_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    response = db.table("output_files").select("*").eq("id", output_id).limit(1).execute()
    if not response.data or not can_read_output(db, current_user, response.data[0]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy output.")
    row = response.data[0]
    content = _storage_bytes(StorageService(db).download_bytes(row["storage_path"]))
    return Response(
        content,
        media_type=row.get("content_type") or "application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename=\"{row.get('display_name') or 'excelai-output'}\""},
    )


@router.post("/docx")
async def export_docx(payload: DocxExportRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    require_entitlement(current_user, "can_export_docx")
    _export_quota_check(db, current_user)
    source = _get_readable_file(db, payload.sourceFileId, current_user) if payload.sourceFileId else None
    content = build_docx(payload.title, payload.content, payload.tableHeaders, payload.tableRows)
    row = store_output(db, current_user["id"], content, payload.fileName or payload.title, "docx", payload.operationType, DOCX_CONTENT_TYPE, payload.sourceFileId, {"title": payload.title}, source.get("workspace_id") if source else None)
    await log_operation(db, current_user["id"], "export", f"export_docx: {row['display_name'][:120]}")
    increment_business_metric(db, "export_count", 1, {"type": "docx"})
    return {"success": True, "output": {k: v for k, v in row.items() if k != "storage_path"}}


@router.post("/pdf")
async def export_pdf(payload: PdfExportRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    require_entitlement(current_user, "can_export_pdf")
    _export_quota_check(db, current_user)
    source = _get_readable_file(db, payload.sourceFileId, current_user) if payload.sourceFileId else None
    content = build_pdf(payload.title, payload.lines)
    row = store_output(db, current_user["id"], content, payload.fileName or payload.title, "pdf", payload.operationType, PDF_CONTENT_TYPE, payload.sourceFileId, {"title": payload.title}, source.get("workspace_id") if source else None)
    await log_operation(db, current_user["id"], "export", f"export_pdf: {row['display_name'][:120]}")
    increment_business_metric(db, "export_count", 1, {"type": "pdf"})
    return {"success": True, "output": {k: v for k, v in row.items() if k != "storage_path"}}


@router.post("/table-xlsx")
async def export_table_xlsx(payload: TableXlsxExportRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    require_entitlement(current_user, "can_export_xlsx")
    _export_quota_check(db, current_user)
    headers = [col.get("name") if isinstance(col, dict) else str(col) for col in payload.columns]
    content = build_xlsx({"Generated Table": (headers, payload.rows)})
    row = store_output(db, current_user["id"], content, payload.fileName or payload.tableName, "xlsx", "table_builder", XLSX_CONTENT_TYPE, None, {"tableName": payload.tableName})
    await log_operation(db, current_user["id"], "export", f"export_table_xlsx: {row['display_name'][:120]}")
    increment_business_metric(db, "export_count", 1, {"type": "xlsx"})
    return {"success": True, "output": {k: v for k, v in row.items() if k != "storage_path"}}


@router.post("/cleaned-xlsx")
async def export_cleaned_xlsx(payload: CleanExportRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    require_entitlement(current_user, "can_use_clean")
    require_entitlement(current_user, "can_export_xlsx")
    _export_quota_check(db, current_user)
    source, parsed = _parse_file(db, payload.fileId, current_user)
    headers = parsed.headers
    rows = [row[:] for row in parsed.rows]
    for rule in payload.rules:
        column = rule.get("column")
        action = rule.get("rule")
        fill_value = rule.get("fillValue", "")
        if column not in headers:
            continue
        idx = headers.index(column)
        if action == "remove_duplicates":
            seen = set()
            filtered = []
            for row in rows:
                key = row[idx] if idx < len(row) else ""
                if key in seen:
                    continue
                seen.add(key)
                filtered.append(row)
            rows = filtered
            continue
        for row in rows:
            while len(row) < len(headers):
                row.append("")
            original = row[idx]
            if action == "fill_missing" and not original:
                row[idx] = str(fill_value)
            elif action in {"trim", "upper", "lower", "phone", "email", "name"}:
                row[idx] = clean_value(original, action)
            elif action == "normalize_email":
                row[idx] = clean_value(original, "email")
            elif action == "normalize_phone":
                row[idx] = clean_value(original, "phone")
            elif action == "convert_type":
                row[idx] = str(to_number(original)) if rule.get("type") == "number" else str(original)
    sheets = {
        "Cleaned Data": (headers, rows),
        "Summary": (["Metric", "Value"], [["Source file", source["name"]], ["Rows", len(rows)], ["Columns", len(headers)], ["Rules applied", len(payload.rules)]]),
    }
    content = build_xlsx(sheets)
    row = store_output(db, current_user["id"], content, payload.fileName or f"cleaned_{source['name']}", "xlsx", "clean_data", XLSX_CONTENT_TYPE, payload.fileId, {"rules": payload.rules}, source.get("workspace_id"))
    await log_operation(db, current_user["id"], "export", f"export_cleaned_xlsx: {row['display_name'][:120]}")
    increment_business_metric(db, "export_count", 1, {"type": "cleaned_xlsx"})
    return {"success": True, "output": {k: v for k, v in row.items() if k != "storage_path"}}


@router.post("/reconciliation-xlsx")
async def export_reconciliation_xlsx(payload: ReconcileExportRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    require_entitlement(current_user, "can_use_reconcile")
    require_entitlement(current_user, "can_export_xlsx")
    _export_quota_check(db, current_user)
    left, parsed_left = _parse_file(db, payload.fileAId, current_user)
    right, parsed_right = _parse_file(db, payload.fileBId, current_user)
    for column, headers in ((payload.keyA, parsed_left.headers), (payload.valA, parsed_left.headers), (payload.keyB, parsed_right.headers), (payload.valB, parsed_right.headers)):
        if column not in headers:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Không tìm thấy cột: {column}")
    summary, details = _reconcile_rows(parsed_left, parsed_right, payload)
    content = build_xlsx(
        {
            "Summary": (["Metric", "Value"], [[key, value] for key, value in summary.items()] + [["Left file", left["name"]], ["Right file", right["name"]]]),
            "Details": (["Key", "Status", "Left Row", "Right Row", "Left Value", "Right Value", "Diff/Note"], details),
        }
    )
    workspace_id = left.get("workspace_id") or right.get("workspace_id")
    row = store_output(db, current_user["id"], content, payload.fileName or "reconciliation_report.xlsx", "xlsx", "reconcile", XLSX_CONTENT_TYPE, payload.fileAId, {"summary": summary, "fileBId": payload.fileBId}, workspace_id)
    await log_operation(db, current_user["id"], "export", f"export_reconciliation_xlsx: {row['display_name'][:120]}")
    increment_business_metric(db, "export_count", 1, {"type": "reconciliation_xlsx"})
    return {"success": True, "summary": summary, "output": {k: v for k, v in row.items() if k != "storage_path"}}
