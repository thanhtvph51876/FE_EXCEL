import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status

from auth_policy import SENSITIVE_USER_FIELDS, can_access_workspace, can_manage_workspace
from dependencies import get_current_user, get_db
from models.schemas import FeatureFlagsRequest, WorkspaceSettingsRequest


router = APIRouter(prefix="/api/settings", tags=["settings"])

DEFAULT_WORKSPACE_SETTINGS = {"workspaceName": "ExcelAI Workspace", "retention": "30"}
DEFAULT_FEATURE_FLAGS = {
    "enable_autopilot": True,
    "enable_table_builder": True,
    "enable_document_builder": True,
    "enable_data_checker": True,
    "enable_reconciliation": True,
    "enable_excel_import": True,
    "enable_export_report": True,
    "enable_pii_scanner": True,
    "enable_new_dashboard": False,
    "enable_ai_suggestion": True,
    "flags": [],
    "rolePermissions": {},
    "changeLogs": [],
}
async def _reject_sensitive_json_fields(request: Request) -> None:
    try:
        payload = await request.json()
    except Exception:
        return
    if not isinstance(payload, dict):
        return
    forbidden = sorted(SENSITIVE_USER_FIELDS.intersection(payload.keys()))
    if forbidden:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payload chứa field nhạy cảm không được phép cập nhật: {', '.join(forbidden)}.",
        )


def _parse_json(value: str | None, default: dict) -> dict:
    if not value:
        return default.copy()
    try:
        parsed = json.loads(value)
        if isinstance(parsed, dict):
            return {**default, **parsed}
    except json.JSONDecodeError:
        pass
    return default.copy()


def _get_user_setting(db, user_id: str, key: str, default: dict) -> dict:
    response = db.table("user_settings").select("*").eq("user_id", user_id).eq("key", key).limit(1).execute()
    value = response.data[0].get("value") if response.data else None
    return _parse_json(value, default)


def _get_system_setting(db, key: str, default: dict) -> dict | None:
    response = db.table("settings").select("*").eq("key", key).limit(1).execute()
    if not response.data:
        return None
    return _parse_json(response.data[0].get("value"), default)


def _set_user_setting(db, user_id: str, key: str, value: dict) -> None:
    db.table("user_settings").upsert(
        {
            "user_id": user_id,
            "key": key,
            "value": json.dumps(value, ensure_ascii=False),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()


@router.get("/workspace")
async def get_workspace_settings(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    if not can_access_workspace(current_user, current_user["id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền truy cập workspace này.")
    return _get_user_setting(db, current_user["id"], "workspace", DEFAULT_WORKSPACE_SETTINGS)


@router.put("/workspace")
async def update_workspace_settings(request: Request, payload: WorkspaceSettingsRequest, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    await _reject_sensitive_json_fields(request)
    if not can_manage_workspace(current_user, current_user["id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền sửa workspace này.")
    data = payload.model_dump()
    _set_user_setting(db, current_user["id"], "workspace", data)
    return {"success": True, "settings": data}


@router.get("/feature-flags")
async def get_feature_flags(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    global_flags = _get_system_setting(db, "feature_flags", DEFAULT_FEATURE_FLAGS)
    if global_flags is not None:
        return global_flags
    return _get_user_setting(db, current_user["id"], "feature_flags", DEFAULT_FEATURE_FLAGS)


@router.put("/feature-flags")
async def update_feature_flags(request: Request, payload: FeatureFlagsRequest, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    await _reject_sensitive_json_fields(request)
    data = payload.model_dump()
    _set_user_setting(db, current_user["id"], "feature_flags", data)
    return {"success": True, "flags": data}


@router.delete("/local-cache-marker")
async def clear_browser_cache_marker(_: dict = Depends(get_current_user)):
    return {"success": True, "message": "Frontend sẽ xóa cache cục bộ không phải dữ liệu backend."}
