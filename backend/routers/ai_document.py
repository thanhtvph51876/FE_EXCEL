from __future__ import annotations

import html
import json
import math
import re
from collections import Counter
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from dependencies import get_current_user, get_db
from entitlements import require_entitlement
from services.excel_service import parse_workbook, to_number
from services.gemini_service import generate_json
from services.log_service import log_operation
from services.output_service import DOCX_CONTENT_TYPE, PDF_CONTENT_TYPE, build_docx, build_pdf, safe_download_name, store_output
from services.permission_service import can_read_file, can_read_output
from services.quota_service import check_and_increment, mark_failed_usage
from services.storage_service import StorageService


router = APIRouter(prefix="/api/ai-document", tags=["ai-document"])
templates_router = APIRouter(prefix="/api/document", tags=["ai-document"])

TEMPLATES = [
    {"id": "business_report", "name": "Báo cáo kinh doanh", "description": "Phân tích KPIs, xu hướng và hiệu quả kinh doanh", "documentType": "report"},
    {"id": "finance_report", "name": "Báo cáo tài chính", "description": "Tổng hợp số liệu, biến động và rủi ro tài chính", "documentType": "analysis_report"},
    {"id": "project_report", "name": "Báo cáo dự án", "description": "Theo dõi tiến độ, nguồn lực, rủi ro và kiến nghị", "documentType": "plan"},
    {"id": "meeting_minutes", "name": "Biên bản họp", "description": "Ghi nhận nội dung, kết luận và đầu việc sau cuộc họp", "documentType": "meeting_minutes"},
    {"id": "official_letter", "name": "Công văn", "description": "Soạn công văn trang trọng dựa trên dữ kiện thật", "documentType": "official_letter"},
]

SYSTEM_PROMPT = """
Bạn là chuyên gia soạn thảo tài liệu doanh nghiệp cho ExcelAI.
Chỉ được sử dụng số liệu, tên cột, tên file và mẫu dòng có trong DATA_CONTEXT.
Nếu dữ liệu không đủ để kết luận, viết rõ "Chưa có đủ dữ liệu để kết luận".
Không tự bịa doanh thu, lợi nhuận, khu vực, nhân sự, tỷ lệ hoặc bất kỳ số liệu nào không có trong context.
Chỉ tạo các phần người dùng chọn trong SECTIONS.
Trả lời ONLY JSON hợp lệ:
{
  "title": "Tiêu đề tài liệu",
  "markdown": "# Tiêu đề\\n\\n## 1. ...",
  "factsUsed": ["Dữ kiện thật đã dùng"],
  "checks": ["Điểm cần kiểm tra lại"],
  "confidence": 0-100
}
"""


class GenerateDocumentRequest(BaseModel):
    documentType: str = Field(min_length=1, max_length=80)
    fileId: str = Field(min_length=1)
    sheetName: str | None = None
    prompt: str = Field(min_length=1, max_length=4000)
    tone: str = "professional"
    language: str = "vi"
    sections: list[str] = Field(default_factory=list)
    templateId: str | None = None


class ExportDocumentRequest(BaseModel):
    format: str = Field(pattern="^(docx|pdf)$")


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


def _get_file_for_read(db, file_id: str, current_user: dict) -> dict:
    rows = db.table("files").select("*").eq("id", file_id).limit(1).execute().data or []
    if not rows or not can_read_file(db, current_user, rows[0]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tệp nguồn.")
    return rows[0]


def _download_and_parse(db, file_row: dict, sheet_name: str | None):
    content = _storage_bytes(StorageService(db).download_bytes(file_row["path"]))
    return parse_workbook(file_row["name"], content, sheet_name)


def _is_number(value: str) -> bool:
    cleaned = re.sub(r"[^\d,\.\-]", "", str(value or ""))
    return cleaned not in ("", "-", ".", ",") and math.isfinite(to_number(value))


def _build_context(file_row: dict, parsed, sheet_name: str | None) -> dict:
    headers = parsed.headers
    rows = parsed.rows
    total_rows = len(rows)
    missing = {}
    numeric = {}
    category = {}
    for index, header in enumerate(headers):
        values = [str(row[index] if index < len(row) else "").strip() for row in rows]
        missing_count = sum(1 for value in values if value == "")
        if missing_count:
            missing[header] = missing_count
        number_values = [to_number(value) for value in values if _is_number(value)]
        if number_values and len(number_values) / max(1, len([v for v in values if v])) >= 0.55:
            numeric[header] = {
                "count": len(number_values),
                "sum": round(sum(number_values), 4),
                "avg": round(sum(number_values) / max(1, len(number_values)), 4),
                "min": min(number_values),
                "max": max(number_values),
            }
            continue
        counts = Counter(value or "(Trống)" for value in values)
        if counts and len(counts) <= max(12, total_rows * 0.4):
            category[header] = [{"value": key, "count": count} for key, count in counts.most_common(8)]
    seen = set()
    duplicate_rows = 0
    for row in rows:
        key = tuple(str(cell or "").strip().lower() for cell in row[: len(headers)])
        if key in seen:
            duplicate_rows += 1
        else:
            seen.add(key)
    return {
        "fileName": file_row.get("name"),
        "sheetName": sheet_name or "CSV",
        "columns": headers,
        "totalRows": total_rows,
        "totalColumns": len(headers),
        "sampleRows": rows[:50],
        "statistics": {
            "numeric": numeric,
            "category": category,
            "missing": missing,
            "duplicateRows": duplicate_rows,
        },
        "highlights": [
            f"Tệp có {total_rows} dòng và {len(headers)} cột.",
            f"Có {duplicate_rows} dòng trùng lặp." if duplicate_rows else "Không phát hiện dòng trùng trong dữ liệu đã đọc.",
            f"Có {sum(missing.values())} ô thiếu dữ liệu." if missing else "Không phát hiện ô trống trong dữ liệu đã đọc.",
        ],
    }


def _markdown_to_html(markdown: str) -> str:
    lines = []
    for raw in (markdown or "").splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("# "):
            lines.append(f"<h1>{html.escape(line[2:].strip())}</h1>")
        elif line.startswith("## "):
            lines.append(f"<h2>{html.escape(line[3:].strip())}</h2>")
        elif line.startswith("### "):
            lines.append(f"<h3>{html.escape(line[4:].strip())}</h3>")
        elif line.startswith(("- ", "* ")):
            lines.append(f"<p>• {html.escape(line[2:].strip())}</p>")
        else:
            lines.append(f"<p>{html.escape(line)}</p>")
    return "\n".join(lines)


def _get_document_row(db, document_id: str, current_user: dict) -> dict:
    rows = db.table("output_files").select("*").eq("id", document_id).limit(1).execute().data or []
    if not rows or not can_read_output(db, current_user, rows[0]) or rows[0].get("operation_type") != "ai_document":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tài liệu.")
    return rows[0]


def _read_document(db, row: dict) -> dict:
    content = _storage_bytes(StorageService(db).download_bytes(row["storage_path"]))
    return json.loads(content.decode("utf-8"))


def _store_document(db, current_user: dict, file_row: dict, document: dict) -> dict:
    document_id = document["documentId"]
    safe_name = safe_download_name(document.get("title") or "ai-document", "json")
    storage_path = f"{current_user['id']}/ai-documents/{document_id}_{safe_name}"
    StorageService(db).upload_bytes(storage_path, json.dumps(document, ensure_ascii=False).encode("utf-8"), "application/json")
    row = {
        "id": document_id,
        "user_id": current_user["id"],
        "source_file_id": file_row.get("id"),
        "output_type": "json",
        "operation_type": "ai_document",
        "display_name": safe_name,
        "storage_path": storage_path,
        "content_type": "application/json",
        "metadata": json.dumps(
            {
                "title": document.get("title"),
                "confidence": document.get("confidence"),
                "fileName": file_row.get("name"),
                "sheetName": document.get("source", {}).get("sheetName"),
            },
            ensure_ascii=False,
        ),
        "workspace_id": file_row.get("workspace_id"),
        "created_at": document.get("generatedAt"),
    }
    response = db.table("output_files").insert(row).execute()
    return response.data[0] if response.data else row


@router.get("/templates")
async def document_templates():
    return {"templates": TEMPLATES}


@templates_router.get("/templates")
async def document_templates_alias():
    return {"templates": TEMPLATES}


@router.post("/generate")
async def generate_document(payload: GenerateDocumentRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    require_entitlement(current_user, "can_use_doc_builder")
    await check_and_increment(current_user["id"], db, "doc_builder")
    file_row = _get_file_for_read(db, payload.fileId, current_user)
    try:
        parsed = _download_and_parse(db, file_row, payload.sheetName)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không thể đọc tệp nguồn hoặc sheet đã chọn.") from exc
    context = _build_context(file_row, parsed, payload.sheetName)
    template = next((item for item in TEMPLATES if item["id"] == payload.templateId), None)
    ai_input = {
        "DOCUMENT_TYPE": payload.documentType,
        "PROMPT": payload.prompt,
        "TONE": payload.tone,
        "LANGUAGE": payload.language,
        "SECTIONS": payload.sections or ["summary", "analysis", "conclusion"],
        "TEMPLATE": template,
        "DATA_CONTEXT": context,
    }
    try:
        result = await generate_json(SYSTEM_PROMPT, json.dumps(ai_input, ensure_ascii=False))
    except HTTPException:
        await mark_failed_usage(current_user["id"], "doc_builder")
        raise
    except Exception as exc:
        await mark_failed_usage(current_user["id"], "doc_builder")
        detail = getattr(exc, "detail", str(exc))
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"AI provider chưa phản hồi: {detail}") from exc
    markdown = str(result.get("markdown") or result.get("content") or "").strip()
    if not markdown:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI không trả về nội dung tài liệu hợp lệ.")
    generated_at = datetime.now(timezone.utc).isoformat()
    confidence = max(0, min(100, int(result.get("confidence") or 88)))
    document = {
        "documentId": str(uuid4()),
        "title": str(result.get("title") or "Tài liệu AI").strip()[:180],
        "status": "completed",
        "confidence": confidence,
        "generatedAt": generated_at,
        "source": {"fileId": file_row.get("id"), "fileName": file_row.get("name"), "sheetName": context["sheetName"]},
        "content": {"markdown": markdown, "html": _markdown_to_html(markdown)},
        "factsUsed": result.get("factsUsed") if isinstance(result.get("factsUsed"), list) else context["highlights"],
        "checks": result.get("checks") if isinstance(result.get("checks"), list) else [],
        "metrics": {"estimatedTime": max(8, min(90, int(context["totalRows"] / 80) + 12)), "rowsUsed": context["totalRows"], "columnsUsed": context["totalColumns"]},
    }
    _store_document(db, current_user, file_row, document)
    await log_operation(db, current_user["id"], "document", f"AI Document: {document['title'][:100]}")
    return document


@router.get("/history")
async def document_history(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    rows = db.fetch(
        """
        SELECT id, display_name, metadata, source_file_id, created_at
        FROM output_files
        WHERE user_id = %s AND operation_type = 'ai_document'
        ORDER BY created_at DESC
        LIMIT 50
        """,
        [current_user["id"]],
    )
    items = []
    for row in rows:
        metadata = _json_value(row.get("metadata"), {})
        items.append(
            {
                "documentId": row.get("id"),
                "title": metadata.get("title") or row.get("display_name"),
                "confidence": metadata.get("confidence"),
                "fileName": metadata.get("fileName"),
                "sheetName": metadata.get("sheetName"),
                "createdAt": row.get("created_at"),
                "sourceFileId": row.get("source_file_id"),
            }
        )
    return {"items": items}


@router.get("/{document_id}")
async def get_document(document_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    row = _get_document_row(db, document_id, current_user)
    return _read_document(db, row)


@router.post("/{document_id}/export")
async def export_document(document_id: str, payload: ExportDocumentRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    row = _get_document_row(db, document_id, current_user)
    document = _read_document(db, row)
    title = document.get("title") or "ai-document"
    markdown = document.get("content", {}).get("markdown") or ""
    source_file_id = document.get("source", {}).get("fileId")
    source = _get_file_for_read(db, source_file_id, current_user) if source_file_id else None
    if payload.format == "docx":
        require_entitlement(current_user, "can_export_docx")
        content = build_docx(title, markdown)
        output = store_output(db, current_user["id"], content, f"{title}.docx", "docx", "ai_document_export", DOCX_CONTENT_TYPE, source_file_id, {"documentId": document_id, "title": title}, source.get("workspace_id") if source else None)
    else:
        require_entitlement(current_user, "can_export_pdf")
        lines = [line for line in markdown.splitlines() if line.strip()]
        content = build_pdf(title, lines)
        output = store_output(db, current_user["id"], content, f"{title}.pdf", "pdf", "ai_document_export", PDF_CONTENT_TYPE, source_file_id, {"documentId": document_id, "title": title}, source.get("workspace_id") if source else None)
    await log_operation(db, current_user["id"], "export", f"ai_document_{payload.format}: {title[:100]}")
    return {"downloadUrl": f"/api/exports/{output['id']}/download", "output": {k: v for k, v in output.items() if k != "storage_path"}}
