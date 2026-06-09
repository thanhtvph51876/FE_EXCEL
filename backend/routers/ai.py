import json
from typing import Any, Dict, List, Tuple

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from auth_policy import effective_role
from config import settings
from dependencies import get_current_user, get_db
from entitlements import require_entitlement
from models.schemas import (
    AutopilotRequest,
    ChatRequest,
    CleanRequest,
    DataCheckRequest,
    DocBuilderRequest,
    FormulaRequest,
    ReconcileRequest,
    TableBuilderRequest,
    VBARequest,
)
from services.excel_service import build_statistics, clean_value, find_quality_errors, parse_workbook, to_number
from services.gemini_service import generate, generate_json, stream_generate
from services.log_service import log_operation
from services.permission_service import can_read_file, can_use_file_for_ai
from services.quota_service import check_and_increment, mark_failed_usage, record_ai_usage_event
from services.storage_service import StorageService
from rate_limit import enforce_user_rate_limit, limiter


router = APIRouter(prefix="/api/ai", tags=["ai"])

CHAT_SYSTEM_PROMPT = """
Bạn là ExcelAI — trợ lý AI chuyên gia về Microsoft Excel và Office tại Việt Nam.
Bạn hỗ trợ: phân tích dữ liệu, sinh công thức Excel, viết VBA/Macro, làm sạch dữ liệu, đối soát số liệu, lập báo cáo.
Luôn trả lời bằng tiếng Việt. Nếu có code Excel hoặc VBA, bọc trong markdown code block.
Chỉ trả lời các vấn đề liên quan Excel/Office/dữ liệu. Từ chối lịch sự nếu hỏi ngoài phạm vi.
"""

FORMULA_SYSTEM_PROMPT = """
Bạn là chuyên gia Excel. Người dùng mô tả yêu cầu tính toán bằng tiếng Việt.
Hãy sinh công thức Excel chính xác nhất. Trả lời ONLY JSON theo format:
{
  "formula": "=SUMIFS(C:C, B:B, \"Kế toán\")",
  "explanation": "Giải thích ngắn gọn công thức",
  "inputExample": "Mô tả dữ liệu đầu vào",
  "outputExample": "Mô tả kết quả trả về"
}
Không thêm bất kỳ text nào ngoài JSON.
"""

VBA_SYSTEM_PROMPT = """
Bạn là chuyên gia VBA Excel. Viết mã VBA/Macro hoàn chỉnh, an toàn, có comment tiếng Việt.
Trả lời ONLY JSON theo format:
{
  "code": "Sub TenMacro()\\n  ' Code đầy đủ\\nEnd Sub",
  "explanation": "Giải thích từng phần code quan trọng"
}
Không thêm bất kỳ text nào ngoài JSON.
"""

DATA_CHECK_SYSTEM_PROMPT = """
Dựa trên kết quả rà soát dữ liệu sau, hãy viết nhận xét ngắn gọn (3-4 câu tiếng Việt) về chất lượng dữ liệu và khuyến nghị hành động.
Kết quả rà soát: {scan_result}
"""

CLEAN_SYSTEM_PROMPT = """
Người dùng muốn làm sạch cột dữ liệu theo rule sau.
Cột: {column}, Rule: {rule}, Ví dụ dữ liệu: {sample_data}
Hãy trả lời ONLY JSON:
{
  "formula": "=TRIM(A2)",
  "description": "Mô tả việc công thức làm",
  "previewRows": [{"original": "...", "cleaned": "..."}]
}
"""

AUTOPILOT_SYSTEM_PROMPT = """
Bạn là AI Autopilot chuyên lập kế hoạch tự động hóa công việc Excel/Office.
Người dùng mô tả mục tiêu: {goal}
File đính kèm: {files}
Output mong muốn: {outputs}

Hãy phân tích và lập kế hoạch thực thi. Trả lời ONLY JSON:
{
  "understanding": "Tóm tắt yêu cầu một câu",
  "steps": [
    { "num": 1, "title": "Tiêu đề bước", "desc": "Mô tả chi tiết", "status": "completed" },
    { "num": 2, "title": "...", "desc": "...", "status": "pending" }
  ],
  "requiredInputs": ["Danh sách input cần thiết"],
  "expectedOutputs": ["File kết quả 1 (XLSX)", "Báo cáo (PDF)"],
  "previewType": "excel"
}
Tạo 3-5 bước thực tế, 1-2 bước đầu status "completed", còn lại "pending".
"""

TABLE_BUILDER_SYSTEM_PROMPT = """
Người dùng muốn tạo bảng Excel với mô tả: {description}, loại: {type}
Hãy thiết kế cấu trúc bảng hoàn chỉnh. Trả lời ONLY JSON:
{
  "tableName": "Tên bảng",
  "columns": [
    { "name": "Tên cột", "type": "Văn bản|Số|Ngày tháng|Công thức", "sample": "Ví dụ giá trị" }
  ],
  "formulas": [
    { "col": "Tên cột công thức", "expr": "=CÔNG_THỨC", "desc": "Giải thích" }
  ],
  "rows": [["row1col1", "row1col2", "..."], ["row2col1", "..."]],
  "notes": "Ghi chú sử dụng bảng"
}
Tạo 5-8 cột phù hợp, 3 dòng sample data thực tế tiếng Việt.
"""

DOC_BUILDER_SYSTEM_PROMPT = """
Bạn là chuyên gia soạn thảo văn bản hành chính Việt Nam.
Loại văn bản: {type}
Dữ kiện: {facts}
Giọng văn: {tone}
Dữ liệu file: {file_context}

Soạn thảo văn bản đầy đủ theo chuẩn hành chính Việt Nam. Trả lời ONLY JSON:
{
  "title": "TIÊU ĐỀ VĂN BẢN",
  "content": "Nội dung văn bản đầy đủ...",
  "factsUsed": ["Dữ kiện đã sử dụng 1", "Dữ kiện 2"],
  "checks": ["Điểm cần kiểm tra lại 1", "Điểm 2"]
}
"""

UNSAFE_VBA_PATTERNS = (
    "Shell",
    "WScript.Shell",
    "CreateObject(\"WScript.Shell\")",
    "FileSystemObject",
    "Kill",
    "PowerShell",
    "cmd.exe",
    "regedit",
    "URLDownloadToFile",
    "Auto_Open",
    "Workbook_Open",
    "Open ",
    " For Output",
    "CreateTextFile",
    "DeleteFile",
    "DeleteFolder",
)


def _rate_limit_ai(current_user: dict, feature_name: str) -> None:
    tier = current_user.get("tier") or "free"
    limit = 20 if tier == "free" else 120 if tier == "pro" else 600
    enforce_user_rate_limit(current_user["id"], f"ai:{feature_name}", limit, 60)


FEATURE_CAPABILITIES = {
    "chat": "can_use_chat",
    "chat_stream": "can_use_chat",
    "formula": "can_use_formula",
    "vba": "can_use_vba",
    "data_check": "can_use_data_check",
    "clean": "can_use_clean",
    "reconcile": "can_use_reconcile",
    "autopilot": "can_use_report_builder",
    "table_builder": "can_use_report_builder",
    "doc_builder": "can_use_doc_builder",
}


def _json_setting(db, key: str, default: dict) -> dict:
    try:
        response = db.table("settings").select("*").eq("key", key).limit(1).execute()
        raw = response.data[0].get("value") if response.data else ""
        parsed = json.loads(raw) if raw else {}
        return {**default, **parsed} if isinstance(parsed, dict) else default.copy()
    except Exception:
        return default.copy()


def _require_ai_feature(current_user: dict, feature_name: str, db) -> None:
    block = _json_setting(db, "ai_system_block", {"blocked": False, "reason": ""})
    quota_config = _json_setting(db, "ai_quota_config", {"adminBypassQuota": True})
    if block.get("blocked") and not (quota_config.get("adminBypassQuota") and effective_role(current_user) == "admin"):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"AI đang tạm chặn toàn hệ thống: {block.get('reason') or 'maintenance'}")
    capability = FEATURE_CAPABILITIES.get(feature_name)
    if capability:
        require_entitlement(current_user, capability)
    _rate_limit_ai(current_user, feature_name)


def _unsafe_vba_matches(code: str) -> list[str]:
    lowered = code.lower()
    return [pattern for pattern in UNSAFE_VBA_PATTERNS if pattern.lower() in lowered]


def _json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False)


def _storage_bytes(payload) -> bytes:
    if isinstance(payload, bytes):
        return payload
    if hasattr(payload, "content"):
        return payload.content
    if isinstance(payload, str):
        return payload.encode("utf-8")
    return bytes(payload)


def _get_readable_file(db, file_id: str, current_user: dict) -> Dict[str, Any]:
    response = db.table("files").select("*").eq("id", file_id).limit(1).execute()
    if not response.data or not can_read_file(db, current_user, response.data[0]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tệp tin.")
    return response.data[0]


def _load_parsed_file(db, file_id: str, current_user: dict):
    row = _get_readable_file(db, file_id, current_user)
    if not can_use_file_for_ai(db, current_user, row):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền dùng AI với tệp này.")
    content = _storage_bytes(StorageService(db).download_bytes(row["path"]))
    return row, parse_workbook(row["name"], content)


def _chat_prompt_from_settings(db) -> str:
    try:
        response = db.table("settings").select("*").eq("key", "chat_system_prompt").limit(1).execute()
        if response.data and response.data[0].get("value"):
            return response.data[0]["value"]
    except Exception:
        pass
    return CHAT_SYSTEM_PROMPT


def _normalize_clean_response(result: Dict[str, Any], values: List[str], rule: str) -> Dict[str, Any]:
    if "previewRows" not in result or not isinstance(result["previewRows"], list):
        result["previewRows"] = [{"original": value, "cleaned": clean_value(value, rule)} for value in values[:10]]
    result.setdefault("formula", "")
    result.setdefault("description", "Xem trước thao tác làm sạch dữ liệu.")
    result["success"] = True
    return result


def _fallback_clean_response(values: List[str], rule: str) -> Dict[str, Any]:
    formula_map = {
        "trim": "=TRIM(A2)",
        "upper": "=UPPER(A2)",
        "lower": "=LOWER(A2)",
        "phone": "=SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(A2,\" \",\"\"),\"-\",\"\"),\"+84\",\"0\")",
        "email": "=LOWER(TRIM(A2))",
        "name": "=PROPER(TRIM(A2))",
    }
    return {
        "success": True,
        "formula": formula_map.get(rule, "=A2"),
        "description": "Gemini chưa phản hồi, backend trả preview làm sạch theo rule nội bộ.",
        "previewRows": [{"original": value, "cleaned": clean_value(value, rule)} for value in values[:10]],
    }


def _fallback_table(payload: TableBuilderRequest) -> Dict[str, Any]:
    columns = [
        {"name": "STT", "type": "Số", "sample": "1"},
        {"name": "Nội dung", "type": "Văn bản", "sample": payload.description[:40] or "Công việc"},
        {"name": "Ngày", "type": "Ngày tháng", "sample": "2026-06-04"},
        {"name": "Trạng thái", "type": "Văn bản", "sample": "Đang xử lý"},
    ]
    rows = [["1", payload.description[:40] or "Công việc", "2026-06-04", "Đang xử lý"]] if payload.includeSampleData else []
    return {
        "tableName": "Bảng dữ liệu ExcelAI",
        "columns": columns,
        "formulas": [] if not payload.includeFormula else [{"col": "STT", "expr": "=ROW()-1", "desc": "Đánh số thứ tự tự động"}],
        "rows": rows,
        "notes": "Gemini chưa phản hồi, backend trả cấu trúc bảng fallback.",
    }


def _index_or_400(headers: List[str], column: str) -> int:
    if column not in headers:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Không tìm thấy cột: {column}")
    return headers.index(column)


def _reconcile(parsed_a, parsed_b, payload: ReconcileRequest) -> Tuple[Dict[str, int], List[Dict[str, Any]]]:
    key_a_idx = _index_or_400(parsed_a.headers, payload.keyA)
    key_b_idx = _index_or_400(parsed_b.headers, payload.keyB)
    val_a_idx = _index_or_400(parsed_a.headers, payload.valA)
    val_b_idx = _index_or_400(parsed_b.headers, payload.valB)
    map_a = {}
    for row_index, row in enumerate(parsed_a.rows, start=2):
        key = row[key_a_idx].strip() if key_a_idx < len(row) else ""
        if key:
            map_a[key] = {"row": row, "rowNumber": row_index}
    map_b = {}
    for row_index, row in enumerate(parsed_b.rows, start=2):
        key = row[key_b_idx].strip() if key_b_idx < len(row) else ""
        if key:
            map_b[key] = {"row": row, "rowNumber": row_index}

    summary = {"matched": 0, "mismatched": 0, "missingA": 0, "missingB": 0}
    discrepancies: List[Dict[str, Any]] = []
    for key, data_a in map_a.items():
        val_a = to_number(data_a["row"][val_a_idx] if val_a_idx < len(data_a["row"]) else "")
        if key not in map_b:
            summary["missingB"] += 1
            discrepancies.append({"key": key, "rowA": data_a["rowNumber"], "rowB": None, "valA": val_a, "valB": None, "diff": val_a, "reason": "Thiếu ở File B"})
            continue
        data_b = map_b[key]
        val_b = to_number(data_b["row"][val_b_idx] if val_b_idx < len(data_b["row"]) else "")
        diff = val_a - val_b
        if abs(diff) < 0.01:
            summary["matched"] += 1
        else:
            summary["mismatched"] += 1
            discrepancies.append({"key": key, "rowA": data_a["rowNumber"], "rowB": data_b["rowNumber"], "valA": val_a, "valB": val_b, "diff": diff, "reason": "Chênh lệch giá trị"})
    for key, data_b in map_b.items():
        if key in map_a:
            continue
        val_b = to_number(data_b["row"][val_b_idx] if val_b_idx < len(data_b["row"]) else "")
        summary["missingA"] += 1
        discrepancies.append({"key": key, "rowA": None, "rowB": data_b["rowNumber"], "valA": None, "valB": val_b, "diff": -val_b, "reason": "Thiếu ở File A"})
    return summary, discrepancies[:200]


@router.post("/chat")
@limiter.limit("30/minute")
async def chat(request: Request, payload: ChatRequest, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    _require_ai_feature(current_user, "chat", db)
    await check_and_increment(current_user["id"], db, "chat")
    file_context = ""
    if payload.fileId:
        row = _get_readable_file(db, payload.fileId, current_user)
        headers = []
        try:
            _, parsed = _load_parsed_file(db, payload.fileId, current_user)
            headers = parsed.headers
        except Exception:
            headers = []
        file_context = f"\nNgười dùng đang làm việc với file '{row['name']}' ({row.get('row_count', 0)} dòng, các cột: {', '.join(headers[:20])})."
    try:
        reply = await generate(_chat_prompt_from_settings(db), f"{file_context}\n\n{payload.message}", payload.history)
    except Exception as exc:
        detail = getattr(exc, "detail", str(exc))
        reply = f"Backend đã nhận yêu cầu nhưng Gemini chưa phản hồi ({detail}). Vui lòng kiểm tra GEMINI_API_KEY hoặc thử lại sau."
    await log_operation(db, current_user["id"], "chat", f"AI Chat: {payload.message[:80]}")
    return {"reply": reply}


@router.post("/chat/stream")
@limiter.limit("30/minute")
async def chat_stream(request: Request, payload: ChatRequest, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    _require_ai_feature(current_user, "chat_stream", db)
    await check_and_increment(current_user["id"], db, "chat_stream")
    file_context = ""
    if payload.fileId:
        row = _get_readable_file(db, payload.fileId, current_user)
        headers = []
        try:
            _, parsed = _load_parsed_file(db, payload.fileId, current_user)
            headers = parsed.headers
        except Exception:
            headers = []
        file_context = f"\nNgười dùng đang làm việc với file '{row['name']}' ({row.get('row_count', 0)} dòng, các cột: {', '.join(headers[:20])})."

    system_prompt = _chat_prompt_from_settings(db)
    user_message = f"{file_context}\n\n{payload.message}"

    async def event_stream():
        try:
            async for chunk in stream_generate(system_prompt, user_message, payload.history):
                yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            detail = getattr(exc, "detail", str(exc))
            yield f"data: {json.dumps({'error': detail}, ensure_ascii=False)}\n\n"

    await log_operation(db, current_user["id"], "chat_stream", f"Stream Chat: {payload.message[:80]}")
    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/formula")
@limiter.limit("60/minute")
async def formula(request: Request, payload: FormulaRequest, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    _require_ai_feature(current_user, "formula", db)
    await check_and_increment(current_user["id"], db, "formula")
    try:
        result = await generate_json(FORMULA_SYSTEM_PROMPT, f"Yêu cầu: {payload.prompt}\nNgữ cảnh: {payload.context}")
    except Exception as exc:
        detail = getattr(exc, "detail", str(exc))
        result = {"formula": "=A1", "explanation": f"Gemini chưa phản hồi ({detail}). Đây là công thức fallback.", "inputExample": payload.prompt, "outputExample": "Kiểm tra lại trước khi dùng."}
    await log_operation(db, current_user["id"], "formula", f"Sinh công thức: {payload.prompt[:80]}")
    return result


@router.post("/vba")
async def vba(payload: VBARequest, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    _require_ai_feature(current_user, "vba", db)
    await check_and_increment(current_user["id"], db, "vba")
    try:
        result = await generate_json(VBA_SYSTEM_PROMPT, payload.prompt)
    except Exception as exc:
        detail = getattr(exc, "detail", str(exc))
        await mark_failed_usage(current_user["id"], "vba")
        result = {"code": "Sub ExcelAI_Fallback()\n    ' AI provider is temporarily unavailable.\nEnd Sub", "explanation": "AI provider is temporarily unavailable."}
    matches = _unsafe_vba_matches(result.get("code", ""))
    if matches:
        await log_operation(db, current_user["id"], "vba", f"blocked_unsafe_vba: {', '.join(matches)[:180]}")
        record_ai_usage_event(current_user["id"], current_user.get("tier") or "free", "vba", "blocked")
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Generated VBA contains potentially unsafe operations and was blocked.")
    await log_operation(db, current_user["id"], "vba", f"Tạo VBA: {payload.prompt[:80]}")
    return result


@router.post("/data-check")
async def data_check(payload: DataCheckRequest, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    _require_ai_feature(current_user, "data_check", db)
    await check_and_increment(current_user["id"], db, "data_check")
    row, parsed = _load_parsed_file(db, payload.fileId, current_user)
    scanned_rows = min(100, parsed.row_count)
    errors = find_quality_errors(parsed.headers, parsed.rows[:scanned_rows])
    rows_with_errors = {err["row"] for err in errors}
    valid_rows = max(0, scanned_rows - len(rows_with_errors))
    health_score = round((valid_rows / max(1, scanned_rows)) * 100, 1)
    scan_result = {"file": row["name"], "healthScore": health_score, "scannedRows": scanned_rows, "errors": errors[:50], "statistics": build_statistics(parsed.headers, parsed.rows, parsed.row_count)}
    try:
        narrative = await generate(DATA_CHECK_SYSTEM_PROMPT.format(scan_result=_json(scan_result)), "")
    except Exception as exc:
        detail = getattr(exc, "detail", str(exc))
        narrative = f"Đã quét {scanned_rows} dòng và phát hiện {len(errors)} lỗi. Gemini chưa phản hồi ({detail}), nên backend trả nhận xét fallback."
    await log_operation(db, current_user["id"], "checker", f"Rà soát lỗi dữ liệu: {row['name']}")
    return {"healthScore": health_score, "scannedRows": scanned_rows, "errors": errors, "aiNarrative": narrative}


@router.post("/clean")
async def clean(payload: CleanRequest, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    try:
        _require_ai_feature(current_user, "clean", db)
        await check_and_increment(current_user["id"], db, "clean")
        row, parsed = _load_parsed_file(db, payload.fileId, current_user)
        column_index = _index_or_400(parsed.headers, payload.column)
        sample_data = [row_values[column_index] if column_index < len(row_values) else "" for row_values in parsed.rows[:10]]
        try:
            result = await generate_json(CLEAN_SYSTEM_PROMPT.format(column=payload.column, rule=payload.rule, sample_data=_json(sample_data)), f"Hãy tạo preview làm sạch cho file {row['name']}.")
        except Exception:
            result = _fallback_clean_response(sample_data, payload.rule)
        await log_operation(db, current_user["id"], "cleaning", f"Làm sạch cột {payload.column} bằng rule {payload.rule}")
        return _normalize_clean_response(result, sample_data, payload.rule)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Không thể làm sạch dữ liệu: {type(exc).__name__}") from exc


@router.post("/reconcile")
async def reconcile(payload: ReconcileRequest, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    _require_ai_feature(current_user, "reconcile", db)
    await check_and_increment(current_user["id"], db, "reconcile")
    row_a, parsed_a = _load_parsed_file(db, payload.fileAId, current_user)
    row_b, parsed_b = _load_parsed_file(db, payload.fileBId, current_user)
    summary, discrepancies = _reconcile(parsed_a, parsed_b, payload)
    try:
        narrative = await generate(CHAT_SYSTEM_PROMPT, f"Tổng kết kết quả đối soát giữa {row_a['name']} và {row_b['name']}: {_json({'summary': summary, 'topDiscrepancies': discrepancies[:20]})}")
    except Exception as exc:
        detail = getattr(exc, "detail", str(exc))
        narrative = f"Đối soát hoàn tất: {summary}. Gemini chưa phản hồi ({detail}), backend trả nhận xét fallback."
    await log_operation(db, current_user["id"], "reconciliation", f"Đối soát {row_a['name']} và {row_b['name']}")
    return {"summary": summary, "discrepancies": discrepancies, "aiNarrative": narrative}


@router.post("/autopilot")
async def autopilot(payload: AutopilotRequest, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    _require_ai_feature(current_user, "autopilot", db)
    await check_and_increment(current_user["id"], db, "autopilot")
    try:
        result = await generate_json(AUTOPILOT_SYSTEM_PROMPT.format(goal=payload.goal, outputs=", ".join(payload.outputs), files=", ".join(payload.files)), payload.goal)
    except Exception as exc:
        detail = getattr(exc, "detail", str(exc))
        result = {
            "understanding": payload.goal,
            "steps": [
                {"num": 1, "title": "Nhận yêu cầu", "desc": "Backend đã nhận mục tiêu tự động hóa.", "status": "completed"},
                {"num": 2, "title": "Chuẩn bị dữ liệu", "desc": "Kiểm tra file đầu vào và output mong muốn.", "status": "pending"},
                {"num": 3, "title": "Chạy AI", "desc": f"Gemini chưa phản hồi: {detail}", "status": "pending"},
            ],
            "requiredInputs": payload.files,
            "expectedOutputs": payload.outputs,
            "previewType": "excel",
        }
    await log_operation(db, current_user["id"], "autopilot", f"Lập kế hoạch Autopilot: {payload.goal[:80]}")
    return result


@router.post("/table-builder")
async def table_builder(payload: TableBuilderRequest, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    _require_ai_feature(current_user, "table_builder", db)
    await check_and_increment(current_user["id"], db, "table_builder")
    try:
        result = await generate_json(TABLE_BUILDER_SYSTEM_PROMPT.format(description=payload.description, type=payload.type), _json({"includeFormula": payload.includeFormula, "includeSampleData": payload.includeSampleData}))
    except Exception:
        result = _fallback_table(payload)
    if not payload.includeFormula:
        result["formulas"] = []
    if not payload.includeSampleData:
        result["rows"] = []
    await log_operation(db, current_user["id"], "table", f"Tạo bảng AI: {payload.description[:80]}")
    return result


@router.post("/doc-builder")
async def doc_builder(payload: DocBuilderRequest, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    _require_ai_feature(current_user, "doc_builder", db)
    await check_and_increment(current_user["id"], db, "doc_builder")
    file_context = "Không có file đính kèm."
    if payload.fileId:
        try:
            row, parsed = _load_parsed_file(db, payload.fileId, current_user)
            file_context = f"{row['name']} - {parsed.row_count} dòng, cột: {', '.join(parsed.headers[:20])}"
        except Exception:
            file_context = "Có file đính kèm nhưng không đọc được nội dung."
    try:
        result = await generate_json(DOC_BUILDER_SYSTEM_PROMPT.format(type=payload.type, facts=payload.facts, tone=payload.tone, file_context=file_context), payload.facts or payload.type)
    except Exception as exc:
        detail = getattr(exc, "detail", str(exc))
        result = {
            "title": payload.type.upper(),
            "content": f"{payload.facts or 'Nội dung cần bổ sung.'}\n\n(Gemini chưa phản hồi: {detail})",
            "factsUsed": [payload.facts] if payload.facts else [],
            "checks": ["Kiểm tra lại nội dung trước khi sử dụng chính thức."],
        }
    await log_operation(db, current_user["id"], "document", f"Soạn văn bản AI: {payload.type[:80]}")
    return result
