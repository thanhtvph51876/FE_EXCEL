import hashlib
import io
import json
import re
import secrets
import shutil
import time
import zipfile
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import bcrypt
import openpyxl
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import StreamingResponse

from auth_policy import USER_STATUSES, can_manage_billing, is_admin_email, normalize_email, normalize_status
from dependencies import get_db, require_admin, tier_limit, user_to_response, validate_tier
from entitlements import ENTITLEMENTS
from models.schemas import (
    ApiKeyCreateRequest,
    ApiKeyStatusRequest,
    AdminPasswordResetRequest,
    AdminTemplateRequest,
    AdminUserCreateRequest,
    AdminUserProfileUpdateRequest,
    AdminWorkspaceSettingsRequest,
    BroadcastRequest,
    CheckoutConfirmRequest,
    CheckoutRejectRequest,
    CouponRequest,
    FeedbackReplyRequest,
    FeedbackStatusRequest,
    FeatureFlagsRequest,
    JobRequest,
    OperationLogRequest,
    PricingConfigRequest,
    PromptConfigRequest,
    SecuritySettingsRequest,
    StatusUpdateRequest,
    SystemPromptRequest,
    TierUpdateRequest,
)
from services.session_service import revoke_user_sessions
from services.gemini_service import generate
from services.excel_service import format_file_size, parse_workbook
from services.storage_service import StorageService
from ai_evals.runner import run as run_ai_eval

try:
    import psutil
except ImportError:  # pragma: no cover - optional runtime telemetry.
    psutil = None


router = APIRouter(prefix="/api/admin", tags=["admin"])
PROCESS_STARTED_AT = time.time()

DEFAULT_PROMPT_CONFIG = {
    "systemPrompt": "Bạn là trợ lý ExcelAI Bot chuyên nghiệp của hệ thống ExcelAI. Nhiệm vụ của bạn là giải đáp thắc mắc của người dùng về Excel, Google Sheets, VBA một cách ngắn gọn, súc tích và có ví dụ đi kèm rõ ràng.",
    "freeLimit": 20,
    "formulaPrompt": "Hãy tạo công thức Excel tối ưu nhất cho yêu cầu này.",
    "vbaPrompt": "Hãy tạo mã Macro VBA Excel chuẩn hóa, có chú thích chi tiết bằng tiếng Việt.",
    "analysisPrompt": "Hãy đóng vai trò là chuyên gia phân tích dữ liệu.",
    "checkerPrompt": "Hãy đóng vai trò chuyên gia kiểm toán dữ liệu.",
    "cleanerPrompt": "Chỉ dẫn AI làm sạch dữ liệu.",
    "reconciliationPrompt": "Chỉ dẫn AI đối soát 2 bảng dữ liệu A và B.",
    "reportPrompt": "Chỉ dẫn AI xây dựng báo cáo.",
}

DEFAULT_SECURITY_SETTINGS = {
    "fileSizeLimit": 10,
    "allowedTypes": ".csv, .xlsx, .xls",
    "blockedTypes": ".exe, .bat, .cmd, .js, .vbs, .scr, .dll",
    "maxExcelRows": 100000,
    "maxExcelSheets": 20,
    "scanMalware": True,
    "blockVbaMacro": True,
    "allowXlsm": False,
    "dataRetention": 30,
    "enableMacroWarning": True,
    "rateLimit": 100,
    "uploadPerHourLimit": 30,
    "failedLoginLimit": 5,
    "accountLockMinutes": 15,
    "sensitiveDataWarning": True,
    "piiTypes": ["national_id", "phone", "email", "address", "tax_code", "bank_account"],
    "sensitiveDataAction": "mask",
    "enableIpWhitelist": False,
    "enableIpBlacklist": True,
    "whitelistIps": "",
    "blacklistIps": "45.xxx.xxx.xxx\n113.xxx.xxx.xxx",
    "enableOtp2fa": True,
    "adminAccessControl": "IP Whitelist (Disabled)",
    "maintenanceMode": False,
    "appName": "ExcelAI Workspace",
    "logoUrl": "",
    "supportEmail": "support@excelai.com",
    "supportHotline": "1900 9090",
    "supportWebsite": "https://excelai.local/support",
    "timezone": "Asia/Saigon",
    "defaultLanguage": "vi",
    "appVersion": "v1.2.0",
    "environment": "Development",
    "lastUpdate": "10/06/2026 10:30",
    "maintenanceTitle": "Hệ thống đang bảo trì",
    "maintenanceMessage": "Người dùng thường sẽ bị tạm khóa truy cập cho đến khi chế độ bảo trì kết thúc.",
    "maintenanceStart": "",
    "maintenanceEnd": "",
    "maintenanceAllowAdmin": True,
    "maintenanceAllowWhitelist": True,
    "maintenanceAutoStart": False,
    "maintenanceAutoEnd": True,
}

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

DEFAULT_PRICING_CONFIG = {
    "monthly": {"pro": "149,000đ", "business": "299,000đ", "enterprise": "399,000đ", "period": "/tháng"},
    "annual": {"pro": "119,000đ", "business": "239,000đ", "enterprise": "319,000đ", "period": "/tháng (trả năm)"},
}

DEFAULT_WORKSPACE_ADMIN_SETTINGS = {
    "workspaceName": "ExcelAI Workspace",
    "retention": "30",
    "fileSizeLimit": 10,
    "allowedTypes": ".csv, .xlsx, .xls",
    "aiEnabled": True,
    "notes": "",
}

DEFAULT_AI_QUOTA_CONFIG = {
    "freeDailyRequestLimit": 20,
    "proDailyRequestLimit": 300,
    "enterpriseDailyRequestLimit": 99999,
    "monthlyTokenLimit": 10000000,
    "monthlyCostBudget": 100.0,
    "warningThreshold": 80,
    "autoBlockOnExceeded": False,
    "adminBypassQuota": True,
    "enableCache": True,
}

DEFAULT_BILLING_SETTINGS = {
    "defaultCurrency": "VND",
    "vatPercent": 0,
    "allowFreeTrial": False,
    "trialDays": 14,
    "autoLockExpiredPlan": True,
    "expirationWarningDays": 7,
    "sendRenewalEmail": True,
    "allowCouponStacking": False,
    "allowMidCycleUpgrade": True,
    "allowDowngrade": True,
    "refundPolicy": "manual_review",
    "billingNotificationEmail": "billing@excelai.local",
}

DEFAULT_PLAN_TOKEN_LIMITS = {
    "free": 100000,
    "pro": 1500000,
    "business": 20000000,
    "enterprise": 250000000,
}

AI_USAGE_FEATURES = (
    "data_check",
    "formula",
    "chat",
    "document_builder",
    "table_builder",
    "reconciliation",
    "autopilot",
    "report_generator",
)

PROMPT_VARIABLES = (
    ("{{user_name}}", "Tên người dùng đang đăng nhập", "string", "Nguyễn Văn A", True),
    ("{{workspace_name}}", "Tên workspace hiện tại", "string", "Finance Ops", False),
    ("{{user_plan}}", "Gói dịch vụ của người dùng", "string", "pro", False),
    ("{{language}}", "Ngôn ngữ đầu ra mong muốn", "string", "vi", False),
    ("{{uploaded_file_name}}", "Tên file đang được phân tích", "string", "bao-cao.xlsx", False),
    ("{{sheet_name}}", "Tên sheet đang thao tác", "string", "Sheet1", False),
    ("{{table_schema}}", "Schema bảng hoặc cột dữ liệu", "json", '{"columns":["A","B"]}', False),
    ("{{error_message}}", "Thông báo lỗi cần phân tích", "string", "Formula parse error", False),
    ("{{feature_name}}", "Tên tính năng AI", "string", "formula", False),
    ("{{current_date}}", "Ngày hiện tại theo hệ thống", "date", "2026-06-08", False),
)

DEFAULT_AI_ROUTING_SETTINGS = {
    "freeChatLimitPerDay": 20,
    "proChatLimitPerDay": 300,
    "enterpriseChatLimitPerDay": 99999,
    "defaultModel": "gemini-1.5-flash",
    "fallbackModel": "gemini-1.5-flash",
    "temperature": 0.4,
    "maxTokens": 4096,
    "topP": 0.95,
    "timeoutSeconds": 45,
    "retryCount": 2,
    "enableStreaming": True,
    "enableCache": True,
    "cacheTTL": 3600,
    "enablePromptLogging": True,
    "enableOutputModeration": True,
}

DEFAULT_SAFETY_RULES = [
    {"key": "excel_scope", "name": "Stay within Excel/Sheets/VBA scope", "enabled": True, "severity": "Medium"},
    {"key": "dangerous_macros", "name": "Do not generate dangerous macros", "enabled": True, "severity": "Critical"},
    {"key": "password_bypass", "name": "Do not bypass file passwords", "enabled": True, "severity": "High"},
    {"key": "mask_sensitive_data", "name": "Mask sensitive data", "enabled": True, "severity": "High"},
    {"key": "no_fabrication", "name": "Do not fabricate missing data", "enabled": True, "severity": "Medium"},
    {"key": "warn_destructive_vba", "name": "Warn before destructive VBA", "enabled": True, "severity": "High"},
    {"key": "block_unsafe_code", "name": "Block unsafe code suggestions", "enabled": True, "severity": "Critical"},
    {"key": "confirm_bulk_changes", "name": "Require confirmation for bulk delete/update code", "enabled": True, "severity": "Medium"},
]

DEFAULT_TEMPLATE_CATEGORIES = ["Kế toán", "Nhân sự", "Quản trị", "Bán hàng", "Kho vận", "Tài chính", "Dự án", "Báo cáo"]
DEFAULT_TEMPLATE_TAGS = ["lương", "doanh thu", "nhập liệu", "báo cáo tháng", "kiểm kê", "hợp đồng", "công nợ", "KPI"]
DEFAULT_TEMPLATE_PERMISSIONS = {
    "accessLevel": "Public",
    "permissions": {
        "viewTemplate": True,
        "downloadTemplate": True,
        "useWithAI": True,
        "editTemplate": False,
        "deleteTemplate": False,
        "shareTemplate": True,
    },
}
TEMPLATE_ALLOWED_EXTENSIONS = (".xlsx", ".xls", ".xlsm", ".csv")


def _json_default(value: str | None, default: dict) -> dict:
    if not value:
        return default.copy()
    try:
        parsed = json.loads(value)
        if isinstance(parsed, dict):
            return {**default, **parsed}
    except json.JSONDecodeError:
        pass
    return default.copy()


def _get_json_setting(db, key: str, default: dict) -> dict:
    response = db.table("settings").select("*").eq("key", key).limit(1).execute()
    value = response.data[0].get("value") if response.data else None
    return _json_default(value, default)


def _set_json_setting(db, key: str, value: dict) -> None:
    db.table("settings").upsert({"key": key, "value": json.dumps(value, ensure_ascii=False), "updated_at": datetime.now(timezone.utc).isoformat()}).execute()


def _get_user_json_setting(db, user_id: str, key: str, default: dict) -> dict:
    response = db.table("user_settings").select("*").eq("user_id", user_id).eq("key", key).limit(1).execute()
    value = response.data[0].get("value") if response.data else None
    return _json_default(value, default)


def _set_user_json_setting(db, user_id: str, key: str, value: dict) -> None:
    db.table("user_settings").upsert(
        {
            "user_id": user_id,
            "key": key,
            "value": json.dumps(value, ensure_ascii=False),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()


def _price_to_int(value: str | int | float | None) -> int:
    if isinstance(value, (int, float)):
        return int(value)
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    return int(digits) if digits else 0


def _money_label(value: int, currency: str = "VND") -> str:
    if currency == "VND":
        return f"{int(value or 0):,}đ".replace(",", ".")
    return f"{currency} {int(value or 0):,}"


def _plan_name(plan_code: str) -> str:
    names = {"free": "Free", "pro": "Pro", "business": "Business", "enterprise": "Enterprise"}
    return names.get((plan_code or "").lower(), (plan_code or "custom").title())


def _pricing_plan_defaults(pricing: dict, users_by_tier: dict[str, int]) -> list[dict]:
    monthly = pricing.get("monthly") or {}
    annual = pricing.get("annual") or {}
    descriptions = {
        "free": "Gói miễn phí cho người dùng bắt đầu với ExcelAI.",
        "pro": "Gói cá nhân nâng cao cho AI Excel hằng ngày.",
        "business": "Gói đội nhóm có quota và workspace lớn hơn.",
        "enterprise": "Gói doanh nghiệp cho workload lớn và hỗ trợ riêng.",
    }
    plans = []
    for plan_code in ("free", "pro", "business", "enterprise"):
        ent = ENTITLEMENTS.get(plan_code, ENTITLEMENTS["free"])
        monthly_price = 0 if plan_code == "free" else _price_to_int(monthly.get(plan_code))
        yearly_price = 0 if plan_code == "free" else _price_to_int(annual.get(plan_code))
        enabled_features = [key for key, value in ent.items() if key.startswith("can_") and bool(value)]
        plans.append(
            {
                "planName": _plan_name(plan_code),
                "planCode": plan_code,
                "monthlyPrice": monthly_price,
                "yearlyPrice": yearly_price,
                "description": descriptions[plan_code],
                "monthlyUsageLimit": int(ent.get("ai_requests_per_month") or 0),
                "monthlyTokenLimit": DEFAULT_PLAN_TOKEN_LIMITS.get(plan_code, 0),
                "workspaceLimit": 1 if plan_code in {"free", "pro"} else 5 if plan_code == "business" else 999,
                "storageLimit": int(ent.get("max_files") or 0) * int(ent.get("max_file_size_mb") or 0),
                "uploadLimit": int(ent.get("max_files") or 0),
                "enabledFeatures": enabled_features,
                "status": "active",
                "publicPurchaseEnabled": plan_code != "enterprise",
                "manualUpgradeEnabled": True,
                "highlighted": plan_code == "pro",
                "activeSubscriptions": users_by_tier.get(plan_code, 0),
            }
        )
    return plans


def _merged_pricing_plans(db, users_by_tier: dict[str, int]) -> list[dict]:
    pricing = _get_json_setting(db, "pricing_config", DEFAULT_PRICING_CONFIG)
    defaults = {plan["planCode"]: plan for plan in _pricing_plan_defaults(pricing, users_by_tier)}
    saved = _get_json_setting(db, "billing_pricing_plans", {"plans": []}).get("plans") or []
    for plan in saved:
        code = str(plan.get("planCode") or "").strip().lower()
        if not code:
            continue
        defaults[code] = {**defaults.get(code, {}), **plan, "planCode": code}
    return list(defaults.values())


def _sync_pricing_config_from_plans(db, plans: list[dict]) -> None:
    pricing = _get_json_setting(db, "pricing_config", DEFAULT_PRICING_CONFIG)
    monthly = {**DEFAULT_PRICING_CONFIG["monthly"], **(pricing.get("monthly") or {})}
    annual = {**DEFAULT_PRICING_CONFIG["annual"], **(pricing.get("annual") or {})}
    for plan in plans:
        code = str(plan.get("planCode") or "").strip().lower()
        if code == "free" or not code:
            continue
        monthly[code] = _money_label(int(plan.get("monthlyPrice") or 0))
        annual[code] = _money_label(int(plan.get("yearlyPrice") or 0))
    _set_json_setting(db, "pricing_config", {"monthly": monthly, "annual": annual})


def _coupon_payload(row: dict, metadata: dict | None = None, checkouts: list[dict] | None = None) -> dict:
    metadata = metadata or {}
    checkouts = checkouts or []
    code = str(row.get("code") or metadata.get("code") or "").upper()
    used = sum(1 for checkout in checkouts if code and code in str(checkout.get("note") or "").upper())
    discount_type = metadata.get("discountType") or "percent"
    discount_value = metadata.get("discountValue")
    if discount_value is None:
        discount_value = int(row.get("percent") or 0)
    max_usage = int(metadata.get("maxUsage") or 999999)
    return {
        "code": code,
        "campaignName": metadata.get("campaignName") or f"Coupon {code}",
        "discountType": discount_type,
        "discountValue": discount_value,
        "percent": int(row.get("percent") or discount_value or 0),
        "applicablePlans": metadata.get("applicablePlans") or ["pro", "business", "enterprise"],
        "maxUsage": max_usage,
        "usagePerUser": int(metadata.get("usagePerUser") or 1),
        "used": used,
        "startDate": metadata.get("startDate") or "",
        "endDate": metadata.get("endDate") or "",
        "minimumOrderValue": int(metadata.get("minimumOrderValue") or 0),
        "newUsersOnly": bool(metadata.get("newUsersOnly", False)),
        "firstPurchaseOnly": bool(metadata.get("firstPurchaseOnly", False)),
        "status": metadata.get("status") or "active",
        "revenueImpact": int(metadata.get("revenueImpact") or 0),
    }


def _prompt_defaults(config: dict) -> list[dict]:
    mapping = [
        ("chatbot", "systemPrompt", "Chatbot", "Prompt hội thoại tổng quát"),
        ("formula", "formulaPrompt", "Formula Generator", "Prompt sinh công thức Excel"),
        ("vba", "vbaPrompt", "VBA/Macro", "Prompt viết VBA/Macro"),
        ("data_check", "checkerPrompt", "AI Checker", "Prompt rà lỗi dữ liệu"),
        ("cleaner", "cleanerPrompt", "Data Cleaning", "Prompt làm sạch dữ liệu"),
        ("reconciliation", "reconciliationPrompt", "Data Reconciliation", "Prompt đối soát dữ liệu"),
        ("report_generator", "reportPrompt", "Report Generator", "Prompt xây dựng báo cáo"),
        ("autopilot", "analysisPrompt", "Autopilot", "Prompt phân tích/tự động hóa"),
    ]
    now = datetime.now(timezone.utc).isoformat()
    return [
        {
            "promptName": label,
            "promptKey": key,
            "feature": key,
            "description": description,
            "systemPrompt": config.get(config_key) or "",
            "promptTemplate": config.get(config_key) or "",
            "allowedVariables": ["{{user_name}}", "{{workspace_name}}", "{{current_date}}"],
            "outputFormatRules": "Trả lời rõ ràng, có cấu trúc, ưu tiên tiếng Việt.",
            "defaultLanguage": "vi",
            "tone": "professional",
            "status": "Active",
            "environment": "Production",
            "version": 1,
            "updatedBy": "system",
            "updatedAt": now,
            "lastTestedAt": now,
        }
        for key, config_key, label, description in mapping
    ]


def _merged_prompts(db) -> list[dict]:
    config = _get_json_setting(db, "prompt_config", DEFAULT_PROMPT_CONFIG)
    defaults = {prompt["promptKey"]: prompt for prompt in _prompt_defaults(config)}
    saved = _get_json_setting(db, "ai_prompt_registry", {"prompts": []}).get("prompts") or []
    for prompt in saved:
        key = str(prompt.get("promptKey") or "").strip()
        if key:
            defaults[key] = {**defaults.get(key, {}), **prompt}
    return list(defaults.values())


def _api_key_payload(row: dict, raw_key: str | None = None) -> dict:
    payload = {
        "id": row.get("id"),
        "label": row.get("label") or "API Key",
        "provider": row.get("provider") or "excelai",
        "key": raw_key or row.get("masked_key") or "",
        "status": row.get("status") or "active",
        "created": row.get("created_at"),
        "usage": [row.get("daily_usage") or 0],
        "latency": row.get("latency") or 0,
        "errorRate": float(row.get("error_rate") or 0),
    }
    return payload


def _job_payload(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "fileName": row.get("file_name"),
        "owner": row.get("owner") or "",
        "size": row.get("size") or "",
        "type": row.get("type") or "upload",
        "status": row.get("status") or "ready",
        "duration": row.get("duration") or "",
        "error": row.get("error") or "",
        "createdAt": row.get("created_at"),
    }


def _feedback_payload(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "userName": row.get("user_name") or "",
        "type": row.get("type") or "support",
        "text": row.get("text") or "",
        "status": row.get("status") or "new",
        "reply": row.get("reply") or "",
        "createdAt": row.get("created_at"),
    }


def _broadcast_payload(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "message": row.get("message") or "",
        "severity": row.get("severity") or "warning",
        "forceLogout": bool(row.get("force_logout")),
        "countdownSeconds": row.get("countdown_seconds") or 60,
        "active": bool(row.get("active")),
        "createdBy": row.get("created_by"),
        "startsAt": row.get("starts_at"),
        "expiresAt": row.get("expires_at"),
        "createdAt": row.get("created_at"),
    }


def _template_payload(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "name": row.get("name") or "",
        "category": row.get("category") or "",
        "description": row.get("description") or "",
        "file": row.get("file") or "",
        "icon": row.get("icon") or "XL",
        "color": row.get("color") or "accent",
        "createdAt": row.get("created_at"),
    }


def _template_safe_filename(filename: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", filename or "template.xlsx").strip("._") or "template.xlsx"


def _template_metadata(db) -> dict:
    return _get_json_setting(db, "template_admin_metadata", {"templates": {}}).get("templates") or {}


def _set_template_metadata(db, metadata: dict) -> None:
    _set_json_setting(db, "template_admin_metadata", {"templates": metadata})


def _template_versions(db) -> dict:
    return _get_json_setting(db, "template_versions", {"versions": {}}).get("versions") or {}


def _set_template_versions(db, versions: dict) -> None:
    _set_json_setting(db, "template_versions", {"versions": versions})


def _template_permissions(db) -> dict:
    return _get_json_setting(db, "template_permissions", {"permissions": {}}).get("permissions") or {}


def _set_template_permissions(db, permissions: dict) -> None:
    _set_json_setting(db, "template_permissions", {"permissions": permissions})


def _template_file_type(file_name: str) -> str:
    suffix = str(file_name or "").lower().rsplit(".", 1)
    return f".{suffix[-1]}" if len(suffix) == 2 else ""


def _template_has_macros(filename: str, content: bytes) -> bool:
    lower = filename.lower()
    if not lower.endswith((".xlsx", ".xlsm")):
        return False
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            return any(name.lower().endswith("vbaproject.bin") for name in archive.namelist())
    except zipfile.BadZipFile:
        return False


def _template_sheet_names(filename: str, content: bytes) -> list[str]:
    lower = filename.lower()
    if lower.endswith((".xlsx", ".xlsm")):
        try:
            workbook = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=False, keep_vba=lower.endswith(".xlsm"))
            names = list(workbook.sheetnames)
            workbook.close()
            return names or ["Sheet1"]
        except Exception:
            return ["Sheet1"]
    if lower.endswith(".csv"):
        return ["CSV"]
    return ["Sheet1"]


def _parse_template_content(filename: str, content: bytes):
    if filename.lower().endswith(".xlsm"):
        return parse_workbook(filename[:-5] + ".xlsx", content)
    return parse_workbook(filename, content)


def _template_advanced_payload(row: dict, metadata: dict | None = None, permissions: dict | None = None) -> dict:
    metadata = metadata or {}
    permissions = permissions or DEFAULT_TEMPLATE_PERMISSIONS
    template_id = row.get("id")
    file_name = metadata.get("fileName") or row.get("file") or f"{template_id}.xlsx"
    status_value = metadata.get("status") or "Active"
    return {
        "id": template_id,
        "templateName": row.get("name") or "",
        "templateCode": template_id,
        "category": metadata.get("category") or row.get("category") or "",
        "description": row.get("description") or "",
        "fileName": file_name,
        "fileType": _template_file_type(file_name),
        "fileSize": int(metadata.get("fileSize") or 0),
        "fileSizeLabel": metadata.get("fileSizeLabel") or format_file_size(int(metadata.get("fileSize") or 0)),
        "storagePath": metadata.get("storagePath") or "",
        "icon": row.get("icon") or metadata.get("icon") or "XL",
        "tags": metadata.get("tags") or [],
        "version": metadata.get("version") or "1.0.0",
        "status": status_value,
        "accessLevel": metadata.get("accessLevel") or permissions.get("accessLevel") or "Public",
        "allowedDepartments": metadata.get("allowedDepartments") or [],
        "allowedPlans": metadata.get("allowedPlans") or [],
        "allowDownload": bool(metadata.get("allowDownload", True)),
        "allowAIBuilder": bool(metadata.get("allowAIBuilder", True)),
        "allowClone": bool(metadata.get("allowClone", True)),
        "internalNote": metadata.get("internalNote") or "",
        "createdBy": metadata.get("createdBy") or "admin",
        "updatedAt": metadata.get("updatedAt") or row.get("created_at"),
        "createdAt": row.get("created_at"),
        "downloads": int(metadata.get("downloads") or 0),
        "aiUses": int(metadata.get("aiUses") or 0),
        "usedByActiveWorkflows": int(metadata.get("usedByActiveWorkflows") or 0),
        "needUpdate": bool(metadata.get("needUpdate", False)),
        "premium": str(metadata.get("accessLevel") or permissions.get("accessLevel") or "").lower() in {"plan-based", "role-based", "private"},
        "permissions": permissions.get("permissions") or DEFAULT_TEMPLATE_PERMISSIONS["permissions"],
    }


def _template_validation_from_payload(template: dict, preview: dict | None = None) -> dict:
    preview = preview or {}
    checks = []
    file_type = template.get("fileType") or ""
    checks.append({"key": "fileFormat", "label": "fileFormat", "status": "Passed" if file_type in TEMPLATE_ALLOWED_EXTENSIONS else "Failed", "detail": file_type or "unknown"})
    checks.append({"key": "hasVBA Macro", "label": "hasVBA Macro", "status": "Warning" if preview.get("hasMacros") else "Passed", "detail": "Macro detected" if preview.get("hasMacros") else "No macro"})
    checks.append({"key": "sheetCount", "label": "sheetCount", "status": "Passed" if int(preview.get("sheetCount") or 1) >= 1 else "Failed", "detail": str(preview.get("sheetCount") or 1)})
    checks.append({"key": "rowCount", "label": "rowCount", "status": "Warning" if int(preview.get("rowCount") or 0) > 100000 else "Passed", "detail": str(preview.get("rowCount") or 0)})
    checks.append({"key": "columnCount", "label": "columnCount", "status": "Passed" if int(preview.get("columnCount") or 0) <= 256 else "Warning", "detail": str(preview.get("columnCount") or 0)})
    checks.append({"key": "formulaErrors", "label": "formulaErrors", "status": "Warning" if preview.get("formulaCells") else "Passed", "detail": f"{len(preview.get('formulaCells') or [])} formula cells"})
    checks.append({"key": "mergedCells", "label": "mergedCells", "status": "Passed", "detail": "Not scanned"})
    checks.append({"key": "hiddenSheets", "label": "hiddenSheets", "status": "Passed", "detail": "Not scanned"})
    checks.append({"key": "sensitiveData", "label": "sensitiveData", "status": "Warning" if preview.get("sensitiveDataWarning") else "Passed", "detail": "PII patterns" if preview.get("sensitiveDataWarning") else "No obvious PII"})
    checks.append({"key": "requiredColumns", "label": "requiredColumns", "status": "Passed" if preview.get("columnNames") else "Warning", "detail": ", ".join((preview.get("columnNames") or [])[:6])})
    checks.append({"key": "fileSize", "label": "fileSize", "status": "Failed" if int(template.get("fileSize") or 0) > 50 * 1024 * 1024 else "Passed", "detail": template.get("fileSizeLabel")})
    checks.append({"key": "passwordProtected", "label": "passwordProtected", "status": "Passed", "detail": "Not detected"})
    overall = "Failed" if any(row["status"] == "Failed" for row in checks) else "Warning" if any(row["status"] == "Warning" for row in checks) else "Passed"
    return {"overallStatus": overall, "checks": checks, "validatedAt": datetime.now(timezone.utc).isoformat()}


def _parse_size_to_bytes(value: str | int | float | None) -> int:
    if isinstance(value, (int, float)):
        return int(value)
    text = str(value or "").strip().lower().replace(",", ".")
    if not text:
        return 0
    try:
        number = float("".join(ch for ch in text if ch.isdigit() or ch == ".") or 0)
    except ValueError:
        return 0
    if "gb" in text:
        return int(number * 1024 * 1024 * 1024)
    if "mb" in text:
        return int(number * 1024 * 1024)
    if "kb" in text:
        return int(number * 1024)
    return int(number)


def _bytes_label(value: int) -> str:
    if value >= 1024 * 1024 * 1024:
        return f"{value / (1024 * 1024 * 1024):.2f} GB"
    if value >= 1024 * 1024:
        return f"{value / (1024 * 1024):.2f} MB"
    if value >= 1024:
        return f"{value / 1024:.2f} KB"
    return f"{value} B"


def _iso_text(value) -> str:
    if not value:
        return ""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _workspace_payload(user: dict, files_count: int, workspace_settings: dict | None = None, storage_bytes: int = 0, member_count: int = 1, last_activity_at: str | None = None, failed_files: int = 0) -> dict:
    workspace_settings = workspace_settings or {}
    workspace_name = workspace_settings.get("workspaceName") or f"Workspace của {user.get('name') or user.get('email') or 'Người dùng'}"
    retention = workspace_settings.get("retention") or "Theo cấu hình backend"
    tier = user.get("tier") or "free"
    entitlement = ENTITLEMENTS.get(tier, ENTITLEMENTS["free"])
    file_limit = int(entitlement.get("max_files") or 0)
    max_file_mb = int(entitlement.get("max_file_size_mb") or 0)
    storage_limit_bytes = max(0, file_limit * max_file_mb * 1024 * 1024)
    storage_percent = round((storage_bytes / max(1, storage_limit_bytes)) * 100, 2) if storage_limit_bytes else 0
    return {
        "userId": user.get("id"),
        "name": workspace_name,
        "ownerName": user.get("name") or "",
        "ownerEmail": user.get("email") or "",
        "plan": tier,
        "planLabel": tier.capitalize() if tier != "enterprise" else "Enterprise",
        "memberCount": member_count,
        "fileCount": files_count,
        "fileLimit": file_limit,
        "failedFileCount": failed_files,
        "storageUsedBytes": storage_bytes,
        "storageUsed": _bytes_label(storage_bytes),
        "storageLimitBytes": storage_limit_bytes,
        "storageLimit": _bytes_label(storage_limit_bytes),
        "storageUsagePercent": storage_percent,
        "overLimit": storage_percent >= 100 or (file_limit > 0 and files_count > file_limit),
        "retention": retention,
        "fileSizeLimit": workspace_settings.get("fileSizeLimit", DEFAULT_WORKSPACE_ADMIN_SETTINGS["fileSizeLimit"]),
        "allowedTypes": workspace_settings.get("allowedTypes") or DEFAULT_WORKSPACE_ADMIN_SETTINGS["allowedTypes"],
        "aiEnabled": bool(workspace_settings.get("aiEnabled", DEFAULT_WORKSPACE_ADMIN_SETTINGS["aiEnabled"])),
        "notes": workspace_settings.get("notes") or "",
        "status": normalize_status(user.get("status")),
        "createdAt": user.get("created_at"),
        "lastActivityAt": last_activity_at or user.get("created_at"),
    }


def _checkout_payload(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "userId": row.get("user_id"),
        "planCode": row.get("plan_code"),
        "amount": row.get("amount"),
        "currency": row.get("currency"),
        "status": row.get("status"),
        "note": row.get("note") or "",
        "adminNote": row.get("admin_note") or "",
        "confirmedBy": row.get("confirmed_by"),
        "confirmedAt": row.get("confirmed_at"),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def _validate_user_status(value: str) -> str:
    normalized = normalize_status(value)
    if normalized not in USER_STATUSES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Trạng thái tài khoản không hợp lệ.")
    return normalized


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _create_user_with_audit(db, admin_user: dict, payload: AdminUserCreateRequest) -> dict:
    email = normalize_email(payload.email)
    if is_admin_email(email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không thể tạo tài khoản admin tổng từ màn quản lý user.")

    existing = db.table("users").select("id").eq("email", email).limit(1).execute().data or []
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email này đã tồn tại.")

    tier = validate_tier(payload.tier)
    account_status = _validate_user_status(payload.status)
    user_id = str(uuid4())
    profile = {
        "id": user_id,
        "name": payload.name.strip()[:100],
        "email": email[:150],
        "password_hash": _hash_password(payload.password),
        "tier": tier,
        "usage_count": 0,
        "usage_limit": tier_limit(tier),
        "status": account_status,
        "role": "user",
    }
    response = db.table("users").insert(profile).execute()
    user = response.data[0] if response.data else profile
    reason = (payload.reason or "admin_create_user").strip()[:255] or "admin_create_user"
    db.table("operation_logs").insert(
        {
            "user_id": admin_user.get("id"),
            "type": "admin",
            "action": f"Admin created user {email}: {reason}",
        }
    ).execute()
    db.table("admin_audit_logs").insert(
        {
            "actor_admin_id": admin_user.get("id"),
            "target_user_id": user_id,
            "action": "users.create",
            "old_value": json.dumps({}),
            "new_value": json.dumps({"email": email, "tier": tier, "status": account_status}),
            "reason": reason,
        }
    ).execute()
    return {"success": True, "user": user_to_response(user)}


def _update_user_profile_with_audit(db, admin_user: dict, user_id: str, payload: AdminUserProfileUpdateRequest) -> dict:
    current_rows = db.table("users").select("*").eq("id", user_id).limit(1).execute().data or []
    if not current_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy người dùng.")

    current_user = current_rows[0]
    update_payload: dict[str, str] = {}
    old_snapshot = {
        "name": current_user.get("name") or "",
        "email": current_user.get("email") or "",
    }

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Tên người dùng không được để trống.")
        update_payload["name"] = name[:100]

    if payload.email is not None:
        email = normalize_email(payload.email)
        if len(email) < 3 or "@" not in email:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Email không hợp lệ.")
        if is_admin_email(email) and current_user.get("role") != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không thể gán email admin tổng cho user thường.")
        existing = db.table("users").select("id").eq("email", email).limit(1).execute().data or []
        if existing and str(existing[0].get("id")) != str(user_id):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email này đã thuộc tài khoản khác.")
        update_payload["email"] = email[:150]

    if not update_payload:
        return {"success": True, "user": user_to_response(current_user)}

    response = db.table("users").update(update_payload).eq("id", user_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy người dùng.")

    updated_user = response.data[0]
    new_snapshot = {
        "name": updated_user.get("name") or "",
        "email": updated_user.get("email") or "",
    }
    reason = (payload.reason or "admin_profile_update").strip()[:255] or "admin_profile_update"
    db.table("operation_logs").insert(
        {
            "user_id": admin_user.get("id"),
            "type": "admin",
            "action": f"Admin updated user profile {user_id}: {reason}",
        }
    ).execute()
    db.table("admin_audit_logs").insert(
        {
            "actor_admin_id": admin_user.get("id"),
            "target_user_id": user_id,
            "action": "users.profile.update",
            "old_value": json.dumps(old_snapshot),
            "new_value": json.dumps(new_snapshot),
            "reason": reason,
        }
    ).execute()
    return {"success": True, "user": user_to_response(updated_user)}


def _update_user_tier_with_audit(db, admin_user: dict, user_id: str, payload: TierUpdateRequest) -> dict:
    if not can_manage_billing(admin_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền quản lý billing.")
    new_tier = validate_tier(payload.tier)
    reason = (payload.reason or "admin_update").strip()[:255] or "admin_update"
    target_response = db.table("users").select("*").eq("id", user_id).limit(1).execute()
    if not target_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy người dùng.")

    target_user = target_response.data[0]
    old_tier = target_user.get("tier") or "free"
    response = (
        db.table("users")
        .update({"tier": new_tier, "usage_limit": tier_limit(new_tier)})
        .eq("id", user_id)
        .execute()
    )
    user = response.data[0] if response.data else {**target_user, "tier": new_tier, "usage_limit": tier_limit(new_tier)}
    audit_row = {
        "actor_user_id": admin_user.get("id"),
        "target_user_id": user_id,
        "actor_email_snapshot": admin_user.get("email") or "",
        "target_user_email_snapshot": target_user.get("email") or "",
        "old_tier": old_tier,
        "new_tier": new_tier,
        "reason": reason,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db.table("billing_tier_audit").insert(audit_row).execute()
    db.table("operation_logs").insert(
        {
            "user_id": admin_user.get("id"),
            "type": "billing",
            "action": f"Admin changed user {user_id} tier from {old_tier} to {new_tier}: {reason}",
        }
    ).execute()
    db.table("admin_audit_logs").insert(
        {
            "actor_admin_id": admin_user.get("id"),
            "target_user_id": user_id,
            "action": "billing.tier.update",
            "old_value": json.dumps({"tier": old_tier}),
            "new_value": json.dumps({"tier": new_tier}),
            "reason": reason,
        }
    ).execute()
    return {
        "success": True,
        "user": user_to_response(user),
        "audit": {
            "actorUserId": audit_row["actor_user_id"],
            "targetUserId": audit_row["target_user_id"],
            "oldTier": old_tier,
            "newTier": new_tier,
            "reason": reason,
            "createdAt": audit_row["created_at"],
        },
    }


@router.get("/metrics")
async def metrics(_: dict = Depends(require_admin), db = Depends(get_db)):
    users = db.table("users").select("*").execute().data or []
    files = db.table("files").select("id").execute().data or []
    jobs = db.table("jobs").select("status").execute().data or []
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    logs = db.table("operation_logs").select("*").gte("created_at", cutoff).execute().data or []
    ai_events = db.table("ai_usage_events").select("*").gte("created_at", cutoff).execute().data or []
    checkout_rows = db.table("checkout_requests").select("*").execute().data or []
    pro_count = sum(1 for user in users if user.get("tier") == "pro")
    business_count = sum(1 for user in users if user.get("tier") == "business")
    enterprise_count = sum(1 for user in users if user.get("tier") == "enterprise")
    pricing = _get_json_setting(db, "pricing_config", DEFAULT_PRICING_CONFIG)
    pro_price = _price_to_int((pricing.get("monthly") or {}).get("pro"))
    enterprise_price = _price_to_int((pricing.get("monthly") or {}).get("enterprise"))
    business_price = _price_to_int((pricing.get("monthly") or {}).get("business"))
    failed_jobs = sum(1 for job in jobs if job.get("status") in {"failed", "error", "Lỗi"})
    uptime_seconds = max(0, int(time.time() - PROCESS_STARTED_AT))
    uptime_hours = uptime_seconds // 3600
    uptime_minutes = (uptime_seconds % 3600) // 60
    error_rate = round((failed_jobs / max(1, len(jobs))) * 100, 2)
    return {
        "mrr": pro_count * pro_price + business_count * business_price + enterprise_count * enterprise_price,
        "totalUsers": len(users),
        "activeUsers": sum(1 for user in users if normalize_status(user.get("status")) == "active"),
        "uptime": f"{uptime_hours}h {uptime_minutes}m",
        "uptimeSeconds": uptime_seconds,
        "apiRequestsCount": len(logs),
        "filesProcessed": len(files),
        "totalJobs": len(jobs),
        "failedJobs": failed_jobs,
        "errorRate": f"{error_rate}%",
        "usersByTier": {"free": sum(1 for user in users if user.get("tier") == "free"), "pro": pro_count, "business": business_count, "enterprise": enterprise_count},
        "pendingCheckoutRequests": sum(1 for row in checkout_rows if row.get("status") == "pending"),
        "confirmedCheckoutRequests": sum(1 for row in checkout_rows if row.get("status") == "confirmed"),
        "manualRevenueEstimate": sum(int(row.get("amount") or 0) for row in checkout_rows if row.get("status") == "confirmed"),
        "aiRequestsToday": len(ai_events),
        "aiCostEstimateToday": float(sum(row.get("estimated_cost") or 0 for row in ai_events)),
        "providerErrors": sum(1 for row in ai_events if row.get("status") == "failed"),
        "quotaExceededCount": sum(1 for row in ai_events if row.get("status") == "quota_exceeded"),
    }


@router.get("/users")
async def users(
    _: dict = Depends(require_admin),
    db = Depends(get_db),
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=100, ge=1, le=500),
    q: str | None = Query(default=None, max_length=120),
):
    start = (page - 1) * pageSize
    end = start + pageSize - 1
    total_rows = db.table("users").select("*").execute().data or []
    query_text = (q or "").strip().lower()
    if query_text:
        total_rows = [
            row for row in total_rows
            if query_text in str(row.get("email") or "").lower()
            or query_text in str(row.get("name") or "").lower()
            or query_text in str(row.get("id") or "").lower()
        ]
    total_rows.sort(key=lambda row: str(row.get("created_at") or ""), reverse=True)
    page_rows = total_rows[start:end + 1]
    month_start = datetime.now(timezone.utc).date().replace(day=1).isoformat()
    usage_rows = db.table("ai_usage").select("user_id,request_count,token_count").gte("usage_date", month_start).execute().data or []
    workspace_rows = db.table("user_settings").select("user_id,value").eq("key", "workspace").execute().data or []
    latest_logs = db.table("operation_logs").select("user_id,created_at,action").order("created_at", desc=True).limit(500).execute().data or []

    usage_by_user: dict[str, dict[str, int]] = {}
    for usage_row in usage_rows:
        user_id = str(usage_row.get("user_id"))
        bucket = usage_by_user.setdefault(user_id, {"requests": 0, "tokens": 0})
        bucket["requests"] += int(usage_row.get("request_count") or 0)
        bucket["tokens"] += int(usage_row.get("token_count") or 0)

    workspace_by_user = {
        str(row.get("user_id")): _json_default(row.get("value"), {})
        for row in workspace_rows
    }

    latest_log_by_user: dict[str, dict] = {}
    for log in latest_logs:
        user_id = str(log.get("user_id") or "")
        if user_id and user_id not in latest_log_by_user:
            latest_log_by_user[user_id] = log

    enriched_rows = []
    for row in page_rows:
        user_id = str(row.get("id"))
        tier = row.get("tier") or "free"
        usage = usage_by_user.get(user_id, {})
        workspace_settings = workspace_by_user.get(user_id, {})
        latest_log = latest_log_by_user.get(user_id, {})
        enriched_rows.append(
            {
                **row,
                "monthly_usage": usage.get("requests", row.get("usage_count") or 0),
                "monthly_usage_limit": ENTITLEMENTS.get(tier, ENTITLEMENTS["free"]).get("ai_requests_per_month") or row.get("usage_limit"),
                "token_usage": usage.get("tokens", 0),
                "workspace": workspace_settings.get("workspaceName") or f"Workspace của {row.get('name') or row.get('email') or 'người dùng'}",
                "last_activity_at": latest_log.get("created_at") or row.get("created_at"),
            }
        )

    return {"users": [user_to_response(row) for row in enriched_rows], "total": len(total_rows), "page": page, "pageSize": pageSize}


@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user(payload: AdminUserCreateRequest, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    return _create_user_with_audit(db, admin_user, payload)


@router.get("/workspaces")
async def workspaces(_: dict = Depends(require_admin), db = Depends(get_db)):
    users_rows = db.table("users").select("*").order("created_at", desc=True).execute().data or []
    files_rows = db.table("files").select("user_id,size,status,uploaded_at").execute().data or []
    settings_rows = db.table("user_settings").select("*").eq("key", "workspace").execute().data or []
    member_rows = db.fetch(
        """
        SELECT w.owner_user_id, COUNT(DISTINCT wm.user_id) AS member_count
        FROM workspaces w
        LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.status = 'active'
        GROUP BY w.owner_user_id
        """
    )
    log_rows = db.table("operation_logs").select("user_id,created_at").order("created_at", desc=True).limit(1000).execute().data or []
    file_counts: dict[str, int] = {}
    storage_by_user: dict[str, int] = {}
    failed_files: dict[str, int] = {}
    last_activity: dict[str, str] = {}
    for file_row in files_rows:
        user_id = str(file_row.get("user_id"))
        file_counts[user_id] = file_counts.get(user_id, 0) + 1
        storage_by_user[user_id] = storage_by_user.get(user_id, 0) + _parse_size_to_bytes(file_row.get("size"))
        if file_row.get("status") in {"failed", "error", "Lỗi"}:
            failed_files[user_id] = failed_files.get(user_id, 0) + 1
        uploaded_at = _iso_text(file_row.get("uploaded_at"))
        if uploaded_at and uploaded_at > last_activity.get(user_id, ""):
            last_activity[user_id] = uploaded_at
    for log_row in log_rows:
        user_id = str(log_row.get("user_id") or "")
        created_at = _iso_text(log_row.get("created_at"))
        if user_id and created_at and created_at > last_activity.get(user_id, ""):
            last_activity[user_id] = created_at
    workspace_settings = {
        str(row.get("user_id")): _json_default(row.get("value"), {})
        for row in settings_rows
    }
    member_counts = {
        str(row.get("owner_user_id")): int(row.get("member_count") or 0)
        for row in member_rows
    }
    workspace_rows = [
        _workspace_payload(
            row,
            file_counts.get(str(row.get("id")), 0),
            workspace_settings.get(str(row.get("id"))),
            storage_by_user.get(str(row.get("id")), 0),
            max(1, member_counts.get(str(row.get("id")), 1)),
            last_activity.get(str(row.get("id"))),
            failed_files.get(str(row.get("id")), 0),
        )
        for row in users_rows
    ]
    return {
        "workspaces": workspace_rows,
        "stats": {
            "totalWorkspaces": len(workspace_rows),
            "activeWorkspaces": sum(1 for row in workspace_rows if row.get("status") == "active"),
            "lockedWorkspaces": sum(1 for row in workspace_rows if row.get("status") in {"suspended", "deleted", "inactive"}),
            "totalFiles": sum(row.get("fileCount") or 0 for row in workspace_rows),
            "totalStorageUsedBytes": sum(row.get("storageUsedBytes") or 0 for row in workspace_rows),
            "totalStorageUsed": _bytes_label(sum(row.get("storageUsedBytes") or 0 for row in workspace_rows)),
            "overLimitWorkspaces": sum(1 for row in workspace_rows if row.get("overLimit")),
            "failedFiles": sum(row.get("failedFileCount") or 0 for row in workspace_rows),
            "totalMembers": sum(row.get("memberCount") or 0 for row in workspace_rows),
        },
    }


@router.get("/workspaces/{user_id}/settings")
async def get_workspace_admin_settings(user_id: str, _: dict = Depends(require_admin), db = Depends(get_db)):
    users_rows = db.table("users").select("*").eq("id", user_id).limit(1).execute().data or []
    if not users_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy user sở hữu workspace.")
    files_count = len(db.table("files").select("id").eq("user_id", user_id).execute().data or [])
    settings_value = _get_user_json_setting(db, user_id, "workspace", DEFAULT_WORKSPACE_ADMIN_SETTINGS)
    return {"success": True, "workspace": _workspace_payload(users_rows[0], files_count, settings_value)}


@router.put("/workspaces/{user_id}/settings")
async def update_workspace_admin_settings(user_id: str, payload: AdminWorkspaceSettingsRequest, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    users_rows = db.table("users").select("*").eq("id", user_id).limit(1).execute().data or []
    if not users_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy user sở hữu workspace.")

    data = {
        "workspaceName": payload.workspaceName.strip() or DEFAULT_WORKSPACE_ADMIN_SETTINGS["workspaceName"],
        "retention": payload.retention.strip() or DEFAULT_WORKSPACE_ADMIN_SETTINGS["retention"],
        "fileSizeLimit": payload.fileSizeLimit,
        "allowedTypes": payload.allowedTypes.strip() or DEFAULT_WORKSPACE_ADMIN_SETTINGS["allowedTypes"],
        "aiEnabled": payload.aiEnabled,
        "notes": payload.notes.strip(),
    }
    _set_user_json_setting(db, user_id, "workspace", data)
    files_count = len(db.table("files").select("id").eq("user_id", user_id).execute().data or [])
    db.table("operation_logs").insert(
        {"user_id": admin_user.get("id"), "type": "workspace", "action": f"Admin updated workspace settings for user {user_id}"}
    ).execute()
    return {"success": True, "workspace": _workspace_payload(users_rows[0], files_count, data)}


@router.get("/users/{user_id}/audit")
async def user_audit(user_id: str, _: dict = Depends(require_admin), db = Depends(get_db)):
    users_rows = db.table("users").select("*").eq("id", user_id).limit(1).execute().data or []
    if not users_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy người dùng.")

    operation_logs = db.table("operation_logs").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(50).execute().data or []
    admin_audit_logs = db.table("admin_audit_logs").select("*").eq("target_user_id", user_id).order("created_at", desc=True).limit(50).execute().data or []
    billing_audit = db.table("billing_tier_audit").select("*").eq("target_user_id", user_id).order("created_at", desc=True).limit(20).execute().data or []
    checkout_rows = db.table("checkout_requests").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(20).execute().data or []
    files_rows = db.table("files").select("id,name,size,status,uploaded_at,row_count,col_count").eq("user_id", user_id).order("uploaded_at", desc=True).limit(20).execute().data or []
    ai_usage_rows = db.table("ai_usage").select("*").eq("user_id", user_id).order("usage_date", desc=True).limit(30).execute().data or []

    return {
        "success": True,
        "user": user_to_response(users_rows[0]),
        "operationLogs": operation_logs,
        "adminAuditLogs": admin_audit_logs,
        "billingAudit": billing_audit,
        "checkoutRequests": [_checkout_payload(row) for row in checkout_rows],
        "files": files_rows,
        "aiUsage": ai_usage_rows,
    }


@router.put("/users/{user_id}")
async def update_user_profile(user_id: str, payload: AdminUserProfileUpdateRequest, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    return _update_user_profile_with_audit(db, admin_user, user_id, payload)


@router.put("/users/{user_id}/tier")
async def update_user_tier(user_id: str, payload: TierUpdateRequest, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    return _update_user_tier_with_audit(db, admin_user, user_id, payload)


@router.put("/billing/users/{user_id}/tier")
async def update_user_billing_tier(user_id: str, payload: TierUpdateRequest, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    return _update_user_tier_with_audit(db, admin_user, user_id, payload)


@router.get("/billing/entitlements")
async def admin_entitlements(_: dict = Depends(require_admin)):
    return {"entitlements": ENTITLEMENTS}


@router.get("/billing/checkout-requests")
async def checkout_requests(_: dict = Depends(require_admin), db = Depends(get_db), status_filter: str | None = Query(default=None), page: int = Query(default=1, ge=1), pageSize: int = Query(default=50, ge=1, le=100)):
    query = db.table("checkout_requests").select("*")
    if status_filter:
        query = query.eq("status", status_filter)
    rows_all = query.order("created_at", desc=True).execute().data or []
    start = (page - 1) * pageSize
    return {"checkoutRequests": [_checkout_payload(row) for row in rows_all[start:start + pageSize]], "total": len(rows_all), "page": page, "pageSize": pageSize}


@router.get("/dashboards/billing")
async def billing_dashboard(_: dict = Depends(require_admin), db = Depends(get_db)):
    users = db.table("users").select("id,tier").execute().data or []
    checkouts = db.table("checkout_requests").select("*").order("created_at", desc=True).limit(100).execute().data or []
    audits = db.table("billing_tier_audit").select("*").order("created_at", desc=True).limit(20).execute().data or []
    return {
        "totalUsers": len(users),
        "usersByTier": {
            tier: sum(1 for row in users if row.get("tier") == tier)
            for tier in ("free", "pro", "business", "enterprise")
        },
        "pendingCheckoutRequests": sum(1 for row in checkouts if row.get("status") == "pending"),
        "confirmedCheckoutRequests": sum(1 for row in checkouts if row.get("status") == "confirmed"),
        "manualRevenueEstimate": sum(int(row.get("amount") or 0) for row in checkouts if row.get("status") == "confirmed"),
        "latestCheckoutRequests": [_checkout_payload(row) for row in checkouts[:20]],
        "latestBillingAudit": audits,
    }


@router.get("/dashboards/billing-advanced")
async def billing_advanced_dashboard(_: dict = Depends(require_admin), db = Depends(get_db)):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    users = db.table("users").select("id,name,email,tier,status,created_at,usage_count,usage_limit").execute().data or []
    users_by_id = {str(row.get("id")): row for row in users}
    users_by_tier = {tier: sum(1 for row in users if (row.get("tier") or "free") == tier) for tier in ("free", "pro", "business", "enterprise")}
    pricing_plans = _merged_pricing_plans(db, users_by_tier)
    checkouts = db.table("checkout_requests").select("*").order("created_at", desc=True).limit(300).execute().data or []
    coupon_rows = db.table("coupons").select("*").order("created_at", desc=True).execute().data or []
    coupon_meta = _get_json_setting(db, "billing_coupon_metadata", {"coupons": {}}).get("coupons") or {}
    coupons = [_coupon_payload(row, coupon_meta.get(str(row.get("code") or "").upper()), checkouts) for row in coupon_rows]
    subscription_rows = db.table("subscriptions").select("*").order("updated_at", desc=True).limit(300).execute().data or []
    payment_rows = db.table("payment_transactions").select("*").order("created_at", desc=True).limit(300).execute().data or []
    audit_rows = db.table("billing_tier_audit").select("*").order("created_at", desc=True).limit(100).execute().data or []
    operation_rows = db.table("operation_logs").select("*").eq("type", "billing").order("created_at", desc=True).limit(100).execute().data or []
    billing_settings = _get_json_setting(db, "billing_settings", DEFAULT_BILLING_SETTINGS)

    confirmed_checkouts = [row for row in checkouts if row.get("status") == "confirmed"]
    paid_transactions = [row for row in payment_rows if str(row.get("status") or "").lower() in {"paid", "success", "succeeded", "confirmed"}]
    previous_month_start = month_start - timedelta(days=30)
    monthly_revenue = sum(int(row.get("amount") or 0) for row in confirmed_checkouts if (_parse_datetime_filter(_iso_text(row.get("confirmed_at") or row.get("updated_at") or row.get("created_at"))) or now) >= month_start)
    monthly_revenue += sum(int(row.get("amount") or 0) for row in paid_transactions if (_parse_datetime_filter(_iso_text(row.get("verified_at") or row.get("created_at"))) or now) >= month_start)
    previous_month_revenue = sum(
        int(row.get("amount") or 0)
        for row in confirmed_checkouts
        if previous_month_start <= ((_parse_datetime_filter(_iso_text(row.get("confirmed_at") or row.get("updated_at") or row.get("created_at"))) or now)) < month_start
    )
    today_revenue = sum(int(row.get("amount") or 0) for row in confirmed_checkouts if (_parse_datetime_filter(_iso_text(row.get("confirmed_at") or row.get("updated_at") or row.get("created_at"))) or now) >= today_start)
    today_revenue += sum(int(row.get("amount") or 0) for row in paid_transactions if (_parse_datetime_filter(_iso_text(row.get("verified_at") or row.get("created_at"))) or now) >= today_start)
    paid_users = sum(1 for row in users if (row.get("tier") or "free") != "free")
    top_plan = max((item for item in users_by_tier.items() if item[0] != "free"), key=lambda item: item[1], default=("free", 0))[0]
    expiring_subscriptions = [
        row for row in subscription_rows
        if row.get("status") == "active"
        and (_parse_datetime_filter(_iso_text(row.get("current_period_end"))) or (now + timedelta(days=999))) <= now + timedelta(days=7)
    ]

    pending_purchases = []
    for row in checkouts:
        user = users_by_id.get(str(row.get("user_id")), {})
        note = row.get("note") or ""
        pending_purchases.append(
            {
                **_checkout_payload(row),
                "user": user.get("name") or "",
                "email": user.get("email") or "",
                "requestedPlan": row.get("plan_code"),
                "billingCycle": "annual" if "annual" in note.lower() else "monthly",
                "coupon": next((coupon.get("code") for coupon in coupons if coupon.get("code") and coupon.get("code") in note.upper()), ""),
                "paymentMethod": "manual",
                "paymentStatus": row.get("status"),
                "userNote": note,
            }
        )

    subscriptions = []
    for row in subscription_rows:
        user = users_by_id.get(str(row.get("user_id")), {})
        plan_code = str(row.get("plan_id") or user.get("tier") or "free").replace("-monthly", "").replace("-annual", "")
        plan = next((item for item in pricing_plans if item.get("planCode") == plan_code), {})
        subscriptions.append(
            {
                "id": row.get("id"),
                "userId": row.get("user_id"),
                "user": user.get("name") or "",
                "email": user.get("email") or "",
                "currentPlan": plan_code,
                "billingCycle": "annual" if "annual" in str(row.get("plan_id") or "") else "monthly",
                "amount": plan.get("monthlyPrice") or 0,
                "startDate": row.get("current_period_start"),
                "expiryDate": row.get("current_period_end"),
                "autoRenew": not bool(row.get("cancel_at_period_end")),
                "status": row.get("status") or "active",
            }
        )

    payment_history = []
    for row in payment_rows:
        user = users_by_id.get(str(row.get("user_id")), {})
        payment_history.append(
            {
                "transactionId": row.get("provider_transaction_id") or row.get("id"),
                "user": user.get("name") or "",
                "plan": user.get("tier") or "",
                "amount": row.get("amount") or 0,
                "coupon": "",
                "method": row.get("provider") or "manual",
                "status": row.get("status") or "pending",
                "paidAt": row.get("verified_at") or row.get("created_at"),
                "invoice": row.get("id"),
            }
        )

    active_coupons = [row for row in coupons if row.get("status") == "active"]
    pending_over_24h = [
        row for row in pending_purchases
        if row.get("status") == "pending"
        and (_parse_datetime_filter(_iso_text(row.get("createdAt"))) or now) <= now - timedelta(hours=24)
    ]
    billing_alerts = []
    if expiring_subscriptions:
        billing_alerts.append({"title": "Subscription expiring in 7 days", "severity": "pending", "detail": f"{len(expiring_subscriptions)} subscription sắp hết hạn."})
    if any(str(row.get("status") or "").lower() in {"failed", "payment_failed"} for row in payment_rows):
        billing_alerts.append({"title": "Payment failed", "severity": "failed", "detail": "Có giao dịch thanh toán thất bại."})
    if any(row.get("endDate") and (_parse_datetime_filter(row.get("endDate")) or now) <= now + timedelta(days=7) for row in active_coupons):
        billing_alerts.append({"title": "Coupon expiring soon", "severity": "pending", "detail": "Có coupon sắp hết hạn."})
    if any(int(row.get("used") or 0) >= int(row.get("maxUsage") or 1) * 0.8 for row in active_coupons):
        billing_alerts.append({"title": "Abnormal coupon usage", "severity": "pending", "detail": "Coupon đang dùng gần chạm giới hạn."})
    if any(int(row.get("usage_limit") or 0) > 0 and int(row.get("usage_count") or 0) > int(row.get("usage_limit") or 0) for row in users):
        billing_alerts.append({"title": "User exceeded plan limit", "severity": "failed", "detail": "Có user vượt usage limit của plan hiện tại."})
    if pending_over_24h:
        billing_alerts.append({"title": "Pending purchase over 24h", "severity": "pending", "detail": f"{len(pending_over_24h)} yêu cầu mua gói đang chờ quá 24h."})
    if previous_month_revenue > 0 and monthly_revenue < previous_month_revenue * 0.7:
        billing_alerts.append({"title": "Revenue dropped", "severity": "pending", "detail": "Doanh thu tháng này giảm hơn 30% so với chu kỳ trước."})
    if any(str(row.get("status") or "").lower() in {"past_due", "expired"} for row in subscription_rows):
        billing_alerts.append({"title": "Subscription past due", "severity": "failed", "detail": "Có subscription quá hạn."})

    return {
        "pricingPlans": pricing_plans,
        "coupons": coupons,
        "pendingPurchases": pending_purchases,
        "subscriptions": subscriptions,
        "paymentHistory": payment_history,
        "billingSettings": billing_settings,
        "billingAlerts": billing_alerts,
        "billingLogs": [
            {
                "time": row.get("created_at"),
                "admin": row.get("actor_email_snapshot") or row.get("actor_user_id") or row.get("user_id") or "",
                "action": row.get("reason") or row.get("action") or "billing_update",
                "affectedUser": row.get("target_user_email_snapshot") or row.get("target_user_id") or "",
                "oldValue": row.get("old_tier") or "",
                "newValue": row.get("new_tier") or "",
                "reason": row.get("reason") or "",
                "status": "success",
            }
            for row in audit_rows
        ] + [
            {
                "time": row.get("created_at"),
                "admin": row.get("user_id") or "",
                "action": row.get("action") or "",
                "affectedUser": "",
                "oldValue": "",
                "newValue": "",
                "reason": row.get("action") or "",
                "status": "success",
            }
            for row in operation_rows
        ],
        "billingKpis": {
            "monthlyRevenue": monthly_revenue,
            "todayRevenue": today_revenue,
            "paidUsers": paid_users,
            "activeSubscriptions": sum(1 for row in subscription_rows if row.get("status") == "active"),
            "pendingPurchases": sum(1 for row in checkouts if row.get("status") == "pending"),
            "activeCoupons": len(active_coupons),
            "freeToPaidConversion": round((paid_users / max(1, len(users))) * 100, 2),
            "couponDiscountAmount": sum(int(row.get("revenueImpact") or 0) for row in coupons),
            "topPlan": top_plan,
            "expiringSubscriptions": len(expiring_subscriptions),
        },
    }


@router.post("/billing/plans", status_code=status.HTTP_201_CREATED)
async def create_billing_plan(request: Request, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    plan_code = str((payload or {}).get("planCode") or "").strip().lower()
    if not plan_code:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="planCode không được rỗng.")
    users = db.table("users").select("tier").execute().data or []
    users_by_tier = {tier: sum(1 for row in users if (row.get("tier") or "free") == tier) for tier in ("free", "pro", "business", "enterprise")}
    plans = _merged_pricing_plans(db, users_by_tier)
    if any(str(plan.get("planCode") or "").lower() == plan_code for plan in plans):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Plan code không được trùng.")
    plans.append({**payload, "planCode": plan_code})
    _set_json_setting(db, "billing_pricing_plans", {"plans": plans})
    _sync_pricing_config_from_plans(db, plans)
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "billing", "action": f"billing_plan_created: {plan_code}"}).execute()
    return {"success": True, "plan": {**payload, "planCode": plan_code}}


@router.put("/billing/plans/{plan_code}")
async def update_billing_plan(plan_code: str, request: Request, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    code = plan_code.strip().lower()
    users = db.table("users").select("tier").execute().data or []
    users_by_tier = {tier: sum(1 for row in users if (row.get("tier") or "free") == tier) for tier in ("free", "pro", "business", "enterprise")}
    plans = _merged_pricing_plans(db, users_by_tier)
    updated_plan = None
    next_plans = []
    for plan in plans:
        if str(plan.get("planCode") or "").lower() == code:
            updated_plan = {**plan, **payload, "planCode": code}
            next_plans.append(updated_plan)
        else:
            next_plans.append(plan)
    if not updated_plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy plan.")
    _set_json_setting(db, "billing_pricing_plans", {"plans": next_plans})
    _sync_pricing_config_from_plans(db, next_plans)
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "billing", "action": f"billing_plan_updated: {code}"}).execute()
    return {"success": True, "plan": updated_plan}


@router.delete("/billing/plans/{plan_code}")
async def delete_billing_plan(plan_code: str, force: bool = Query(default=False), admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    code = plan_code.strip().lower()
    active_users = db.table("users").select("id").eq("tier", code).execute().data or []
    if active_users and not force:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Không cho xóa gói đang có subscription active nếu chưa xác nhận đặc biệt.")
    users = db.table("users").select("tier").execute().data or []
    users_by_tier = {tier: sum(1 for row in users if (row.get("tier") or "free") == tier) for tier in ("free", "pro", "business", "enterprise")}
    plans = [plan for plan in _merged_pricing_plans(db, users_by_tier) if str(plan.get("planCode") or "").lower() != code]
    _set_json_setting(db, "billing_pricing_plans", {"plans": plans})
    _sync_pricing_config_from_plans(db, plans)
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "billing", "action": f"billing_plan_deleted: {code}"}).execute()
    return {"success": True}


@router.get("/billing/coupons")
async def list_billing_coupons(_: dict = Depends(require_admin), db = Depends(get_db)):
    checkouts = db.table("checkout_requests").select("*").execute().data or []
    rows = db.table("coupons").select("*").order("created_at", desc=True).execute().data or []
    metadata = _get_json_setting(db, "billing_coupon_metadata", {"coupons": {}}).get("coupons") or {}
    return {"coupons": [_coupon_payload(row, metadata.get(str(row.get("code") or "").upper()), checkouts) for row in rows]}


@router.post("/billing/coupons", status_code=status.HTTP_201_CREATED)
async def create_billing_coupon(request: Request, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    code = str((payload or {}).get("code") or "").strip().upper()
    if not code:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Coupon code không được rỗng.")
    percent = int(payload.get("discountValue") or payload.get("percent") or 0) if payload.get("discountType", "percent") == "percent" else 0
    db.table("coupons").upsert({"code": code, "percent": percent}).execute()
    metadata = _get_json_setting(db, "billing_coupon_metadata", {"coupons": {}})
    coupons = metadata.get("coupons") or {}
    coupons[code] = {**payload, "code": code}
    _set_json_setting(db, "billing_coupon_metadata", {"coupons": coupons})
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "billing", "action": f"coupon_created: {code}"}).execute()
    return {"success": True, "coupon": _coupon_payload({"code": code, "percent": percent}, coupons[code])}


@router.put("/billing/coupons/{code}")
async def update_billing_coupon(code: str, request: Request, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    coupon_code = code.strip().upper()
    percent = int(payload.get("discountValue") or payload.get("percent") or 0) if payload.get("discountType", "percent") == "percent" else 0
    db.table("coupons").upsert({"code": coupon_code, "percent": percent}).execute()
    metadata = _get_json_setting(db, "billing_coupon_metadata", {"coupons": {}})
    coupons = metadata.get("coupons") or {}
    coupons[coupon_code] = {**coupons.get(coupon_code, {}), **payload, "code": coupon_code}
    _set_json_setting(db, "billing_coupon_metadata", {"coupons": coupons})
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "billing", "action": f"coupon_updated: {coupon_code}"}).execute()
    return {"success": True, "coupon": _coupon_payload({"code": coupon_code, "percent": percent}, coupons[coupon_code])}


@router.delete("/billing/coupons/{code}")
async def delete_billing_coupon(code: str, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    coupon_code = code.strip().upper()
    db.table("coupons").delete().eq("code", coupon_code).execute()
    metadata = _get_json_setting(db, "billing_coupon_metadata", {"coupons": {}})
    coupons = metadata.get("coupons") or {}
    coupons.pop(coupon_code, None)
    _set_json_setting(db, "billing_coupon_metadata", {"coupons": coupons})
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "billing", "action": f"coupon_deleted: {coupon_code}"}).execute()
    return {"success": True}


@router.post("/billing/manual-upgrade")
async def manual_upgrade_user(request: Request, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    user_id = str((payload or {}).get("selectedUser") or "").strip()
    target_plan = str((payload or {}).get("targetPlan") or "").strip().lower()
    reason = str((payload or {}).get("reason") or "").strip()
    if not user_id or not target_plan or not reason:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="User, target plan và lý do cấp gói là bắt buộc.")
    tier_result = _update_user_tier_with_audit(db, admin_user, user_id, TierUpdateRequest(tier=target_plan, reason=reason[:255]))
    start_date = payload.get("startDate") or datetime.now(timezone.utc).isoformat()
    expiry_date = payload.get("expiryDate") or (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    db.table("subscriptions").insert(
        {
            "user_id": user_id,
            "plan_id": None,
            "status": "active",
            "current_period_start": start_date,
            "current_period_end": expiry_date,
            "cancel_at_period_end": False,
        }
    ).execute()
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "billing", "action": f"manual_upgrade: {user_id} -> {target_plan}: {reason[:120]}"}).execute()
    return {"success": True, **tier_result}


@router.put("/billing/checkout-requests/{checkout_id}/more-info")
async def request_checkout_more_info(checkout_id: str, request: Request, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    note = str((payload or {}).get("adminNote") or "request_more_info").strip()[:1000]
    response = db.table("checkout_requests").update({"admin_note": note, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", checkout_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy checkout request.")
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "billing", "action": f"checkout_request_more_info: {checkout_id}"}).execute()
    return {"success": True, "checkoutRequest": _checkout_payload(response.data[0])}


@router.delete("/billing/checkout-requests/{checkout_id}")
async def delete_checkout_request(checkout_id: str, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    db.table("checkout_requests").delete().eq("id", checkout_id).execute()
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "billing", "action": f"checkout_request_deleted: {checkout_id}"}).execute()
    return {"success": True}


@router.put("/billing/subscriptions/{subscription_id}/plan")
async def change_subscription_plan(subscription_id: str, request: Request, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    target_plan = str((payload or {}).get("targetPlan") or "").strip().lower()
    if not target_plan:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="targetPlan không được rỗng.")
    rows = db.table("subscriptions").select("*").eq("id", subscription_id).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy subscription.")
    user_id = rows[0].get("user_id")
    _update_user_tier_with_audit(db, admin_user, str(user_id), TierUpdateRequest(tier=target_plan, reason="subscription_plan_change"))
    updated = db.table("subscriptions").update({"updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", subscription_id).execute().data
    return {"success": True, "subscription": updated[0] if updated else rows[0]}


@router.put("/billing/subscriptions/{subscription_id}/cancel")
async def cancel_subscription(subscription_id: str, request: Request, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    reason = str((payload or {}).get("reason") or "admin_cancel_subscription").strip()[:255]
    updated = db.table("subscriptions").update({"status": "cancelled", "cancel_at_period_end": True, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", subscription_id).execute().data
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy subscription.")
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "billing", "action": f"subscription_cancelled: {subscription_id}: {reason}"}).execute()
    return {"success": True, "subscription": updated[0]}


@router.get("/billing/settings")
async def get_billing_settings(_: dict = Depends(require_admin), db = Depends(get_db)):
    return {"billingSettings": _get_json_setting(db, "billing_settings", DEFAULT_BILLING_SETTINGS)}


@router.put("/billing/settings")
async def update_billing_settings(request: Request, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    settings_data = {**DEFAULT_BILLING_SETTINGS, **(payload or {})}
    _set_json_setting(db, "billing_settings", settings_data)
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "billing", "action": "billing_settings_updated"}).execute()
    return {"success": True, "billingSettings": settings_data}


@router.get("/ai-prompts/dashboard")
async def ai_prompts_dashboard(_: dict = Depends(require_admin), db = Depends(get_db)):
    prompts = _merged_prompts(db)
    versions = _get_json_setting(db, "ai_prompt_versions", {"versions": []}).get("versions") or []
    if not versions:
        versions = [
            {
                "versionId": f"{prompt.get('promptKey')}-v{prompt.get('version') or 1}",
                "version": prompt.get("version") or 1,
                "promptKey": prompt.get("promptKey"),
                "promptName": prompt.get("promptName"),
                "updatedBy": prompt.get("updatedBy") or "system",
                "updatedAt": prompt.get("updatedAt"),
                "environment": prompt.get("environment") or "Production",
                "changeSummary": "Initial prompt config",
                "status": "active" if prompt.get("status") == "Active" else "draft",
                "snapshot": prompt,
            }
            for prompt in prompts
        ]
    routing = _get_json_setting(db, "ai_prompt_routing_settings", DEFAULT_AI_ROUTING_SETTINGS)
    safety = _get_json_setting(db, "ai_prompt_safety_rules", {"rules": DEFAULT_SAFETY_RULES}).get("rules") or DEFAULT_SAFETY_RULES
    ai_events = db.table("ai_usage_events").select("*").gte("created_at", (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()).execute().data or []
    logs = db.table("operation_logs").select("*").order("created_at", desc=True).limit(200).execute().data or []
    analytics_by_feature: dict[str, dict] = {}
    for event in ai_events:
        feature = event.get("feature_name") or "chatbot"
        row = analytics_by_feature.setdefault(feature, {"promptKey": feature, "calls": 0, "tokens": 0, "errors": 0, "cost": 0.0, "latencyTotal": 0})
        row["calls"] += 1
        row["tokens"] += int(event.get("input_tokens") or 0) + int(event.get("output_tokens") or 0)
        row["errors"] += 1 if event.get("status") == "failed" else 0
        row["cost"] += float(event.get("estimated_cost") or 0)
        row["latencyTotal"] += int(event.get("latency_ms") or 0)
    analytics_rows = [
        {
            "promptKey": key,
            "calls": row["calls"],
            "tokens": row["tokens"],
            "errorRate": round((row["errors"] / max(1, row["calls"])) * 100, 2),
            "cost": round(row["cost"], 6),
            "avgLatency": round(row["latencyTotal"] / max(1, row["calls"]), 2),
        }
        for key, row in analytics_by_feature.items()
    ]
    active_prompts = [prompt for prompt in prompts if prompt.get("status") == "Active"]
    return {
        "prompts": prompts,
        "selectedPrompt": prompts[0] if prompts else None,
        "promptSettings": _get_json_setting(db, "prompt_config", DEFAULT_PROMPT_CONFIG),
        "aiRoutingSettings": routing,
        "promptVariables": [{"key": item[0], "description": item[1], "dataType": item[2], "example": item[3], "required": item[4]} for item in PROMPT_VARIABLES],
        "promptVersions": versions,
        "safetyRules": safety,
        "promptAnalytics": {
            "callsByPrompt": analytics_rows,
            "tokensByPrompt": analytics_rows,
            "errorRateByPrompt": analytics_rows,
            "costByPrompt": analytics_rows,
            "avgLatencyByPrompt": analytics_rows,
            "badFeedbackPrompts": [row for row in analytics_rows if row["errorRate"] >= 10],
            "bestSuccessPrompts": sorted(analytics_rows, key=lambda row: row["errorRate"])[:5],
        },
        "promptChangeLogs": [
            {
                "time": row.get("created_at"),
                "admin": row.get("user_id") or "",
                "prompt": "",
                "action": row.get("action") or "",
                "oldValue": "",
                "newValue": "",
                "environment": "",
                "reason": row.get("action") or "",
                "status": "success",
            }
            for row in logs
            if "prompt" in str(row.get("action") or "").lower()
        ],
        "playgroundState": {"selectedPrompt": prompts[0].get("promptKey") if prompts else "", "sampleInput": "", "selectedModel": routing.get("defaultModel"), "temperature": routing.get("temperature"), "maxTokens": routing.get("maxTokens"), "outputLanguage": "vi", "testStatus": "idle"},
        "promptStats": {
            "totalPrompts": len(prompts),
            "activePrompts": len(active_prompts),
            "draftPrompts": sum(1 for prompt in prompts if prompt.get("status") == "Draft"),
            "testingPrompts": sum(1 for prompt in prompts if prompt.get("status") == "Testing"),
            "errorPrompts": len([row for row in analytics_rows if row["errorRate"] >= 10]),
            "savedVersions": len(versions),
            "promptCallsToday": sum(row.get("calls", 0) for row in analytics_rows),
            "promptErrorRate": round((sum(row.get("errors", 0) for row in analytics_by_feature.values()) / max(1, sum(row.get("calls", 0) for row in analytics_by_feature.values()))) * 100, 2),
            "mostUsedPrompt": max(analytics_rows, key=lambda row: row["calls"], default={"promptKey": ""}).get("promptKey"),
            "lastUpdated": max((str(prompt.get("updatedAt") or "") for prompt in prompts), default=""),
        },
    }


async def _save_prompt_payload(db, admin_user: dict, payload: dict, existing_key: str | None = None) -> dict:
    prompts = _merged_prompts(db)
    key = str(payload.get("promptKey") or existing_key or "").strip()
    if not key:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="promptKey không được rỗng.")
    now = datetime.now(timezone.utc).isoformat()
    exists = any(prompt.get("promptKey") == key for prompt in prompts)
    next_prompt = {**payload, "promptKey": key, "updatedBy": admin_user.get("email") or admin_user.get("id") or "admin", "updatedAt": now, "version": int(payload.get("version") or 1)}
    next_prompts = []
    for prompt in prompts:
        if prompt.get("promptKey") == key:
            next_prompt = {**prompt, **next_prompt, "version": int(prompt.get("version") or 1) + 1}
            next_prompts.append(next_prompt)
        else:
            next_prompts.append(prompt)
    if not exists:
        next_prompts.append(next_prompt)
    _set_json_setting(db, "ai_prompt_registry", {"prompts": next_prompts})
    versions = _get_json_setting(db, "ai_prompt_versions", {"versions": []}).get("versions") or []
    versions.insert(0, {"versionId": f"{key}-v{next_prompt.get('version')}", "version": next_prompt.get("version"), "promptKey": key, "promptName": next_prompt.get("promptName"), "updatedBy": next_prompt.get("updatedBy"), "updatedAt": now, "environment": next_prompt.get("environment"), "changeSummary": next_prompt.get("changeNote") or "Prompt updated", "status": "active", "snapshot": next_prompt})
    _set_json_setting(db, "ai_prompt_versions", {"versions": versions[:100]})
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "prompt", "action": f"prompt_saved: {key}"}).execute()
    return next_prompt


@router.post("/ai-prompts/items", status_code=status.HTTP_201_CREATED)
async def create_ai_prompt(request: Request, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    if any(prompt.get("promptKey") == str((payload or {}).get("promptKey") or "").strip() for prompt in _merged_prompts(db)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="promptKey không được trùng.")
    return {"success": True, "prompt": await _save_prompt_payload(db, admin_user, payload or {})}


@router.put("/ai-prompts/items/{prompt_key}")
async def update_ai_prompt(prompt_key: str, request: Request, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    return {"success": True, "prompt": await _save_prompt_payload(db, admin_user, payload or {}, prompt_key)}


@router.delete("/ai-prompts/items/{prompt_key}")
async def delete_ai_prompt(prompt_key: str, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    prompts = [prompt for prompt in _merged_prompts(db) if prompt.get("promptKey") != prompt_key]
    _set_json_setting(db, "ai_prompt_registry", {"prompts": prompts})
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "prompt", "action": f"prompt_deleted: {prompt_key}"}).execute()
    return {"success": True}


@router.post("/ai-prompts/items/{prompt_key}/duplicate")
async def duplicate_ai_prompt(prompt_key: str, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    prompt = next((row for row in _merged_prompts(db) if row.get("promptKey") == prompt_key), None)
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy prompt.")
    copy_payload = {**prompt, "promptKey": f"{prompt_key}_copy_{int(time.time())}", "promptName": f"{prompt.get('promptName')} Copy", "status": "Draft"}
    return {"success": True, "prompt": await _save_prompt_payload(db, admin_user, copy_payload)}


@router.post("/ai-prompts/test")
async def test_ai_prompt(request: Request, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    prompt_key = str((payload or {}).get("selectedPrompt") or "").strip()
    sample_input = str((payload or {}).get("sampleInput") or "").strip()
    prompt = next((row for row in _merged_prompts(db) if row.get("promptKey") == prompt_key), None)
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy prompt.")
    started = time.time()
    try:
        output = await generate(prompt.get("systemPrompt") or prompt.get("promptTemplate") or "", sample_input or "Hãy trả lời kiểm thử ngắn gọn.")
        status_value = "success"
    except Exception as exc:
        output = str(getattr(exc, "detail", str(exc)))
        status_value = "error"
    latency = int((time.time() - started) * 1000)
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "prompt", "action": f"prompt_tested: {prompt_key}: {status_value}"}).execute()
    return {
        "success": status_value == "success",
        "output": output,
        "inputTokens": len((sample_input or "").split()),
        "outputTokens": len((output or "").split()),
        "latency": latency,
        "estimatedCost": round(((len((sample_input or "").split()) + len((output or "").split())) / 1000) * 0.00035, 6),
        "testStatus": status_value,
    }


@router.post("/ai-prompts/versions/{version_id}/rollback")
async def rollback_ai_prompt_version(version_id: str, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    versions = _get_json_setting(db, "ai_prompt_versions", {"versions": []}).get("versions") or []
    version = next((row for row in versions if str(row.get("versionId")) == version_id), None)
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy version.")
    prompt = version.get("snapshot") or {}
    saved = await _save_prompt_payload(db, admin_user, {**prompt, "changeNote": f"Rollback from {version_id}"}, prompt.get("promptKey"))
    return {"success": True, "prompt": saved}


@router.put("/ai-prompts/versions/{version_id}/active")
async def set_active_ai_prompt_version(version_id: str, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    versions = _get_json_setting(db, "ai_prompt_versions", {"versions": []}).get("versions") or []
    for row in versions:
        row["status"] = "active" if str(row.get("versionId")) == version_id else "archived"
    _set_json_setting(db, "ai_prompt_versions", {"versions": versions})
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "prompt", "action": f"prompt_version_set_active: {version_id}"}).execute()
    return {"success": True, "versions": versions}


@router.put("/ai-prompts/routing-settings")
async def update_ai_prompt_routing(request: Request, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    data = {**DEFAULT_AI_ROUTING_SETTINGS, **(payload or {})}
    _set_json_setting(db, "ai_prompt_routing_settings", data)
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "prompt", "action": "prompt_routing_updated"}).execute()
    return {"success": True, "aiRoutingSettings": data}


@router.put("/ai-prompts/safety-rules/{rule_key}")
async def update_ai_prompt_safety_rule(rule_key: str, request: Request, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    rules = _get_json_setting(db, "ai_prompt_safety_rules", {"rules": DEFAULT_SAFETY_RULES}).get("rules") or DEFAULT_SAFETY_RULES
    next_rules = [{**rule, **(payload or {})} if rule.get("key") == rule_key else rule for rule in rules]
    _set_json_setting(db, "ai_prompt_safety_rules", {"rules": next_rules})
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "prompt", "action": f"prompt_safety_rule_updated: {rule_key}"}).execute()
    return {"success": True, "safetyRules": next_rules}


@router.post("/ai-prompts/ab-tests/{action}")
async def update_ai_prompt_ab_test(action: str, request: Request, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    state_data = {**(payload or {}), "status": "running" if action == "start" else "stopped" if action == "stop" else "winner_selected", "updatedAt": datetime.now(timezone.utc).isoformat()}
    _set_json_setting(db, "ai_prompt_ab_test", state_data)
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "prompt", "action": f"prompt_ab_test_{action}"}).execute()
    return {"success": True, "abTest": state_data}


def _parse_datetime_filter(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        try:
            return datetime.fromisoformat(f"{value}T00:00:00+00:00")
        except ValueError:
            return None


def _ai_window(time_range: str, date_from: str | None, date_to: str | None) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    explicit_from = _parse_datetime_filter(date_from)
    explicit_to = _parse_datetime_filter(date_to)
    if explicit_from or explicit_to:
        return explicit_from or (now - timedelta(days=1)), explicit_to or now
    ranges = {
        "24h": timedelta(days=1),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
        "90d": timedelta(days=90),
    }
    return now - ranges.get((time_range or "24h").lower(), timedelta(days=1)), now


def _provider_from_model(model: str | None) -> str:
    value = (model or "").strip().lower()
    if "gemini" in value:
        return "Gemini"
    if "gpt" in value or "openai" in value:
        return "OpenAI"
    if "claude" in value:
        return "Anthropic"
    return "Unknown"


def _event_error_code(event: dict) -> str:
    status_value = event.get("status") or ""
    if status_value == "quota_exceeded":
        return "QUOTA_EXCEEDED"
    if status_value == "blocked":
        return "BLOCKED"
    if status_value == "failed":
        return "PROVIDER_FAILED"
    return ""


def _quota_status(used: int, limit: int, warning_threshold: int) -> str:
    if limit <= 0:
        return "normal"
    percent = (used / max(1, limit)) * 100
    if percent >= 100:
        return "exceeded"
    if percent >= warning_threshold:
        return "highUsage"
    return "normal"


@router.get("/dashboards/ai-cost")
async def ai_cost_dashboard(
    _: dict = Depends(require_admin),
    db = Depends(get_db),
    timeRange: str = Query(default="24h"),
    dateFrom: str | None = Query(default=None),
    dateTo: str | None = Query(default=None),
    provider: str | None = Query(default=None),
    model: str | None = Query(default=None),
    workspace: str | None = Query(default=None),
):
    since, until = _ai_window(timeRange, dateFrom, dateTo)
    users = db.table("users").select("id,name,email,tier,usage_count,usage_limit,status").execute().data or []
    user_by_id = {str(row.get("id")): row for row in users}
    workspace_settings_rows = db.table("user_settings").select("user_id,value").eq("key", "workspace").execute().data or []
    workspace_by_user = {
        str(row.get("user_id")): _json_default(row.get("value"), {}).get("workspaceName")
        for row in workspace_settings_rows
    }
    rows = db.fetch(
        """
        SELECT
            e.*,
            u.email AS user_email,
            u.name AS user_name,
            u.tier AS user_tier,
            f.workspace_id,
            w.name AS workspace_name
        FROM ai_usage_events e
        LEFT JOIN users u ON u.id = e.user_id
        LEFT JOIN files f ON f.id = e.file_id
        LEFT JOIN workspaces w ON w.id = f.workspace_id
        WHERE e.created_at >= %s AND e.created_at <= %s
        ORDER BY e.created_at ASC
        """,
        [since.isoformat(), until.isoformat()],
    )

    provider_filter = (provider or "").strip().lower()
    model_filter = (model or "").strip().lower()
    workspace_filter = (workspace or "").strip().lower()
    events = []
    for row in rows:
        event_model = row.get("model") or ""
        event_provider = _provider_from_model(event_model)
        event_workspace = row.get("workspace_name") or workspace_by_user.get(str(row.get("user_id"))) or ""
        if provider_filter and provider_filter != "all" and provider_filter not in event_provider.lower():
            continue
        if model_filter and model_filter != "all" and model_filter not in event_model.lower():
            continue
        if workspace_filter and workspace_filter != "all" and workspace_filter not in event_workspace.lower():
            continue
        row["provider"] = event_provider
        row["workspace_name"] = event_workspace
        events.append(row)

    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    last_24h = now - timedelta(days=1)
    last_30d = now - timedelta(days=30)
    all_30d_rows = db.table("ai_usage_events").select("*").gte("created_at", last_30d.isoformat()).execute().data or []
    today_events = [event for event in events if _parse_datetime_filter(_iso_text(event.get("created_at"))) and _parse_datetime_filter(_iso_text(event.get("created_at"))) >= day_start]
    requests_24h = sum(1 for row in all_30d_rows if _iso_text(row.get("created_at")) >= last_24h.isoformat())
    total_30d = len(all_30d_rows)
    input_tokens = sum(int(event.get("input_tokens") or 0) for event in events)
    output_tokens = sum(int(event.get("output_tokens") or 0) for event in events)
    total_tokens = input_tokens + output_tokens
    total_cost = float(sum(event.get("estimated_cost") or 0 for event in events))
    failed = sum(1 for event in events if event.get("status") == "failed")
    blocked = sum(1 for event in events if event.get("status") == "blocked")
    quota_exceeded = sum(1 for event in events if event.get("status") == "quota_exceeded")
    quota_config = _get_json_setting(db, "ai_quota_config", DEFAULT_AI_QUOTA_CONFIG)
    system_block = _get_json_setting(db, "ai_system_block", {"blocked": False, "reason": "", "updatedAt": ""})
    daily_quota = sum(int(ENTITLEMENTS.get(user.get("tier") or "free", ENTITLEMENTS["free"]).get("ai_requests_per_day") or 0) for user in users)

    by_feature: dict[str, dict] = {}
    by_user: dict[str, dict] = {}
    by_provider_model: dict[str, dict] = {}
    by_workspace: dict[str, dict] = {}
    timeline: dict[str, dict] = {}
    for event in events:
        raw_feature = event.get("feature_name") or "unknown"
        feature_aliases = {"doc_builder": "document_builder", "reconcile": "reconciliation", "clean": "data_check"}
        feature = feature_aliases.get(raw_feature, raw_feature)
        status_value = event.get("status") or "success"
        model_value = event.get("model") or "unknown"
        provider_value = event.get("provider") or _provider_from_model(model_value)
        user_id = str(event.get("user_id") or "anonymous")
        user = user_by_id.get(user_id, {})
        workspace_name = event.get("workspace_name") or workspace_by_user.get(user_id) or "Personal Workspace"
        in_tokens = int(event.get("input_tokens") or 0)
        out_tokens = int(event.get("output_tokens") or 0)
        cost = float(event.get("estimated_cost") or 0)
        latency = int(event.get("latency_ms") or 0)
        created_at = _parse_datetime_filter(_iso_text(event.get("created_at"))) or since
        bucket = created_at.strftime("%Y-%m-%d %H:00") if (until - since).days <= 2 else created_at.strftime("%Y-%m-%d")

        feature_row = by_feature.setdefault(
            feature,
            {"feature": feature, "featureName": feature, "requests": 0, "requestCount": 0, "inputTokens": 0, "outputTokens": 0, "totalTokens": 0, "estimatedCost": 0.0, "success": 0, "error": 0},
        )
        feature_row["requests"] += 1
        feature_row["requestCount"] += 1
        feature_row["inputTokens"] += in_tokens
        feature_row["outputTokens"] += out_tokens
        feature_row["totalTokens"] += in_tokens + out_tokens
        feature_row["estimatedCost"] += cost
        feature_row["success" if status_value == "success" else "error"] += 1

        user_row = by_user.setdefault(
            user_id,
            {
                "userId": user_id,
                "workspace": workspace_name,
                "user": user.get("name") or event.get("user_name") or "Unknown",
                "email": user.get("email") or event.get("user_email") or "",
                "requests": 0,
                "requestCount": 0,
                "tokens": 0,
                "estimatedCost": 0.0,
                "features": {},
                "tier": user.get("tier") or event.get("user_tier") or "free",
            },
        )
        user_row["requests"] += 1
        user_row["requestCount"] += 1
        user_row["tokens"] += in_tokens + out_tokens
        user_row["estimatedCost"] += cost
        user_row["features"][feature] = user_row["features"].get(feature, 0) + 1

        workspace_row = by_workspace.setdefault(workspace_name, {"workspace": workspace_name, "requests": 0, "tokens": 0, "estimatedCost": 0.0})
        workspace_row["requests"] += 1
        workspace_row["tokens"] += in_tokens + out_tokens
        workspace_row["estimatedCost"] += cost

        provider_key = f"{provider_value}::{model_value}"
        provider_row = by_provider_model.setdefault(
            provider_key,
            {"provider": provider_value, "model": model_value, "requests": 0, "success": 0, "error": 0, "latencyTotal": 0, "totalTokens": 0, "estimatedCost": 0.0},
        )
        provider_row["requests"] += 1
        provider_row["success"] += 1 if status_value == "success" else 0
        provider_row["error"] += 1 if status_value == "failed" else 0
        provider_row["latencyTotal"] += latency
        provider_row["totalTokens"] += in_tokens + out_tokens
        provider_row["estimatedCost"] += cost

        timeline_row = timeline.setdefault(bucket, {"time": bucket, "success": 0, "error": 0, "blocked": 0, "total": 0})
        timeline_row["total"] += 1
        if status_value == "success":
            timeline_row["success"] += 1
        elif status_value == "blocked" or status_value == "quota_exceeded":
            timeline_row["blocked"] += 1
        else:
            timeline_row["error"] += 1

    for feature in AI_USAGE_FEATURES:
        by_feature.setdefault(
            feature,
            {"feature": feature, "featureName": feature, "requests": 0, "requestCount": 0, "inputTokens": 0, "outputTokens": 0, "totalTokens": 0, "estimatedCost": 0.0, "success": 0, "error": 0},
        )

    feature_rows = []
    for row in by_feature.values():
        row["estimatedCost"] = round(row["estimatedCost"], 6)
        row["percentage"] = round((row["totalTokens"] / max(1, total_tokens)) * 100, 2)
        row["trend"] = "stable"
        feature_rows.append(row)

    provider_rows = []
    for row in by_provider_model.values():
        requests = row["requests"]
        provider_rows.append(
            {
                "provider": row["provider"],
                "model": row["model"],
                "requests": requests,
                "successRate": round((row["success"] / max(1, requests)) * 100, 2),
                "errorRate": round((row["error"] / max(1, requests)) * 100, 2),
                "avgLatency": round(row["latencyTotal"] / max(1, requests), 2),
                "totalTokens": row["totalTokens"],
                "estimatedCost": round(row["estimatedCost"], 6),
                "status": "warning" if row["error"] else "online",
            }
        )

    top_users = []
    warning_threshold = int(quota_config.get("warningThreshold") or 80)
    for row in by_user.values():
        top_feature = max(row["features"], key=row["features"].get) if row["features"] else "unknown"
        tier = row.get("tier") or "free"
        daily_limit = int(ENTITLEMENTS.get(tier, ENTITLEMENTS["free"]).get("ai_requests_per_day") or 0)
        top_users.append(
            {
                "workspace": row["workspace"],
                "user": row["user"],
                "email": row["email"],
                "requests": row["requests"],
                "tokens": row["tokens"],
                "estimatedCost": round(row["estimatedCost"], 6),
                "topFeature": top_feature,
                "quotaStatus": _quota_status(row["requests"], daily_limit, warning_threshold),
            }
        )

    provider_errors = [
        {
            "time": event.get("created_at"),
            "provider": event.get("provider") or _provider_from_model(event.get("model")),
            "model": event.get("model") or "unknown",
            "feature": event.get("feature_name") or "unknown",
            "user": event.get("user_email") or event.get("user_name") or str(event.get("user_id") or ""),
            "errorCode": _event_error_code(event),
            "message": f"AI event status={event.get('status')}",
            "severity": "high" if event.get("status") == "failed" else "warning",
            "status": event.get("status") or "",
        }
        for event in events
        if event.get("status") in {"failed", "blocked", "quota_exceeded"}
    ][-50:]

    cache_performance = {
        "cacheHitRate": 0,
        "cacheMissRate": 100 if events else 0,
        "cacheHits": 0,
        "cacheMisses": len(events),
        "savedTokens": 0,
        "savedCost": 0,
        "avgResponseWithCache": 0,
        "avgResponseWithoutCache": round(sum(int(event.get("latency_ms") or 0) for event in events) / max(1, len(events)), 2),
        "telemetryAvailable": False,
    }

    monthly_token_used = sum(int(row.get("input_tokens") or 0) + int(row.get("output_tokens") or 0) for row in all_30d_rows)
    monthly_cost_used = float(sum(row.get("estimated_cost") or 0 for row in all_30d_rows))

    alerts = []
    high_usage_users = [row for row in top_users if row.get("quotaStatus") == "highUsage"]
    exceeded_workspaces = [
        row for row in by_workspace.values()
        if int(quota_config.get("monthlyTokenLimit") or 0) > 0 and row.get("tokens", 0) >= int(quota_config.get("monthlyTokenLimit") or 0)
    ]
    high_latency_providers = [row for row in provider_rows if float(row.get("avgLatency") or 0) >= 5000]
    if high_usage_users:
        user = high_usage_users[0]
        alerts.append({"title": "User over 80% quota", "severity": "highUsage", "detail": f"{user.get('email') or user.get('user')} đã dùng gần hết daily request quota."})
    if exceeded_workspaces:
        workspace_row = sorted(exceeded_workspaces, key=lambda row: row.get("tokens", 0), reverse=True)[0]
        alerts.append({"title": "Workspace exceeded token limit", "severity": "exceeded", "detail": f"{workspace_row.get('workspace')} dùng {workspace_row.get('tokens', 0):,} tokens trong khoảng lọc."})
    if failed / max(1, len(events)) * 100 >= 10:
        alerts.append({"title": "Provider error spike", "severity": "warning", "detail": f"{failed} lỗi provider trong khoảng lọc."})
    if high_latency_providers:
        provider_row = high_latency_providers[0]
        alerts.append({"title": "High latency", "severity": "warning", "detail": f"{provider_row.get('provider')} {provider_row.get('model')} latency trung bình {provider_row.get('avgLatency')}ms."})
    if quota_config.get("enableCache") and events and not cache_performance.get("telemetryAvailable"):
        alerts.append({"title": "Low cache hit rate", "severity": "warning", "detail": "Cache đang bật nhưng backend chưa ghi nhận telemetry hit/miss cho AI usage."})
    if monthly_cost_used >= float(quota_config.get("monthlyCostBudget") or 0) and float(quota_config.get("monthlyCostBudget") or 0) > 0:
        alerts.append({"title": "AI cost over budget", "severity": "exceeded", "detail": "Chi phí AI 30 ngày gần nhất vượt monthly cost budget."})
    if blocked >= 10:
        alerts.append({"title": "Too many blocked requests", "severity": "blocked", "detail": f"{blocked} request bị chặn."})
    if quota_exceeded:
        alerts.append({"title": "Quota exceeded", "severity": "exceeded", "detail": f"{quota_exceeded} request vượt quota."})

    return {
        "aiUsageStats": {
            "aiRequestsToday": len(today_events),
            "aiRequests24h": requests_24h,
            "aiRequests30d": total_30d,
            "totalTokens": total_tokens,
            "inputTokens": input_tokens,
            "outputTokens": output_tokens,
            "estimatedCost": round(total_cost, 6),
            "cacheHitRate": cache_performance["cacheHitRate"],
            "providerErrorRate": round((failed / max(1, len(events))) * 100, 2),
            "blockedRequests": blocked,
            "quotaExceeded": quota_exceeded,
            "quotaRemaining": max(0, daily_quota - len(today_events)),
        },
        "tokenUsageByFeature": sorted(feature_rows, key=lambda row: row["totalTokens"], reverse=True),
        "aiRequestsTimeline": sorted(timeline.values(), key=lambda row: row["time"]),
        "quotaConfig": {
            **quota_config,
            "dailyRequestQuota": daily_quota,
            "dailyRequestUsed": len(today_events),
            "monthlyTokenUsed": monthly_token_used,
            "monthlyCostUsed": round(monthly_cost_used, 6),
            "resetTime": (day_start + timedelta(days=1)).isoformat(),
            "aiSystemBlocked": bool(system_block.get("blocked")),
            "aiSystemBlockReason": system_block.get("reason") or "",
        },
        "cachePerformance": cache_performance,
        "providerPerformance": sorted(provider_rows, key=lambda row: row["requests"], reverse=True),
        "topAiUsers": sorted(top_users, key=lambda row: row["requests"], reverse=True)[:20],
        "providerErrors": list(reversed(provider_errors)),
        "aiUsageAlerts": alerts,
        "topUsersByUsage": sorted(top_users, key=lambda row: row["requests"], reverse=True)[:10],
        "topFeaturesByCost": sorted(feature_rows, key=lambda row: row["estimatedCost"], reverse=True)[:10],
        "aiRequestsToday": len(today_events),
        "estimatedAiCostToday": round(total_cost, 6),
        "providerErrorRate": round((failed / max(1, len(events))) * 100, 2),
        "quotaExceededCount": quota_exceeded,
        "blockedCount": blocked,
    }


@router.get("/dashboards/ai-cost/quota-config")
async def get_ai_quota_config(_: dict = Depends(require_admin), db = Depends(get_db)):
    system_block = _get_json_setting(db, "ai_system_block", {"blocked": False, "reason": "", "updatedAt": ""})
    return {
        "quotaConfig": _get_json_setting(db, "ai_quota_config", DEFAULT_AI_QUOTA_CONFIG),
        "systemBlock": system_block,
    }


@router.put("/dashboards/ai-cost/quota-config")
async def update_ai_quota_config(request: Request, _: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Payload cấu hình quota không hợp lệ.")
    data = {**DEFAULT_AI_QUOTA_CONFIG, **payload}
    for key in ("freeDailyRequestLimit", "proDailyRequestLimit", "enterpriseDailyRequestLimit", "monthlyTokenLimit"):
        if int(data.get(key) or 0) <= 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{key} phải lớn hơn 0.")
    if float(data.get("monthlyCostBudget") or 0) < 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="monthlyCostBudget phải lớn hơn hoặc bằng 0.")
    threshold = int(data.get("warningThreshold") or 0)
    if threshold < 1 or threshold > 100:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="warningThreshold phải từ 1 đến 100.")
    _set_json_setting(db, "ai_quota_config", data)
    return {"success": True, "quotaConfig": data}


@router.post("/dashboards/ai-cost/system-block")
async def block_ai_system(request: Request, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    reason = str((payload or {}).get("reason") or "admin_block_ai_system").strip()[:255]
    data = {"blocked": True, "reason": reason, "updatedAt": datetime.now(timezone.utc).isoformat(), "updatedBy": admin_user.get("id")}
    _set_json_setting(db, "ai_system_block", data)
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "admin", "action": f"ai_system_blocked: {reason}"}).execute()
    return {"success": True, "systemBlock": data}


@router.delete("/dashboards/ai-cost/system-block")
async def unblock_ai_system(admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    data = {"blocked": False, "reason": "", "updatedAt": datetime.now(timezone.utc).isoformat(), "updatedBy": admin_user.get("id")}
    _set_json_setting(db, "ai_system_block", data)
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "admin", "action": "ai_system_unblocked"}).execute()
    return {"success": True, "systemBlock": data}


@router.post("/dashboards/ai-cost/cache/clear")
async def clear_ai_cache(admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    data = {"lastClearedAt": datetime.now(timezone.utc).isoformat(), "clearedBy": admin_user.get("id")}
    _set_json_setting(db, "ai_cache_state", data)
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "admin", "action": "ai_cache_cleared"}).execute()
    return {"success": True, "cacheState": data}


@router.get("/dashboards/files")
async def file_processing_dashboard(_: dict = Depends(require_admin), db = Depends(get_db)):
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    files = db.table("files").select("*").execute().data or []
    today_files = [row for row in files if str(row.get("uploaded_at") or "") >= since]
    failed = [row for row in files if row.get("status") == "failed"]
    by_user: dict[str, dict] = {}
    for row in files:
        user_id = str(row.get("user_id") or "")
        size_text = str(row.get("size") or "0")
        size_num = float("".join(ch for ch in size_text if ch.isdigit() or ch == ".") or 0)
        by_user.setdefault(user_id, {"userId": user_id, "fileCount": 0, "approxStorage": 0.0})
        by_user[user_id]["fileCount"] += 1
        by_user[user_id]["approxStorage"] += size_num
    return {
        "uploadsToday": len(today_files),
        "failedParseCount": len(failed),
        "averageFileRows": round(sum(int(row.get("row_count") or 0) for row in files) / max(1, len(files)), 2),
        "topUsersByStorage": sorted(by_user.values(), key=lambda row: row["approxStorage"], reverse=True)[:10],
        "recentFileErrors": [
            {"id": row.get("id"), "name": row.get("name"), "userId": row.get("user_id"), "errorMessage": row.get("error_message"), "uploadedAt": row.get("uploaded_at")}
            for row in failed[-20:]
        ],
    }


@router.get("/dashboards/security")
async def security_audit_dashboard(_: dict = Depends(require_admin), db = Depends(get_db)):
    logs = db.table("operation_logs").select("*").order("created_at", desc=True).limit(200).execute().data or []
    return {
        "adminActions": [row for row in logs if row.get("type") in {"billing", "api_key", "broadcast"}][:50],
        "blockedUnsafeVba": [row for row in logs if "blocked_unsafe_vba" in str(row.get("action") or "")][:50],
        "failedLogin": [row for row in logs if "login fail" in str(row.get("action") or "")][:50],
        "apiKeyChanges": [row for row in logs if row.get("type") == "api_key"][:50],
        "systemPromptChanges": [row for row in logs if "prompt" in str(row.get("action") or "").lower()][:50],
    }


def _system_report_window(time_range: str, date_from: str | None, date_to: str | None) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    explicit_from = _parse_datetime_filter(date_from)
    explicit_to = _parse_datetime_filter(date_to)
    if explicit_from or explicit_to:
        return explicit_from or (now - timedelta(days=7)), explicit_to or now
    normalized = (time_range or "7d").lower()
    if normalized == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0), now
    if normalized == "30d":
        return now - timedelta(days=30), now
    if normalized == "month":
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0), now
    if normalized == "quarter":
        quarter_month = ((now.month - 1) // 3) * 3 + 1
        return now.replace(month=quarter_month, day=1, hour=0, minute=0, second=0, microsecond=0), now
    return now - timedelta(days=7), now


def _row_datetime(row: dict, *keys: str) -> datetime | None:
    for key in keys:
        parsed = _parse_datetime_filter(_iso_text(row.get(key)))
        if parsed:
            return parsed
    return None


def _in_window(value: datetime | None, since: datetime, until: datetime) -> bool:
    return bool(value and since <= value <= until)


def _report_bucket(value: datetime, since: datetime, until: datetime) -> str:
    if until - since <= timedelta(days=2):
        return value.strftime("%H:00")
    return value.strftime("%d/%m")


def _format_report_time(value) -> str:
    parsed = _parse_datetime_filter(_iso_text(value))
    if not parsed:
        return ""
    return parsed.astimezone(timezone(timedelta(hours=7))).strftime("%H:%M %d/%m")


def _activity_type(row: dict) -> str:
    text = f"{row.get('type') or ''} {row.get('action') or ''}".lower()
    if any(marker in text for marker in ("fail", "error", "blocked", "rejected", "deleted", "cancelled")):
        return "warning"
    if any(marker in text for marker in ("created", "success", "confirmed", "uploaded", "updated", "saved")):
        return "success"
    return "info"


def _system_process_health(db, api_error_rate: float, token_usage_percent: int) -> dict:
    uptime_seconds = max(0, int(time.time() - PROCESS_STARTED_AT))
    telemetry_available = psutil is not None
    cpu = ram = 0
    network_in = network_out = "N/A"
    if telemetry_available:
        cpu = round(float(psutil.cpu_percent(interval=None)), 1)
        ram = round(float(psutil.virtual_memory().percent), 1)
        net = psutil.net_io_counters()
        network_in = _bytes_label(int(getattr(net, "bytes_recv", 0) or 0))
        network_out = _bytes_label(int(getattr(net, "bytes_sent", 0) or 0))
    disk_usage = shutil.disk_usage(".")
    disk = round((disk_usage.used / max(1, disk_usage.total)) * 100, 1)
    try:
        db.fetch("SELECT 1")
        database_status = "online"
    except Exception:
        database_status = "critical"

    queue_rows = db.table("job_queue").select("status").order("created_at", desc=True).limit(500).execute().data or []
    failed_queue = sum(1 for row in queue_rows if row.get("status") == "failed")
    running_queue = sum(1 for row in queue_rows if row.get("status") in {"queued", "running"})
    queue_status = "warning" if failed_queue else "healthy"
    if running_queue > 100:
        queue_status = "warning"

    api_status = "critical" if api_error_rate > 5 else "warning" if api_error_rate > 2 else "online"
    return {
        "cpu": cpu,
        "ram": ram,
        "disk": disk,
        "apiUsage": min(100, max(0, int(round(token_usage_percent if token_usage_percent else api_error_rate * 10)))),
        "networkIn": network_in,
        "networkOut": network_out,
        "databaseStatus": database_status,
        "queueStatus": queue_status,
        "webSocketStatus": "unknown",
        "apiStatus": api_status,
        "tokenUsagePercent": token_usage_percent,
        "lastChecked": datetime.now(timezone(timedelta(hours=7))).strftime("%H:%M:%S"),
        "telemetryAvailable": telemetry_available,
        "uptimeSeconds": uptime_seconds,
    }


@router.get("/dashboards/system-report")
async def system_report_dashboard(
    _: dict = Depends(require_admin),
    db = Depends(get_db),
    timeRange: str = Query(default="7d"),
    dateFrom: str | None = Query(default=None),
    dateTo: str | None = Query(default=None),
):
    since, until = _system_report_window(timeRange, dateFrom, dateTo)
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_30d = now - timedelta(days=30)

    users = db.table("users").select("id,name,email,tier,status,usage_count,usage_limit,created_at,last_login_at").execute().data or []
    users_by_id = {str(row.get("id")): row for row in users}
    users_by_tier = {tier: sum(1 for row in users if (row.get("tier") or "free") == tier) for tier in ("free", "pro", "business", "enterprise")}
    files = db.table("files").select("id,user_id,workspace_id,name,size,status,uploaded_at").execute().data or []
    workspaces = db.table("workspaces").select("id,name,owner_user_id,plan_id,created_at,updated_at").execute().data or []
    workspace_members = db.table("workspace_members").select("workspace_id,user_id,status").execute().data or []
    operation_logs = db.table("operation_logs").select("*").order("created_at", desc=True).limit(1000).execute().data or []
    api_request_logs = db.table("api_request_logs").select("*").order("created_at", desc=True).limit(3000).execute().data or []
    ai_events = db.table("ai_usage_events").select("*").order("created_at", desc=True).limit(3000).execute().data or []
    checkout_rows = db.table("checkout_requests").select("*").order("created_at", desc=True).limit(2000).execute().data or []
    payment_rows = db.table("payment_transactions").select("*").order("created_at", desc=True).limit(2000).execute().data or []
    subscription_rows = db.table("subscriptions").select("*").order("updated_at", desc=True).limit(1000).execute().data or []
    job_rows = db.table("jobs").select("*").order("created_at", desc=True).limit(1000).execute().data or []

    revenue_events = []
    for row in checkout_rows:
        if row.get("status") != "confirmed":
            continue
        event_time = _row_datetime(row, "confirmed_at", "updated_at", "created_at")
        revenue_events.append({"time": event_time, "amount": int(row.get("amount") or 0), "plan": (row.get("plan_code") or "free").lower()})
    paid_statuses = {"paid", "success", "succeeded", "confirmed"}
    for row in payment_rows:
        if str(row.get("status") or "").lower() not in paid_statuses:
            continue
        user = users_by_id.get(str(row.get("user_id") or ""), {})
        event_time = _row_datetime(row, "verified_at", "created_at")
        revenue_events.append({"time": event_time, "amount": int(row.get("amount") or 0), "plan": (user.get("tier") or "free").lower()})

    window_revenue_events = [row for row in revenue_events if _in_window(row.get("time"), since, until)]
    monthly_revenue_events = [row for row in revenue_events if _in_window(row.get("time"), month_start, now)]
    today_revenue_events = [row for row in revenue_events if _in_window(row.get("time"), today_start, now)]
    total_revenue = sum(row["amount"] for row in revenue_events)
    monthly_revenue = sum(row["amount"] for row in monthly_revenue_events)
    today_revenue = sum(row["amount"] for row in today_revenue_events)

    revenue_by_bucket: dict[str, dict] = {}
    for row in window_revenue_events:
        bucket = _report_bucket(row["time"], since, until)
        revenue_by_bucket.setdefault(bucket, {"label": bucket, "revenue": 0, "previousRevenue": 0, "_sort": row["time"].isoformat()})
        revenue_by_bucket[bucket]["revenue"] += row["amount"]
        revenue_by_bucket[bucket]["_sort"] = min(revenue_by_bucket[bucket]["_sort"], row["time"].isoformat())
    revenue_chart = [
        {key: value for key, value in row.items() if key != "_sort"}
        for row in sorted(revenue_by_bucket.values(), key=lambda item: item["_sort"])
    ]

    plans = _merged_pricing_plans(db, users_by_tier)
    plan_price = {plan.get("planCode"): int(plan.get("monthlyPrice") or 0) for plan in plans}
    mrr = sum(users_by_tier.get(tier, 0) * int(plan_price.get(tier, 0) or 0) for tier in ("pro", "business", "enterprise"))
    revenue_by_plan = []
    plan_colors = {"free": "bg-slate-500", "pro": "bg-blue-500", "business": "bg-green-500", "enterprise": "bg-amber-400"}
    for tier in ("free", "pro", "business", "enterprise"):
        revenue_by_plan.append(
            {
                "plan": _plan_name(tier),
                "revenue": sum(row["amount"] for row in monthly_revenue_events if row.get("plan") == tier),
                "users": users_by_tier.get(tier, 0),
                "color": plan_colors[tier],
            }
        )

    api_window = [row for row in api_request_logs if _in_window(_row_datetime(row, "created_at"), since, until)]
    api_today = [row for row in api_request_logs if _in_window(_row_datetime(row, "created_at"), today_start, now)]
    api_success = sum(1 for row in api_window if int(row.get("status_code") or 0) < 400)
    api_failed = sum(1 for row in api_window if int(row.get("status_code") or 0) >= 400)
    avg_latency = round(sum(int(row.get("latency_ms") or 0) for row in api_window) / max(1, len(api_window)), 2)
    api_error_rate = round((api_failed / max(1, len(api_window))) * 100, 2) if api_window else 0

    ai_window = [row for row in ai_events if _in_window(_row_datetime(row, "created_at"), since, until)]
    ai_today = [row for row in ai_events if _in_window(_row_datetime(row, "created_at"), today_start, now)]
    ai_month = [row for row in ai_events if _in_window(_row_datetime(row, "created_at"), month_start, now)]
    input_tokens = sum(int(row.get("input_tokens") or 0) for row in ai_window)
    output_tokens = sum(int(row.get("output_tokens") or 0) for row in ai_window)
    total_tokens = input_tokens + output_tokens
    monthly_tokens = sum(int(row.get("input_tokens") or 0) + int(row.get("output_tokens") or 0) for row in ai_month)
    today_tokens = sum(int(row.get("input_tokens") or 0) + int(row.get("output_tokens") or 0) for row in ai_today)
    estimated_ai_cost = float(sum(row.get("estimated_cost") or 0 for row in ai_window))
    ai_failed = sum(1 for row in ai_window if row.get("status") != "success")

    api_usage_by_bucket: dict[str, dict] = {}
    for row in api_window:
        event_time = _row_datetime(row, "created_at")
        if not event_time:
            continue
        bucket = _report_bucket(event_time, since, until)
        api_usage_by_bucket.setdefault(bucket, {"label": bucket, "success": 0, "failed": 0, "tokens": 0, "_sort": event_time.isoformat()})
        api_usage_by_bucket[bucket]["_sort"] = min(api_usage_by_bucket[bucket]["_sort"], event_time.isoformat())
        if int(row.get("status_code") or 0) >= 400:
            api_usage_by_bucket[bucket]["failed"] += 1
        else:
            api_usage_by_bucket[bucket]["success"] += 1
    for row in ai_window:
        event_time = _row_datetime(row, "created_at")
        if not event_time:
            continue
        bucket = _report_bucket(event_time, since, until)
        api_usage_by_bucket.setdefault(bucket, {"label": bucket, "success": 0, "failed": 0, "tokens": 0, "_sort": event_time.isoformat()})
        api_usage_by_bucket[bucket]["_sort"] = min(api_usage_by_bucket[bucket]["_sort"], event_time.isoformat())
        api_usage_by_bucket[bucket]["tokens"] += int(row.get("input_tokens") or 0) + int(row.get("output_tokens") or 0)
        if not api_window:
            api_usage_by_bucket[bucket]["success" if row.get("status") == "success" else "failed"] += 1
    api_usage_data = [
        {key: value for key, value in row.items() if key != "_sort"}
        for row in sorted(api_usage_by_bucket.values(), key=lambda item: item["_sort"])
    ]

    active_user_ids_today = {str(row.get("user_id")) for row in operation_logs if row.get("user_id") and _in_window(_row_datetime(row, "created_at"), today_start, now)}
    active_user_ids_30d = {str(row.get("user_id")) for row in operation_logs if row.get("user_id") and _in_window(_row_datetime(row, "created_at"), last_30d, now)}
    active_user_ids_today.update(str(row.get("id")) for row in users if _in_window(_row_datetime(row, "last_login_at"), today_start, now))
    active_user_ids_30d.update(str(row.get("id")) for row in users if _in_window(_row_datetime(row, "last_login_at"), last_30d, now))

    user_growth_by_bucket: dict[str, dict] = {}
    dau_by_bucket: dict[str, set[str]] = {}
    for user in users:
        created_at = _row_datetime(user, "created_at")
        if _in_window(created_at, since, until):
            bucket = _report_bucket(created_at, since, until)
            user_growth_by_bucket.setdefault(bucket, {"label": bucket, "newUsers": 0, "dau": 0, "mau": len(active_user_ids_30d), "_sort": created_at.isoformat()})
            user_growth_by_bucket[bucket]["_sort"] = min(user_growth_by_bucket[bucket]["_sort"], created_at.isoformat())
            user_growth_by_bucket[bucket]["newUsers"] += 1
    for log in operation_logs:
        event_time = _row_datetime(log, "created_at")
        if not _in_window(event_time, since, until):
            continue
        bucket = _report_bucket(event_time, since, until)
        user_growth_by_bucket.setdefault(bucket, {"label": bucket, "newUsers": 0, "dau": 0, "mau": len(active_user_ids_30d), "_sort": event_time.isoformat()})
        user_growth_by_bucket[bucket]["_sort"] = min(user_growth_by_bucket[bucket]["_sort"], event_time.isoformat())
        if log.get("user_id"):
            dau_by_bucket.setdefault(bucket, set()).add(str(log.get("user_id")))
    for bucket, user_ids in dau_by_bucket.items():
        if bucket in user_growth_by_bucket:
            user_growth_by_bucket[bucket]["dau"] = len(user_ids)
    user_growth_data = [
        {key: value for key, value in row.items() if key != "_sort"}
        for row in sorted(user_growth_by_bucket.values(), key=lambda item: item["_sort"])
    ]

    workspace_member_counts: dict[str, int] = {}
    workspace_for_user: dict[str, str] = {}
    for row in workspace_members:
        if row.get("status") and row.get("status") != "active":
            continue
        workspace_id = str(row.get("workspace_id") or "")
        user_id = str(row.get("user_id") or "")
        if workspace_id:
            workspace_member_counts[workspace_id] = workspace_member_counts.get(workspace_id, 0) + 1
        if workspace_id and user_id and user_id not in workspace_for_user:
            workspace_for_user[user_id] = workspace_id
    workspace_buckets: dict[str, dict] = {}
    for row in workspaces:
        owner = users_by_id.get(str(row.get("owner_user_id") or ""), {})
        workspace_buckets[str(row.get("id"))] = {
            "workspace": row.get("name") or "Workspace",
            "owner": owner.get("name") or owner.get("email") or "",
            "users": max(1, workspace_member_counts.get(str(row.get("id")), 0)),
            "files": 0,
            "apiRequests": 0,
            "tokenUsage": 0,
            "estimatedCost": 0,
            "status": "active" if normalize_status(owner.get("status")) == "active" else "paused",
            "failedFiles": 0,
            "failedRequests": 0,
        }
    for user in users:
        key = f"user:{user.get('id')}"
        workspace_buckets.setdefault(
            key,
            {
                "workspace": f"Workspace của {user.get('name') or user.get('email') or 'người dùng'}",
                "owner": user.get("name") or user.get("email") or "",
                "users": 1,
                "files": 0,
                "apiRequests": 0,
                "tokenUsage": 0,
                "estimatedCost": 0,
                "status": "active" if normalize_status(user.get("status")) == "active" else "paused",
                "failedFiles": 0,
                "failedRequests": 0,
            },
        )
    files_by_id = {str(row.get("id")): row for row in files}
    for row in files:
        key = str(row.get("workspace_id") or "") or f"user:{row.get('user_id')}"
        if key not in workspace_buckets:
            user = users_by_id.get(str(row.get("user_id") or ""), {})
            workspace_buckets[key] = {
                "workspace": f"Workspace của {user.get('name') or user.get('email') or 'người dùng'}",
                "owner": user.get("name") or user.get("email") or "",
                "users": 1,
                "files": 0,
                "apiRequests": 0,
                "tokenUsage": 0,
                "estimatedCost": 0,
                "status": "active",
                "failedFiles": 0,
                "failedRequests": 0,
            }
        workspace_buckets[key]["files"] += 1
        if row.get("status") in {"failed", "error", "Lỗi"}:
            workspace_buckets[key]["failedFiles"] += 1
    for row in ai_window:
        file_row = files_by_id.get(str(row.get("file_id") or ""))
        key = str(file_row.get("workspace_id") or "") if file_row else ""
        if not key:
            user_id = str(row.get("user_id") or "")
            key = workspace_for_user.get(user_id) or f"user:{user_id}"
        if key not in workspace_buckets:
            continue
        workspace_buckets[key]["apiRequests"] += 1
        workspace_buckets[key]["tokenUsage"] += int(row.get("input_tokens") or 0) + int(row.get("output_tokens") or 0)
        workspace_buckets[key]["estimatedCost"] += float(row.get("estimated_cost") or 0)
        if row.get("status") != "success":
            workspace_buckets[key]["failedRequests"] += 1
    for row in api_window:
        user_id = str(row.get("user_id") or "")
        key = workspace_for_user.get(user_id) or f"user:{user_id}"
        if key in workspace_buckets:
            workspace_buckets[key]["apiRequests"] += 1
            if int(row.get("status_code") or 0) >= 400:
                workspace_buckets[key]["failedRequests"] += 1
    top_workspaces = []
    for row in workspace_buckets.values():
        if row["failedFiles"] or row["failedRequests"]:
            row["status"] = "warning"
        row["estimatedCost"] = round(row["estimatedCost"], 6)
        top_workspaces.append({key: value for key, value in row.items() if key not in {"failedFiles", "failedRequests"}})
    all_workspace_rows = sorted(top_workspaces, key=lambda row: (row.get("apiRequests", 0), row.get("files", 0), row.get("tokenUsage", 0)), reverse=True)
    active_workspace_count = sum(1 for row in all_workspace_rows if row.get("status") == "active")
    top_workspaces = all_workspace_rows[:10]

    failed_files = [row for row in files if row.get("status") in {"failed", "error", "Lỗi"}]
    failed_jobs = [row for row in job_rows if row.get("status") in {"failed", "error", "Lỗi"}]
    api_requests_count = len(api_today) if api_request_logs else len(ai_today)
    success_requests = api_success if api_window else sum(1 for row in ai_window if row.get("status") == "success")
    failed_requests = api_failed if api_window else ai_failed
    api_error_rate = api_error_rate if api_window else round((failed_requests / max(1, len(ai_window))) * 100, 2)
    latency = avg_latency if api_window else round(sum(int(row.get("latency_ms") or 0) for row in ai_window) / max(1, len(ai_window)), 2)
    token_limit = int(_get_json_setting(db, "ai_quota_config", DEFAULT_AI_QUOTA_CONFIG).get("monthlyTokenLimit") or 0)
    token_usage_percent = min(100, round((monthly_tokens / max(1, token_limit)) * 100)) if token_limit else 0
    uptime_seconds = max(0, int(time.time() - PROCESS_STARTED_AT))
    uptime_percent = 100 if uptime_seconds else 0

    system_health = _system_process_health(db, api_error_rate, token_usage_percent)

    system_alerts = []
    def add_alert(type_name: str, source: str, severity: str, message: str, status_value: str = "monitoring", event_time=None):
        system_alerts.append(
            {
                "time": _format_report_time(event_time or now.isoformat()),
                "type": type_name,
                "source": source,
                "severity": severity,
                "message": message,
                "status": status_value,
            }
        )

    if failed_files:
        add_alert("Files", "File parser", "warning", f"{len(failed_files)} file đang ở trạng thái lỗi.", "investigating", failed_files[0].get("uploaded_at"))
    if failed_jobs:
        add_alert("Jobs", "Worker queue", "warning", f"{len(failed_jobs)} job thất bại.", "investigating", failed_jobs[0].get("created_at"))
    if api_error_rate > 5:
        add_alert("API", "API Gateway", "critical", f"API error rate đạt {api_error_rate}%.", "monitoring")
    if token_usage_percent > 80:
        add_alert("AI", "Quota monitor", "warning", f"Token usage đã dùng {token_usage_percent}% giới hạn tháng.", "monitoring")
    pending_over_24h = [
        row for row in checkout_rows
        if row.get("status") == "pending" and (_row_datetime(row, "created_at") or now) <= now - timedelta(hours=24)
    ]
    if pending_over_24h:
        add_alert("Billing", "Checkout queue", "warning", f"{len(pending_over_24h)} checkout request chờ quá 24h.", "investigating", pending_over_24h[0].get("created_at"))
    payment_failed = [row for row in payment_rows if str(row.get("status") or "").lower() in {"failed", "payment_failed"}]
    if payment_failed:
        add_alert("Billing", "Payment provider", "warning", f"{len(payment_failed)} giao dịch thanh toán thất bại.", "monitoring", payment_failed[0].get("created_at"))
    if system_health["databaseStatus"] != "online":
        add_alert("Database", "PostgreSQL", "critical", "Database health check không đạt.", "investigating")

    recent_activities = [
        {
            "time": _format_report_time(row.get("created_at")),
            "title": str(row.get("type") or "system").replace("_", " ").title(),
            "detail": row.get("action") or "",
            "type": _activity_type(row),
        }
        for row in operation_logs[:8]
    ]

    inactive_users = sum(1 for row in users if normalize_status(row.get("status")) in {"inactive", "suspended", "deleted"})
    dashboard_stats = {
        "monthlyRevenue": monthly_revenue,
        "todayRevenue": today_revenue,
        "totalRevenue": total_revenue,
        "estimatedARR": max(mrr * 12, monthly_revenue * 12),
        "totalUsers": len(users),
        "activeUsersToday": len(active_user_ids_today),
        "activeWorkspaces": active_workspace_count,
        "processedFiles": len(files),
        "totalTokens": total_tokens,
        "totalTokensLimit": token_limit,
        "apiRequestsToday": api_requests_count,
        "apiErrorRate": api_error_rate,
        "avgResponseTime": latency,
        "uptime": round(uptime_percent, 3),
        "newUsers": sum(1 for row in users if _in_window(_row_datetime(row, "created_at"), since, until)),
        "dau": len(active_user_ids_today),
        "mau": len(active_user_ids_30d),
        "retentionRate": round((len(active_user_ids_30d) / max(1, len(users))) * 100, 2),
        "churnRate": round((inactive_users / max(1, len(users))) * 100, 2),
        "todayTokens": today_tokens,
        "monthlyTokens": monthly_tokens,
        "estimatedAiCost": round(estimated_ai_cost, 6),
        "successRequests": success_requests,
        "failedRequests": failed_requests,
        "latency": latency,
        "errorRate": api_error_rate,
        "revenueByPlan": revenue_by_plan,
    }

    return {
        "dashboardStats": dashboard_stats,
        "revenueChartData": revenue_chart,
        "apiUsageData": api_usage_data,
        "userGrowthData": user_growth_data,
        "topWorkspaces": top_workspaces,
        "systemAlerts": system_alerts[:20],
        "recentActivities": recent_activities,
        "systemHealth": system_health,
        "filters": {"lastUpdated": datetime.now(timezone(timedelta(hours=7))).strftime("%H:%M:%S")},
        "window": {"since": since.isoformat(), "until": until.isoformat()},
        "subscriptions": {"active": sum(1 for row in subscription_rows if row.get("status") == "active")},
    }


@router.get("/dashboards/ai-quality")
async def ai_quality_dashboard(_: dict = Depends(require_admin), db = Depends(get_db)):
    runs = db.table("ai_eval_runs").select("*").order("created_at", desc=True).limit(20).execute().data or []
    metrics = db.table("ai_quality_metrics").select("*").order("created_at", desc=True).limit(100).execute().data or []
    return {"runs": runs, "latestMetrics": metrics}


@router.get("/dashboards/business-metrics")
async def business_metrics_dashboard(_: dict = Depends(require_admin), db = Depends(get_db)):
    rows = db.table("business_metrics").select("*").order("updated_at", desc=True).limit(200).execute().data or []
    request_logs = db.table("api_request_logs").select("*").order("created_at", desc=True).limit(100).execute().data or []
    return {"metrics": rows, "recentRequests": request_logs}


@router.post("/ai-evals/core")
async def run_core_ai_eval(_: dict = Depends(require_admin)):
    return {"success": True, **run_ai_eval()}


@router.put("/billing/checkout-requests/{checkout_id}/confirm")
async def confirm_checkout_request(checkout_id: str, payload: CheckoutConfirmRequest, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    response = db.table("checkout_requests").select("*").eq("id", checkout_id).limit(1).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy checkout request.")
    checkout = response.data[0]
    if checkout.get("status") != "pending":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Checkout request không còn ở trạng thái pending.")
    tier_payload = TierUpdateRequest(tier=checkout.get("plan_code"), reason=f"manual_checkout_confirmed:{checkout_id}")
    result = _update_user_tier_with_audit(db, admin_user, checkout["user_id"], tier_payload)
    updated = db.table("checkout_requests").update(
        {
            "status": "confirmed",
            "admin_note": (payload.adminNote or "")[:1000],
            "confirmed_by": admin_user.get("id"),
            "confirmed_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", checkout_id).execute().data
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "billing", "action": f"manual_checkout_confirmed: {checkout_id}"}).execute()
    return {"success": True, "checkoutRequest": _checkout_payload(updated[0] if updated else checkout), "tierUpdate": result}


@router.put("/billing/checkout-requests/{checkout_id}/reject")
async def reject_checkout_request(checkout_id: str, payload: CheckoutRejectRequest, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    response = db.table("checkout_requests").update(
        {
            "status": "rejected",
            "admin_note": (payload.adminNote or "")[:1000],
            "confirmed_by": admin_user.get("id"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", checkout_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy checkout request.")
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "billing", "action": f"manual_checkout_rejected: {checkout_id}"}).execute()
    return {"success": True, "checkoutRequest": _checkout_payload(response.data[0])}


@router.put("/users/{user_id}/status")
async def update_user_status(user_id: str, payload: StatusUpdateRequest, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    new_status = _validate_user_status(payload.status)
    current_rows = db.table("users").select("*").eq("id", user_id).limit(1).execute().data or []
    if not current_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy người dùng.")
    old_status = normalize_status(current_rows[0].get("status"))
    response = db.table("users").update({"status": new_status}).eq("id", user_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy người dùng.")
    if new_status != "active":
        revoke_user_sessions(db, user_id, f"admin_status_{new_status}")
    db.table("admin_audit_logs").insert(
        {
            "actor_admin_id": admin_user.get("id"),
            "target_user_id": user_id,
            "action": "users.status.update",
            "old_value": json.dumps({"status": old_status}),
            "new_value": json.dumps({"status": new_status}),
            "reason": "admin_status_update",
        }
    ).execute()
    db.table("operation_logs").insert(
        {
            "user_id": admin_user.get("id"),
            "type": "admin",
            "action": f"Admin updated user {user_id} status from {old_status} to {new_status}",
        }
    ).execute()
    return {"success": True, "user": user_to_response(response.data[0])}


@router.put("/users/{user_id}/password")
async def reset_user_password(user_id: str, payload: AdminPasswordResetRequest, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    current_rows = db.table("users").select("*").eq("id", user_id).limit(1).execute().data or []
    if not current_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy người dùng.")
    target_user = current_rows[0]
    if str(target_user.get("id")) == str(admin_user.get("id")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không thể reset mật khẩu của chính admin tại màn này.")

    response = db.table("users").update({"password_hash": _hash_password(payload.password)}).eq("id", user_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy người dùng.")
    revoke_user_sessions(db, user_id, "admin_password_reset")
    reason = (payload.reason or "admin_password_reset").strip()[:255] or "admin_password_reset"
    db.table("admin_audit_logs").insert(
        {
            "actor_admin_id": admin_user.get("id"),
            "target_user_id": user_id,
            "action": "users.password.reset",
            "old_value": json.dumps({}),
            "new_value": json.dumps({"passwordReset": True}),
            "reason": reason,
        }
    ).execute()
    db.table("operation_logs").insert(
        {"user_id": admin_user.get("id"), "type": "admin", "action": f"Admin reset password for user {user_id}: {reason}"}
    ).execute()
    return {"success": True, "user": user_to_response(response.data[0])}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    if str(user_id) == str(admin_user.get("id")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không thể xóa chính tài khoản admin đang đăng nhập.")
    current_rows = db.table("users").select("*").eq("id", user_id).limit(1).execute().data or []
    if not current_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy người dùng.")
    old_status = normalize_status(current_rows[0].get("status"))
    response = db.table("users").update({"status": "deleted"}).eq("id", user_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy người dùng.")
    revoke_user_sessions(db, user_id, "admin_user_deleted")
    db.table("admin_audit_logs").insert(
        {
            "actor_admin_id": admin_user.get("id"),
            "target_user_id": user_id,
            "action": "users.delete",
            "old_value": json.dumps({"status": old_status}),
            "new_value": json.dumps({"status": "deleted"}),
            "reason": "admin_delete_user",
        }
    ).execute()
    db.table("operation_logs").insert(
        {"user_id": admin_user.get("id"), "type": "admin", "action": f"Admin marked user {user_id} as deleted"}
    ).execute()
    return {"success": True, "user": user_to_response(response.data[0])}


@router.get("/system-prompt")
async def get_system_prompt(_: dict = Depends(require_admin), db = Depends(get_db)):
    config = _get_json_setting(db, "prompt_config", DEFAULT_PROMPT_CONFIG)
    return {"prompt": config.get("systemPrompt") or DEFAULT_PROMPT_CONFIG["systemPrompt"]}


@router.put("/system-prompt")
async def update_system_prompt(payload: SystemPromptRequest, _: dict = Depends(require_admin), db = Depends(get_db)):
    config = _get_json_setting(db, "prompt_config", DEFAULT_PROMPT_CONFIG)
    config["systemPrompt"] = payload.prompt
    _set_json_setting(db, "prompt_config", config)
    db.table("settings").upsert({"key": "chat_system_prompt", "value": payload.prompt, "updated_at": datetime.now(timezone.utc).isoformat()}).execute()
    return {"success": True}


@router.get("/prompt-config")
async def get_prompt_config(_: dict = Depends(require_admin), db = Depends(get_db)):
    return _get_json_setting(db, "prompt_config", DEFAULT_PROMPT_CONFIG)


@router.put("/prompt-config")
async def update_prompt_config(payload: PromptConfigRequest, _: dict = Depends(require_admin), db = Depends(get_db)):
    data = payload.model_dump()
    _set_json_setting(db, "prompt_config", data)
    db.table("settings").upsert({"key": "chat_system_prompt", "value": data.get("systemPrompt", ""), "updated_at": datetime.now(timezone.utc).isoformat()}).execute()
    return {"success": True, "config": data}


@router.get("/security-settings")
async def get_security_settings(_: dict = Depends(require_admin), db = Depends(get_db)):
    return _get_json_setting(db, "security_settings", DEFAULT_SECURITY_SETTINGS)


@router.put("/security-settings")
async def update_security_settings(payload: SecuritySettingsRequest, _: dict = Depends(require_admin), db = Depends(get_db)):
    data = payload.model_dump()
    _set_json_setting(db, "security_settings", data)
    return {"success": True, "settings": data}


@router.get("/pricing-config")
async def get_pricing_config(_: dict = Depends(require_admin), db = Depends(get_db)):
    return _get_json_setting(db, "pricing_config", DEFAULT_PRICING_CONFIG)


@router.put("/pricing-config")
async def update_pricing_config(payload: PricingConfigRequest, _: dict = Depends(require_admin), db = Depends(get_db)):
    data = {
        "monthly": {**DEFAULT_PRICING_CONFIG["monthly"], **(payload.monthly or {})},
        "annual": {**DEFAULT_PRICING_CONFIG["annual"], **(payload.annual or {})},
    }
    _set_json_setting(db, "pricing_config", data)
    return {"success": True, "pricing": data}


@router.get("/feature-flags")
async def get_feature_flags(_: dict = Depends(require_admin), db = Depends(get_db)):
    return _get_json_setting(db, "feature_flags", DEFAULT_FEATURE_FLAGS)


@router.put("/feature-flags")
async def update_feature_flags(payload: FeatureFlagsRequest, _: dict = Depends(require_admin), db = Depends(get_db)):
    data = payload.model_dump()
    _set_json_setting(db, "feature_flags", data)
    return {"success": True, "flags": data}


@router.get("/logs")
async def logs(_: dict = Depends(require_admin), db = Depends(get_db)):
    response = db.table("operation_logs").select("*").order("created_at", desc=True).limit(100).execute()
    return {
        "logs": [
            {"timestamp": row.get("created_at"), "level": "INFO", "message": row.get("action"), "type": row.get("type"), "userId": row.get("user_id")}
            for row in (response.data or [])
        ]
    }


@router.post("/logs", status_code=status.HTTP_201_CREATED)
async def create_log(payload: OperationLogRequest, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    row = {
        "user_id": admin_user.get("id"),
        "type": payload.type[:30],
        "action": payload.action[:255],
    }
    response = db.table("operation_logs").insert(row).execute()
    saved = response.data[0] if response.data else row
    return {"success": True, "log": {"timestamp": saved.get("created_at"), "type": saved.get("type"), "message": saved.get("action"), "userId": saved.get("user_id")}}


@router.delete("/logs")
async def clear_logs(_: dict = Depends(require_admin), db = Depends(get_db)):
    db.table("operation_logs").delete().neq("id", 0).execute()
    return {"success": True}


@router.get("/broadcasts")
async def list_broadcasts(_: dict = Depends(require_admin), db = Depends(get_db)):
    response = db.table("system_broadcasts").select("*").order("created_at", desc=True).limit(50).execute()
    return {"broadcasts": [_broadcast_payload(row) for row in (response.data or [])]}


@router.post("/broadcasts", status_code=status.HTTP_201_CREATED)
async def create_broadcast(payload: BroadcastRequest, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    now = datetime.now(timezone.utc)
    db.table("system_broadcasts").update({"active": False}).eq("active", True).execute()
    row = {
        "message": payload.message,
        "severity": payload.severity,
        "force_logout": payload.forceLogout,
        "countdown_seconds": payload.countdownSeconds,
        "active": True,
        "created_by": admin_user.get("id"),
        "starts_at": now.isoformat(),
        "expires_at": (now + timedelta(minutes=payload.expiresInMinutes)).isoformat(),
    }
    response = db.table("system_broadcasts").insert(row).execute()
    saved = response.data[0] if response.data else row
    db.table("operation_logs").insert(
        {"user_id": admin_user.get("id"), "type": "broadcast", "action": f"Broadcast toàn hệ thống: {payload.message[:180]}"}
    ).execute()
    return {"success": True, "broadcast": _broadcast_payload(saved)}


@router.delete("/broadcasts/{broadcast_id}")
async def deactivate_broadcast(broadcast_id: str, _: dict = Depends(require_admin), db = Depends(get_db)):
    db.table("system_broadcasts").update({"active": False}).eq("id", broadcast_id).execute()
    return {"success": True}


@router.get("/api-keys")
async def list_api_keys(admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    response = db.table("api_keys").select("*").eq("user_id", admin_user["id"]).order("created_at", desc=True).execute()
    return {"apiKeys": [_api_key_payload(row) for row in (response.data or [])]}


@router.post("/api-keys", status_code=status.HTTP_201_CREATED)
async def create_api_key(payload: ApiKeyCreateRequest, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    raw_key = "sk_live_ex" + secrets.token_hex(16)
    key_id = str(int(time.time() * 1000))
    row = {
        "id": key_id,
        "user_id": admin_user["id"],
        "label": payload.label,
        "provider": payload.provider,
        "key_hash": hashlib.sha256(raw_key.encode("utf-8")).hexdigest(),
        "masked_key": f"{raw_key[:10]}...{raw_key[-4:]}",
        "status": "active",
        "daily_usage": 0,
    }
    response = db.table("api_keys").insert(row).execute()
    saved = response.data[0] if response.data else row
    db.table("operation_logs").insert(
        {"user_id": admin_user.get("id"), "type": "api_key", "action": f"Admin created API key {key_id} ({payload.label[:80]})"}
    ).execute()
    return {"success": True, "apiKey": _api_key_payload(saved, raw_key=raw_key)}


@router.put("/api-keys/{key_id}")
async def update_api_key(key_id: str, payload: ApiKeyStatusRequest, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    response = db.table("api_keys").update({"status": payload.status}).eq("id", key_id).eq("user_id", admin_user["id"]).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy API key.")
    db.table("operation_logs").insert(
        {"user_id": admin_user.get("id"), "type": "api_key", "action": f"Admin updated API key {key_id} status to {payload.status[:30]}"}
    ).execute()
    return {"success": True, "apiKey": _api_key_payload(response.data[0])}


@router.delete("/api-keys/{key_id}")
async def delete_api_key(key_id: str, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    db.table("api_keys").delete().eq("id", key_id).eq("user_id", admin_user["id"]).execute()
    db.table("operation_logs").insert(
        {"user_id": admin_user.get("id"), "type": "api_key", "action": f"Admin deleted API key {key_id}"}
    ).execute()
    return {"success": True}


@router.get("/coupons")
async def list_coupons(_: dict = Depends(require_admin), db = Depends(get_db)):
    response = db.table("coupons").select("*").order("created_at", desc=True).execute()
    return {"coupons": [{"code": row.get("code"), "percent": row.get("percent")} for row in (response.data or [])]}


@router.post("/coupons", status_code=status.HTTP_201_CREATED)
async def create_coupon(payload: CouponRequest, _: dict = Depends(require_admin), db = Depends(get_db)):
    code = payload.code.strip().upper()
    response = db.table("coupons").upsert({"code": code, "percent": payload.percent}).execute()
    row = response.data[0] if response.data else {"code": code, "percent": payload.percent}
    return {"success": True, "coupon": {"code": row.get("code"), "percent": row.get("percent")}}


@router.delete("/coupons/{code}")
async def delete_coupon(code: str, _: dict = Depends(require_admin), db = Depends(get_db)):
    db.table("coupons").delete().eq("code", code.strip().upper()).execute()
    return {"success": True}


@router.get("/templates-advanced")
async def templates_advanced_dashboard(_: dict = Depends(require_admin), db = Depends(get_db)):
    rows = db.table("templates").select("*").order("created_at", desc=True).execute().data or []
    metadata = _template_metadata(db)
    permissions_store = _template_permissions(db)
    versions = _template_versions(db)
    validation_store = _get_json_setting(db, "template_validation_results", {"results": {}}).get("results") or {}
    templates = [
        _template_advanced_payload(row, metadata.get(str(row.get("id"))), permissions_store.get(str(row.get("id"))))
        for row in rows
    ]
    logs = db.table("operation_logs").select("*").eq("type", "template").order("created_at", desc=True).limit(200).execute().data or []
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    alerts = []
    for template in templates:
        validation = validation_store.get(str(template.get("id"))) or {}
        checks = validation.get("checks") or []
        if any(check.get("key") == "hasVBA Macro" and check.get("status") == "Warning" for check in checks):
            alerts.append({"title": "Template has VBA macro", "severity": "Warning", "template": template.get("templateName"), "detail": template.get("fileName")})
        if any(check.get("key") == "sensitiveData" and check.get("status") == "Warning" for check in checks):
            alerts.append({"title": "Template contains sensitive data", "severity": "Warning", "template": template.get("templateName"), "detail": template.get("fileName")})
        if any(check.get("key") == "formulaErrors" and check.get("status") == "Warning" for check in checks):
            alerts.append({"title": "Formula error detected", "severity": "Warning", "template": template.get("templateName"), "detail": "Có formula cần kiểm tra."})
        if int(template.get("fileSize") or 0) > 50 * 1024 * 1024:
            alerts.append({"title": "File too large", "severity": "Failed", "template": template.get("templateName"), "detail": template.get("fileSizeLabel")})
        if template.get("needUpdate"):
            alerts.append({"title": "Template outdated", "severity": "NeedUpdate", "template": template.get("templateName"), "detail": "Template được đánh dấu cần cập nhật."})
        if int(template.get("downloads") or 0) >= 1000:
            alerts.append({"title": "Abnormal download activity", "severity": "Warning", "template": template.get("templateName"), "detail": f"{template.get('downloads')} downloads"})
        if len(versions.get(str(template.get("id")), [])) > 5:
            alerts.append({"title": "Old version still in use", "severity": "Warning", "template": template.get("templateName"), "detail": "Có nhiều version cũ cần dọn."})
        if template.get("accessLevel") == "Plan-based" and "free" not in [str(plan).lower() for plan in template.get("allowedPlans", [])]:
            alerts.append({"title": "Premium template accessed by Free user", "severity": "Premium", "template": template.get("templateName"), "detail": "Theo dõi quyền truy cập premium."})
    total_storage = sum(int(template.get("fileSize") or 0) for template in templates)
    return {
        "templates": templates,
        "templateStats": {
            "totalTemplates": len(templates),
            "activeTemplates": sum(1 for item in templates if item.get("status") == "Active"),
            "pendingTemplates": sum(1 for item in templates if item.get("status") == "Pending"),
            "errorTemplates": sum(1 for item in templates if item.get("status") == "Error"),
            "premiumTemplates": sum(1 for item in templates if item.get("premium")),
            "totalDownloads": sum(int(item.get("downloads") or 0) for item in templates),
            "monthlyUsage": sum(1 for row in logs if (_parse_datetime_filter(_iso_text(row.get("created_at"))) or now) >= month_start),
            "newTemplatesThisMonth": sum(1 for item in templates if (_parse_datetime_filter(_iso_text(item.get("createdAt"))) or now) >= month_start),
            "needUpdateTemplates": sum(1 for item in templates if item.get("needUpdate")),
            "totalStorage": total_storage,
            "totalStorageLabel": format_file_size(total_storage),
        },
        "templateCategories": DEFAULT_TEMPLATE_CATEGORIES,
        "templateTags": DEFAULT_TEMPLATE_TAGS,
        "templateVersions": versions,
        "templateLogs": [
            {"time": row.get("created_at"), "user": row.get("user_id") or "", "action": row.get("action") or "", "template": "", "ip": "", "status": "success"}
            for row in logs
        ],
        "templateAlerts": alerts[:50],
        "templatePermissions": permissions_store,
        "templateValidationResult": validation_store,
        "templateAnalytics": {
            "mostDownloadedTemplates": sorted(templates, key=lambda item: int(item.get("downloads") or 0), reverse=True)[:10],
            "mostUsedTemplatesWithAI": sorted(templates, key=lambda item: int(item.get("aiUses") or 0), reverse=True)[:10],
            "downloadsByDay": [],
            "usageByDepartment": [],
            "usageByWorkspace": [],
            "errorRateByTemplate": [
                {"template": item.get("templateName"), "status": validation_store.get(str(item.get("id")), {}).get("overallStatus", "NotValidated")}
                for item in templates
            ],
            "leastUsedTemplates": sorted(templates, key=lambda item: int(item.get("downloads") or 0))[:10],
            "templatesNeedUpdate": [item for item in templates if item.get("needUpdate")],
        },
    }


@router.post("/templates-advanced", status_code=status.HTTP_201_CREATED)
async def create_template_advanced(request: Request, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    template_id = str((payload or {}).get("templateCode") or (payload or {}).get("id") or f"tpl_{uuid4().hex[:16]}").strip()[:60]
    if not template_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="templateCode không được rỗng.")
    existing = db.table("templates").select("id").eq("id", template_id).limit(1).execute().data or []
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="templateCode không được trùng.")
    name = str(payload.get("templateName") or payload.get("name") or "").strip()
    category = str(payload.get("category") or "").strip()
    if not name or not category:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="templateName và category không được rỗng.")
    row = {
        "id": template_id,
        "name": name[:180],
        "category": category[:80],
        "description": str(payload.get("description") or ""),
        "file": str(payload.get("fileName") or payload.get("file") or "")[:255],
        "icon": str(payload.get("icon") or "XL")[:20],
        "color": str(payload.get("color") or "accent")[:40],
    }
    saved = db.table("templates").insert(row).execute().data[0]
    metadata = _template_metadata(db)
    metadata[template_id] = {**payload, "templateCode": template_id, "updatedAt": datetime.now(timezone.utc).isoformat(), "createdBy": admin_user.get("email") or admin_user.get("id") or "admin"}
    _set_template_metadata(db, metadata)
    versions = _template_versions(db)
    versions.setdefault(template_id, []).insert(0, {"version": metadata[template_id].get("version") or "1.0.0", "fileName": row["file"], "updatedBy": admin_user.get("email") or admin_user.get("id") or "admin", "updatedAt": metadata[template_id]["updatedAt"], "changeNote": "Created template", "fileSize": metadata[template_id].get("fileSize") or 0, "status": "Active", "snapshot": metadata[template_id]})
    _set_template_versions(db, versions)
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "template", "action": f"template_created: {template_id}"}).execute()
    return {"success": True, "template": _template_advanced_payload(saved, metadata[template_id], _template_permissions(db).get(template_id))}


@router.put("/templates-advanced/{template_id}")
async def update_template_advanced(template_id: str, request: Request, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    rows = db.table("templates").select("*").eq("id", template_id).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy template.")
    row_update = {
        "name": str(payload.get("templateName") or payload.get("name") or rows[0].get("name") or "")[:180],
        "category": str(payload.get("category") or rows[0].get("category") or "")[:80],
        "description": str(payload.get("description") or rows[0].get("description") or ""),
        "file": str(payload.get("fileName") or rows[0].get("file") or "")[:255],
        "icon": str(payload.get("icon") or rows[0].get("icon") or "XL")[:20],
        "color": str(payload.get("color") or rows[0].get("color") or "accent")[:40],
    }
    updated = db.table("templates").update(row_update).eq("id", template_id).execute().data[0]
    metadata = _template_metadata(db)
    previous = metadata.get(template_id, {})
    metadata[template_id] = {**previous, **payload, "templateCode": template_id, "updatedAt": datetime.now(timezone.utc).isoformat()}
    _set_template_metadata(db, metadata)
    versions = _template_versions(db)
    version_rows = versions.setdefault(template_id, [])
    version_rows.insert(0, {"version": metadata[template_id].get("version") or str(len(version_rows) + 1), "fileName": row_update["file"], "updatedBy": admin_user.get("email") or admin_user.get("id") or "admin", "updatedAt": metadata[template_id]["updatedAt"], "changeNote": payload.get("changeNote") or "Updated template", "fileSize": metadata[template_id].get("fileSize") or 0, "status": metadata[template_id].get("status") or "Active", "snapshot": metadata[template_id]})
    versions[template_id] = version_rows[:50]
    _set_template_versions(db, versions)
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "template", "action": f"template_updated: {template_id}"}).execute()
    return {"success": True, "template": _template_advanced_payload(updated, metadata[template_id], _template_permissions(db).get(template_id))}


@router.delete("/templates-advanced/{template_id}")
async def delete_template_advanced(template_id: str, force: bool = Query(default=False), admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    metadata = _template_metadata(db)
    used = int((metadata.get(template_id) or {}).get("usedByActiveWorkflows") or 0)
    if used and not force:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Không cho xóa template đang được sử dụng nếu chưa xác nhận đặc biệt.")
    response = db.table("templates").delete().eq("id", template_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy template.")
    metadata.pop(template_id, None)
    _set_template_metadata(db, metadata)
    permissions = _template_permissions(db)
    permissions.pop(template_id, None)
    _set_template_permissions(db, permissions)
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "template", "action": f"template_deleted: {template_id}"}).execute()
    return {"success": True}


@router.post("/templates-advanced/upload")
async def upload_template_file(
    file: UploadFile = File(...),
    templateId: str = Form(default=""),
    admin_user: dict = Depends(require_admin),
    db = Depends(get_db),
):
    filename = _template_safe_filename(file.filename or "template.xlsx")
    extension = _template_file_type(filename)
    if extension not in TEMPLATE_ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File upload phải là .xlsx, .xls, .xlsm hoặc .csv.")
    content = await file.read()
    security_settings = _get_json_setting(db, "security_settings", DEFAULT_SECURITY_SETTINGS)
    max_bytes = int(security_settings.get("fileSizeLimit") or 10) * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File không được vượt quá dung lượng cho phép.")
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File upload rỗng.")
    if extension in {".xlsx", ".xlsm"} and not content.startswith(b"PK"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File không đúng định dạng.")
    if extension == ".xls" and not content.startswith(b"\xd0\xcf\x11\xe0"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File không đúng định dạng.")
    storage_path = f"templates/{templateId or 'draft'}/{uuid4()}_{filename}"
    StorageService(db).upload_bytes(storage_path, content, file.content_type or "application/octet-stream")
    preview = {}
    try:
        parsed = _parse_template_content(filename, content)
        preview = {"rowCount": parsed.row_count, "columnCount": parsed.col_count, "columnNames": parsed.headers, "firstRows": parsed.preview_rows[:20]}
    except Exception:
        preview = {"rowCount": 0, "columnCount": 0, "columnNames": [], "firstRows": []}
    result = {
        "fileName": filename,
        "fileType": extension,
        "fileSize": len(content),
        "fileSizeLabel": format_file_size(len(content)),
        "storagePath": storage_path,
        "hasMacros": _template_has_macros(filename, content),
        **preview,
    }
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "template", "action": f"template_file_uploaded: {filename}"}).execute()
    return {"success": True, "file": result}


def _template_preview(template_id: str, db) -> dict:
    rows = db.table("templates").select("*").eq("id", template_id).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy template.")
    metadata = _template_metadata(db).get(template_id, {})
    template = _template_advanced_payload(rows[0], metadata, _template_permissions(db).get(template_id))
    content = b""
    if template.get("storagePath"):
        content = StorageService(db).download_bytes(template["storagePath"])
    if content:
        parsed = _parse_template_content(template["fileName"], content)
        sheet_names = _template_sheet_names(template["fileName"], content)
        formula_cells = []
        sensitive = bool(re.search(rb"[\w.-]+@[\w.-]+|\b0\d{9,10}\b", content[:200000]))
        return {
            "template": template,
            "sheets": sheet_names,
            "sheetCount": len(sheet_names),
            "firstRows": parsed.preview_rows[:20],
            "rowCount": parsed.row_count,
            "columnCount": parsed.col_count,
            "columnNames": parsed.headers,
            "formulaCells": formula_cells,
            "macroWarning": _template_has_macros(template["fileName"], content),
            "hasMacros": _template_has_macros(template["fileName"], content),
            "sensitiveDataWarning": sensitive,
        }
    return {
        "template": template,
        "sheets": ["Template"],
        "sheetCount": 1,
        "firstRows": [],
        "rowCount": 0,
        "columnCount": 0,
        "columnNames": [],
        "formulaCells": [],
        "macroWarning": False,
        "hasMacros": False,
        "sensitiveDataWarning": False,
    }


@router.get("/templates-advanced/{template_id}/preview")
async def preview_template_advanced(template_id: str, _: dict = Depends(require_admin), db = Depends(get_db)):
    return {"success": True, "preview": _template_preview(template_id, db)}


@router.post("/templates-advanced/{template_id}/validate")
async def validate_template_advanced(template_id: str, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    preview = _template_preview(template_id, db)
    result = _template_validation_from_payload(preview["template"], preview)
    validation = _get_json_setting(db, "template_validation_results", {"results": {}}).get("results") or {}
    validation[template_id] = result
    _set_json_setting(db, "template_validation_results", {"results": validation})
    metadata = _template_metadata(db)
    if template_id in metadata:
        metadata[template_id]["status"] = "Error" if result["overallStatus"] == "Failed" else "NeedUpdate" if result["overallStatus"] == "Warning" else "Active"
        metadata[template_id]["updatedAt"] = datetime.now(timezone.utc).isoformat()
        _set_template_metadata(db, metadata)
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "template", "action": f"template_validated: {template_id}: {result['overallStatus']}"}).execute()
    return {"success": True, "validation": result}


@router.get("/templates-advanced/{template_id}/versions")
async def list_template_versions(template_id: str, _: dict = Depends(require_admin), db = Depends(get_db)):
    return {"versions": (_template_versions(db).get(template_id) or [])}


@router.post("/templates-advanced/{template_id}/versions")
async def update_template_version(template_id: str, request: Request, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    metadata = _template_metadata(db)
    if template_id not in metadata:
        metadata[template_id] = {}
    metadata[template_id] = {**metadata[template_id], **payload, "updatedAt": datetime.now(timezone.utc).isoformat()}
    _set_template_metadata(db, metadata)
    versions = _template_versions(db)
    rows = versions.setdefault(template_id, [])
    rows.insert(0, {"version": payload.get("version") or str(len(rows) + 1), "fileName": payload.get("fileName") or "", "updatedBy": admin_user.get("email") or admin_user.get("id") or "admin", "updatedAt": metadata[template_id]["updatedAt"], "changeNote": payload.get("changeNote") or "Updated file", "fileSize": payload.get("fileSize") or 0, "status": payload.get("status") or "Active", "snapshot": metadata[template_id]})
    versions[template_id] = rows[:50]
    _set_template_versions(db, versions)
    return {"success": True, "versions": versions[template_id]}


@router.post("/templates-advanced/{template_id}/versions/{version_index}/rollback")
async def rollback_template_version(template_id: str, version_index: int, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    versions = _template_versions(db)
    rows = versions.get(template_id) or []
    if version_index < 0 or version_index >= len(rows):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy version.")
    metadata = _template_metadata(db)
    metadata[template_id] = {**(rows[version_index].get("snapshot") or {}), "updatedAt": datetime.now(timezone.utc).isoformat()}
    _set_template_metadata(db, metadata)
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "template", "action": f"template_version_rollback: {template_id}: {version_index}"}).execute()
    return {"success": True, "templateMetadata": metadata[template_id]}


@router.put("/templates-advanced/{template_id}/permissions")
async def update_template_permissions(template_id: str, request: Request, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    permissions = _template_permissions(db)
    permissions[template_id] = {**DEFAULT_TEMPLATE_PERMISSIONS, **(payload or {})}
    _set_template_permissions(db, permissions)
    metadata = _template_metadata(db)
    if template_id in metadata:
        metadata[template_id]["accessLevel"] = permissions[template_id].get("accessLevel") or metadata[template_id].get("accessLevel") or "Public"
        metadata[template_id]["updatedAt"] = datetime.now(timezone.utc).isoformat()
        _set_template_metadata(db, metadata)
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "template", "action": f"template_permissions_updated: {template_id}"}).execute()
    return {"success": True, "permissions": permissions[template_id]}


@router.post("/templates-advanced/bulk")
async def bulk_template_action(request: Request, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    payload = await request.json()
    ids = [str(item) for item in (payload.get("ids") or [])]
    action = str(payload.get("action") or "").strip()
    value = payload.get("value")
    metadata = _template_metadata(db)
    validation = _get_json_setting(db, "template_validation_results", {"results": {}}).get("results") or {}
    changed = 0
    for template_id in ids:
        meta = metadata.setdefault(template_id, {})
        if action == "activate":
            meta["status"] = "Active"
        elif action == "lock":
            meta["status"] = "Draft"
        elif action == "change_category":
            meta["category"] = value or meta.get("category")
            db.table("templates").update({"category": meta["category"]}).eq("id", template_id).execute()
        elif action == "change_access":
            meta["accessLevel"] = value or meta.get("accessLevel")
        elif action == "validate":
            try:
                preview = _template_preview(template_id, db)
                result = _template_validation_from_payload(preview["template"], preview)
                validation[template_id] = result
                meta["status"] = "Error" if result["overallStatus"] == "Failed" else "NeedUpdate" if result["overallStatus"] == "Warning" else "Active"
            except Exception:
                pass
        elif action == "delete":
            db.table("templates").delete().eq("id", template_id).execute()
            metadata.pop(template_id, None)
        meta["updatedAt"] = datetime.now(timezone.utc).isoformat()
        changed += 1
    _set_template_metadata(db, metadata)
    if action == "validate":
        _set_json_setting(db, "template_validation_results", {"results": validation})
    db.table("operation_logs").insert({"user_id": admin_user.get("id"), "type": "template", "action": f"template_bulk_action: {action}: {changed} items"}).execute()
    return {"success": True, "changed": changed}


@router.get("/jobs")
async def list_jobs(_: dict = Depends(require_admin), db = Depends(get_db)):
    response = db.table("jobs").select("*").order("created_at", desc=True).limit(100).execute()
    return {"jobs": [_job_payload(row) for row in (response.data or [])]}


@router.post("/jobs", status_code=status.HTTP_201_CREATED)
async def create_job(payload: JobRequest, _: dict = Depends(require_admin), db = Depends(get_db)):
    row = {
        "id": "job_" + str(int(time.time() * 1000)),
        "file_name": payload.fileName,
        "owner": payload.owner,
        "size": payload.size,
        "type": payload.type,
        "status": payload.status,
        "duration": payload.duration,
        "error": payload.error,
    }
    response = db.table("jobs").insert(row).execute()
    saved = response.data[0] if response.data else row
    return {"success": True, "job": _job_payload(saved)}


@router.get("/feedbacks")
async def list_feedbacks(_: dict = Depends(require_admin), db = Depends(get_db)):
    response = db.table("feedbacks").select("*").order("created_at", desc=True).limit(100).execute()
    return {"feedbacks": [_feedback_payload(row) for row in (response.data or [])]}


@router.put("/feedbacks/{feedback_id}/reply")
async def reply_feedback(feedback_id: int, payload: FeedbackReplyRequest, _: dict = Depends(require_admin), db = Depends(get_db)):
    response = db.table("feedbacks").update({"reply": payload.reply, "status": "resolved"}).eq("id", feedback_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy feedback.")
    return {"success": True, "feedback": _feedback_payload(response.data[0])}


@router.put("/feedbacks/{feedback_id}/status")
async def update_feedback_status(feedback_id: int, payload: FeedbackStatusRequest, _: dict = Depends(require_admin), db = Depends(get_db)):
    response = db.table("feedbacks").update({"status": payload.status}).eq("id", feedback_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy feedback.")
    return {"success": True, "feedback": _feedback_payload(response.data[0])}


@router.get("/templates")
async def list_admin_templates(_: dict = Depends(require_admin), db = Depends(get_db)):
    response = db.table("templates").select("*").order("created_at", desc=True).execute()
    return {"templates": [_template_payload(row) for row in (response.data or [])]}


@router.post("/templates", status_code=status.HTTP_201_CREATED)
async def create_admin_template(payload: AdminTemplateRequest, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    template_id = (payload.id or f"tpl_{uuid4().hex[:16]}").strip()[:60]
    existing = db.table("templates").select("id").eq("id", template_id).limit(1).execute().data or []
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Mã template đã tồn tại.")
    row = {
        "id": template_id,
        "name": payload.name.strip()[:180],
        "category": payload.category.strip()[:80],
        "description": payload.description.strip(),
        "file": payload.file.strip()[:255],
        "icon": (payload.icon or "XL").strip()[:20],
        "color": (payload.color or "accent").strip()[:40],
    }
    response = db.table("templates").insert(row).execute()
    saved = response.data[0] if response.data else row
    db.table("operation_logs").insert(
        {"user_id": admin_user.get("id"), "type": "template", "action": f"Admin created template {template_id}: {row['name'][:120]}"}
    ).execute()
    return {"success": True, "template": _template_payload(saved)}


@router.put("/templates/{template_id}")
async def update_admin_template(template_id: str, payload: AdminTemplateRequest, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    row = {
        "name": payload.name.strip()[:180],
        "category": payload.category.strip()[:80],
        "description": payload.description.strip(),
        "file": payload.file.strip()[:255],
        "icon": (payload.icon or "XL").strip()[:20],
        "color": (payload.color or "accent").strip()[:40],
    }
    response = db.table("templates").update(row).eq("id", template_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy template.")
    db.table("operation_logs").insert(
        {"user_id": admin_user.get("id"), "type": "template", "action": f"Admin updated template {template_id}: {row['name'][:120]}"}
    ).execute()
    return {"success": True, "template": _template_payload(response.data[0])}


@router.delete("/templates/{template_id}")
async def delete_admin_template(template_id: str, admin_user: dict = Depends(require_admin), db = Depends(get_db)):
    response = db.table("templates").delete().eq("id", template_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy template.")
    db.table("operation_logs").insert(
        {"user_id": admin_user.get("id"), "type": "template", "action": f"Admin deleted template {template_id}"}
    ).execute()
    return {"success": True}
