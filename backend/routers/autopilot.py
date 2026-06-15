from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, Field

from dependencies import get_current_user, get_db
from entitlements import tier_entitlement
from services.excel_service import build_statistics, find_quality_errors, parse_workbook, to_number
from services.output_service import XLSX_CONTENT_TYPE, build_xlsx, store_output
from services.permission_service import can_read_file
from services.quota_service import check_and_increment
from services.storage_service import StorageService
from services.http_headers import safe_attachment_headers


router = APIRouter(prefix="/api/autopilot", tags=["autopilot"])


class PlanRequest(BaseModel):
    goal: str = Field(min_length=3, max_length=1000)
    fileId: str


class PlanPatchRequest(BaseModel):
    steps: list[dict] = Field(default_factory=list)
    goal: str | None = Field(default=None, max_length=1000)


class DraftRequest(BaseModel):
    planId: str


def _json(value):
    return json.dumps(value, ensure_ascii=False)


def _parse_json(value, default):
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value or "")
    except Exception:
        return default


def _ensure_tables(db) -> None:
    db.fetch(
        """
        CREATE TABLE IF NOT EXISTS autopilot_plans (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            file_id UUID REFERENCES files(id) ON DELETE SET NULL,
            goal TEXT NOT NULL,
            file_name VARCHAR(255) NOT NULL DEFAULT '',
            steps JSONB NOT NULL DEFAULT '[]'::jsonb,
            expected_output JSONB NOT NULL DEFAULT '{}'::jsonb,
            file_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
            status VARCHAR(30) NOT NULL DEFAULT 'planned',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        commit=True,
    )
    db.fetch(
        """
        CREATE TABLE IF NOT EXISTS autopilot_drafts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            plan_id UUID REFERENCES autopilot_plans(id) ON DELETE CASCADE,
            file_id UUID REFERENCES files(id) ON DELETE SET NULL,
            summary TEXT NOT NULL DEFAULT '',
            tables JSONB NOT NULL DEFAULT '[]'::jsonb,
            insights JSONB NOT NULL DEFAULT '[]'::jsonb,
            warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
            output_file_id UUID REFERENCES output_files(id) ON DELETE SET NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'completed',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        commit=True,
    )


def _require_autopilot(current_user: dict) -> None:
    entitlement = tier_entitlement(current_user.get("tier"))
    if not entitlement.get("can_use_report_builder"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI Autopilot thuộc gói Pro/Business/Enterprise. Vui lòng nâng cấp để sử dụng.",
        )


def _file_row(db, file_id: str, current_user: dict) -> dict:
    rows = db.table("files").select("*").eq("id", file_id).limit(1).execute().data or []
    if not rows or not can_read_file(db, current_user, rows[0]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy file hoặc bạn không có quyền truy cập.")
    return rows[0]


def _load_parsed(db, file_row: dict):
    content = StorageService(db).download_bytes(file_row["path"])
    return parse_workbook(file_row["name"], content)


def _column_profile(headers: list[str], rows: list[list[str]]) -> list[dict]:
    stats = build_statistics(headers, rows[:200], len(rows))
    return stats.get("columns") or []


def _find_columns(headers: list[str]) -> dict:
    lowered = [header.lower() for header in headers]
    return {
        "date": next((headers[i] for i, h in enumerate(lowered) if any(k in h for k in ["ngày", "date", "tháng", "month"])), None),
        "amount": next((headers[i] for i, h in enumerate(lowered) if any(k in h for k in ["doanh thu", "revenue", "amount", "tiền", "total", "sales", "chi phí", "cost"])), None),
        "category": next((headers[i] for i, h in enumerate(lowered) if any(k in h for k in ["khu vực", "region", "sản phẩm", "product", "khách", "customer", "nhóm", "category", "bộ phận"])), None),
        "status": next((headers[i] for i, h in enumerate(lowered) if any(k in h for k in ["trạng thái", "status", "state"])), None),
    }


def _build_plan(goal: str, file_row: dict, parsed) -> tuple[list[dict], dict, dict]:
    headers = parsed.headers
    columns = _find_columns(headers)
    goal_l = goal.lower()
    steps = [
        {
            "id": "step_read",
            "order": 1,
            "title": "Đọc và kiểm tra cấu trúc file",
            "description": f"Đọc file {file_row.get('name')} với {parsed.row_count} dòng, {parsed.col_count} cột: {', '.join(headers[:8])}.",
            "type": "read_data",
            "status": "pending",
        }
    ]
    if any(k in goal_l for k in ["sạch", "clean", "lỗi", "trống", "chuẩn"]):
        steps.append({"id": "step_clean", "order": len(steps) + 1, "title": "Làm sạch và chuẩn hóa dữ liệu", "description": "Phát hiện ô trống, dòng trùng, định dạng ngày/số bất thường và đề xuất chuẩn hóa.", "type": "clean_data", "status": "pending"})
    if any(k in goal_l for k in ["báo cáo", "doanh thu", "phân tích", "kpi", "report", "sales"]) or columns.get("amount"):
        target = columns.get("amount") or "cột số phù hợp"
        group = columns.get("date") or columns.get("category") or "nhóm dữ liệu chính"
        steps.append({"id": "step_analyze", "order": len(steps) + 1, "title": "Phân tích và tổng hợp KPI", "description": f"Tổng hợp {target} theo {group}, tính tổng, trung bình, min/max và số dòng.", "type": "analyze_data", "status": "pending"})
    if any(k in goal_l for k in ["bất thường", "outlier", "anomaly", "lỗi"]) or columns.get("amount"):
        steps.append({"id": "step_anomaly", "order": len(steps) + 1, "title": "Phát hiện bất thường", "description": "Tìm giá trị âm, giá trị quá xa trung bình, dòng thiếu dữ liệu và duplicate trong preview thật.", "type": "detect_anomaly", "status": "pending"})
    if any(k in goal_l for k in ["công thức", "formula", "excel"]):
        steps.append({"id": "step_formula", "order": len(steps) + 1, "title": "Đề xuất công thức Excel", "description": "Gợi ý công thức dựa trên headers thật và mục tiêu xử lý của người dùng.", "type": "generate_formula", "status": "pending"})
    steps.append({"id": "step_output", "order": len(steps) + 1, "title": "Tạo bản nháp kết quả", "description": "Tạo preview, insight, cảnh báo và file Excel kết quả có các sheet Summary, Warnings, Insights.", "type": "generate_report", "status": "pending"})
    profile = {
        "fileName": file_row.get("name"),
        "rowCount": parsed.row_count,
        "columnCount": parsed.col_count,
        "headers": headers,
        "columns": _column_profile(headers, parsed.rows),
        "detectedColumns": columns,
        "previewRows": parsed.preview_rows[:10],
    }
    expected = {"type": "excel_report", "description": "File Excel kết quả gồm preview dữ liệu, thống kê, cảnh báo và insight dựa trên dữ liệu thật."}
    return steps, expected, profile


def _numeric_columns(headers: list[str], rows: list[list[str]]) -> list[tuple[int, str, list[float]]]:
    result = []
    for idx, header in enumerate(headers):
        nums = [to_number(row[idx]) for row in rows if idx < len(row) and str(row[idx]).strip() != ""]
        non_zero = [value for value in nums if value != 0]
        if len(non_zero) >= max(3, min(10, len(rows) // 4)):
            result.append((idx, header, non_zero))
    return result[:8]


def _draft_from_data(db, current_user: dict, plan: dict, file_row: dict, parsed) -> tuple[dict, dict | None]:
    headers = parsed.headers
    rows = parsed.rows
    stats = build_statistics(headers, rows[:300], len(rows))
    quality_errors = find_quality_errors(headers, rows, max_errors=80)
    numeric = _numeric_columns(headers, rows)
    overview_rows = [
        ["Tổng dòng", parsed.row_count],
        ["Tổng cột", parsed.col_count],
        ["Ô thiếu dữ liệu", stats.get("missingValues", 0)],
        ["Dòng trùng trong mẫu", stats.get("duplicateRows", 0)],
    ]
    for _, header, values in numeric[:5]:
        overview_rows.append([f"Tổng {header}", round(sum(values), 2)])
        overview_rows.append([f"Trung bình {header}", round(sum(values) / max(1, len(values)), 2)])
    warnings = [f"Dòng {err['row']} - {err['column']}: {err['issue']}" for err in quality_errors[:20]]
    insights = [
        f"Đã đọc {parsed.row_count} dòng và {parsed.col_count} cột từ file {file_row.get('name')}.",
        f"Phát hiện {stats.get('missingValues', 0)} ô thiếu dữ liệu trong phạm vi phân tích.",
        f"Có {len(numeric)} cột số phù hợp để phân tích KPI.",
    ]
    for _, header, values in numeric[:3]:
        avg = sum(values) / max(1, len(values))
        std = math.sqrt(sum((x - avg) ** 2 for x in values) / max(1, len(values)))
        outlier_count = len([x for x in values if std and abs(x - avg) > 2 * std])
        insights.append(f"Cột {header}: tổng {round(sum(values), 2)}, trung bình {round(avg, 2)}, {outlier_count} giá trị lệch mạnh.")

    tables = [
        {"title": "Preview dữ liệu thật", "columns": headers[:12], "rows": [row[:12] for row in rows[:20]]},
        {"title": "Thống kê tổng quan", "columns": ["Chỉ số", "Giá trị"], "rows": overview_rows},
    ]
    if quality_errors:
        tables.append({"title": "Cảnh báo dữ liệu", "columns": ["Dòng", "Cột", "Giá trị", "Vấn đề"], "rows": [[e["row"], e["column"], e["value"], e["issue"]] for e in quality_errors[:30]]})

    output = store_output(
        db,
        current_user["id"],
        build_xlsx(
            {
                "Original Preview": (headers[:12], [row[:12] for row in rows[:100]]),
                "Summary": (["Chỉ số", "Giá trị"], overview_rows),
                "Warnings": (["Cảnh báo"], [[w] for w in warnings] or [["Không phát hiện cảnh báo trong preview."]]),
                "Insights": (["Insight"], [[i] for i in insights]),
            }
        ),
        f"Autopilot_Result_{file_row.get('name') or 'output'}.xlsx",
        "xlsx",
        "autopilot",
        XLSX_CONTENT_TYPE,
        source_file_id=file_row.get("id"),
        metadata={"planId": plan["id"], "goal": plan.get("goal")},
        workspace_id=file_row.get("workspace_id"),
    )
    draft = {
        "id": str(uuid4()),
        "planId": plan["id"],
        "fileId": file_row["id"],
        "summary": f"Đã phân tích {parsed.row_count} dòng dữ liệu từ file {file_row.get('name')}.",
        "tables": tables,
        "insights": insights,
        "warnings": warnings,
        "outputFile": {"id": output["id"], "fileName": output.get("display_name"), "downloadUrl": f"/api/autopilot/output/{output['id']}/download"},
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    return draft, output


def _plan_payload(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "goal": row.get("goal"),
        "fileId": row.get("file_id"),
        "fileName": row.get("file_name"),
        "steps": _parse_json(row.get("steps"), []),
        "expectedOutput": _parse_json(row.get("expected_output"), {}),
        "fileProfile": _parse_json(row.get("file_profile"), {}),
        "status": row.get("status"),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


@router.post("/plan")
async def create_plan(payload: PlanRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    _ensure_tables(db)
    _require_autopilot(current_user)
    await check_and_increment(current_user["id"], db, "autopilot_plan")
    file_row = _file_row(db, payload.fileId, current_user)
    parsed = _load_parsed(db, file_row)
    if not parsed.headers or parsed.row_count == 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="File không có dữ liệu đủ để lập kế hoạch.")
    steps, expected, profile = _build_plan(payload.goal.strip(), file_row, parsed)
    plan_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()
    rows = db.fetch(
        """
        INSERT INTO autopilot_plans (id, user_id, file_id, goal, file_name, steps, expected_output, file_profile, status, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, 'planned', %s, %s)
        RETURNING *
        """,
        [plan_id, current_user["id"], file_row["id"], payload.goal.strip(), file_row.get("name") or "", _json(steps), _json(expected), _json(profile), now, now],
        commit=True,
    )
    return {"success": True, "plan": _plan_payload(rows[0])}


@router.patch("/plan/{plan_id}")
async def update_plan(plan_id: str, payload: PlanPatchRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    _ensure_tables(db)
    rows = db.table("autopilot_plans").select("*").eq("id", plan_id).eq("user_id", current_user["id"]).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy kế hoạch.")
    steps = []
    for index, step in enumerate(payload.steps or [], start=1):
        title = str(step.get("title") or "").strip()
        desc = str(step.get("description") or step.get("desc") or "").strip()
        if not title or not desc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Mỗi bước cần có title và description.")
        steps.append({**step, "id": str(step.get("id") or f"step_{index}"), "order": index, "title": title[:160], "description": desc[:1000], "status": step.get("status") or "pending", "type": step.get("type") or "custom"})
    now = datetime.now(timezone.utc).isoformat()
    if payload.goal is not None:
        updated = db.fetch(
            """
            UPDATE autopilot_plans
            SET steps = %s::jsonb, goal = %s, updated_at = %s
            WHERE id = %s AND user_id = %s
            RETURNING *
            """,
            [_json(steps), payload.goal.strip(), now, plan_id, current_user["id"]],
            commit=True,
        )
    else:
        updated = db.fetch(
            """
            UPDATE autopilot_plans
            SET steps = %s::jsonb, updated_at = %s
            WHERE id = %s AND user_id = %s
            RETURNING *
            """,
            [_json(steps), now, plan_id, current_user["id"]],
            commit=True,
        )
    return {"success": True, "plan": _plan_payload(updated[0] if updated else rows[0])}


@router.post("/draft")
async def create_draft(payload: DraftRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    _ensure_tables(db)
    _require_autopilot(current_user)
    await check_and_increment(current_user["id"], db, "autopilot_draft")
    plan_rows = db.table("autopilot_plans").select("*").eq("id", payload.planId).eq("user_id", current_user["id"]).limit(1).execute().data or []
    if not plan_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy kế hoạch.")
    plan = plan_rows[0]
    file_row = _file_row(db, plan["file_id"], current_user)
    parsed = _load_parsed(db, file_row)
    draft, output = _draft_from_data(db, current_user, plan, file_row, parsed)
    now = datetime.now(timezone.utc).isoformat()
    db.fetch(
        """
        INSERT INTO autopilot_drafts (id, user_id, plan_id, file_id, summary, tables, insights, warnings, output_file_id, status, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s, 'completed', %s, %s)
        """,
        [draft["id"], current_user["id"], plan["id"], file_row["id"], draft["summary"], _json(draft["tables"]), _json(draft["insights"]), _json(draft["warnings"]), output["id"], now, now],
        commit=True,
    )
    db.table("autopilot_plans").update({"status": "completed", "updated_at": now}).eq("id", plan["id"]).eq("user_id", current_user["id"]).execute()
    return {"success": True, "draft": draft}


@router.get("/history")
async def history(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    _ensure_tables(db)
    rows = db.fetch(
        """
        SELECT p.*, d.id AS draft_id, d.output_file_id
        FROM autopilot_plans p
        LEFT JOIN LATERAL (
            SELECT id, output_file_id FROM autopilot_drafts
            WHERE plan_id = p.id
            ORDER BY created_at DESC
            LIMIT 1
        ) d ON TRUE
        WHERE p.user_id = %s
        ORDER BY p.created_at DESC
        LIMIT 50
        """,
        [current_user["id"]],
    )
    items = []
    for row in rows:
        steps = _parse_json(row.get("steps"), [])
        items.append({"planId": row["id"], "draftId": row.get("draft_id"), "fileName": row.get("file_name"), "goal": row.get("goal"), "status": row.get("status"), "createdAt": row.get("created_at"), "updatedAt": row.get("updated_at"), "stepCount": len(steps), "hasOutputFile": bool(row.get("output_file_id"))})
    return {"success": True, "items": items}


@router.get("/history/{plan_id}")
async def history_detail(plan_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    _ensure_tables(db)
    rows = db.table("autopilot_plans").select("*").eq("id", plan_id).eq("user_id", current_user["id"]).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy lịch sử Autopilot.")
    draft_rows = db.table("autopilot_drafts").select("*").eq("plan_id", plan_id).eq("user_id", current_user["id"]).order("created_at", desc=True).limit(1).execute().data or []
    draft = None
    if draft_rows:
        row = draft_rows[0]
        draft = {"id": row["id"], "planId": row["plan_id"], "summary": row.get("summary"), "tables": _parse_json(row.get("tables"), []), "insights": _parse_json(row.get("insights"), []), "warnings": _parse_json(row.get("warnings"), []), "outputFile": {"id": row.get("output_file_id"), "downloadUrl": f"/api/autopilot/output/{row.get('output_file_id')}/download"} if row.get("output_file_id") else None, "createdAt": row.get("created_at")}
    return {"success": True, "plan": _plan_payload(rows[0]), "draft": draft}


@router.get("/output/{output_id}/download")
async def download_output(output_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    rows = db.table("output_files").select("*").eq("id", output_id).eq("user_id", current_user["id"]).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy file kết quả.")
    row = rows[0]
    content = StorageService(db).download_bytes(row["storage_path"])
    return Response(content=content, media_type=row.get("content_type") or XLSX_CONTENT_TYPE, headers=safe_attachment_headers(row.get("display_name") or "autopilot-output.xlsx"))
