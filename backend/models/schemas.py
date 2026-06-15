from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=150)
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=150)
    password: str = Field(min_length=1)


class GoogleAuthRequest(BaseModel):
    credential: str = Field(min_length=20)


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=3, max_length=150)


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=300)
    password: str = Field(min_length=6, max_length=128)


class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, Any]] = []
    fileId: Optional[str] = None


class FormulaRequest(BaseModel):
    prompt: str
    context: str = "chung"


class VBARequest(BaseModel):
    prompt: str


class DataCheckRequest(BaseModel):
    fileId: str


class CleanRequest(BaseModel):
    fileId: str
    column: str
    rule: str


class ReconcileRequest(BaseModel):
    fileAId: str
    fileBId: str
    keyA: str
    keyB: str
    valA: str
    valB: str


class AutopilotRequest(BaseModel):
    goal: str
    outputs: List[str] = []
    files: List[str] = []


class TableBuilderRequest(BaseModel):
    description: str
    type: str = "chung"
    includeFormula: bool = True
    includeSampleData: bool = True


class DocBuilderRequest(BaseModel):
    type: str
    facts: str = ""
    tone: str = "chuyên nghiệp"
    fileId: Optional[str] = None


class DocxExportRequest(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    content: str = ""
    tableHeaders: List[str] = []
    tableRows: List[List[str]] = []
    fileName: str = "excelai-document.docx"
    operationType: str = "doc_builder"
    sourceFileId: Optional[str] = None


class PdfExportRequest(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    lines: List[str] = []
    fileName: str = "excelai-report.pdf"
    operationType: str = "report_builder"
    sourceFileId: Optional[str] = None


class TableXlsxExportRequest(BaseModel):
    tableName: str = Field(default="ExcelAI Table", max_length=180)
    columns: List[Any] = []
    rows: List[List[Any]] = []
    fileName: str = "excelai-table.xlsx"


class CleanExportRequest(BaseModel):
    fileId: str
    rules: List[Dict[str, Any]] = []
    fileName: str = "cleaned-data.xlsx"


class ReconcileExportRequest(BaseModel):
    fileAId: str
    fileBId: str
    keyA: str
    keyB: str
    valA: str
    valB: str
    fileName: str = "reconciliation-report.xlsx"


class CheckoutConfirmRequest(BaseModel):
    adminNote: str = ""


class CheckoutRejectRequest(BaseModel):
    adminNote: str = ""


class TierUpdateRequest(BaseModel):
    tier: str
    reason: str = Field(default="admin_update", max_length=255)


class AdminUserCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=150)
    password: str = Field(min_length=6, max_length=128)
    tier: str = "free"
    status: str = "active"
    reason: str = Field(default="admin_create_user", max_length=255)


class AdminUserProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(default=None, max_length=100)
    email: Optional[str] = Field(default=None, max_length=150)
    reason: str = Field(default="admin_profile_update", max_length=255)


class StatusUpdateRequest(BaseModel):
    status: str


class AdminPasswordResetRequest(BaseModel):
    password: str = Field(min_length=6, max_length=128)
    reason: str = Field(default="admin_password_reset", max_length=255)


class SystemPromptRequest(BaseModel):
    prompt: str


class PromptConfigRequest(BaseModel):
    systemPrompt: str = ""
    freeLimit: int = 20
    formulaPrompt: str = ""
    vbaPrompt: str = ""
    analysisPrompt: str = ""
    checkerPrompt: str = ""
    cleanerPrompt: str = ""
    reconciliationPrompt: str = ""
    reportPrompt: str = ""


class SecuritySettingsRequest(BaseModel):
    fileSizeLimit: int = 10
    allowedTypes: str = ".csv, .xlsx, .xls"
    blockedTypes: str = ".exe, .bat, .cmd, .js, .vbs, .scr, .dll"
    maxExcelRows: int = 100000
    maxExcelSheets: int = 20
    scanMalware: bool = True
    blockVbaMacro: bool = True
    allowXlsm: bool = False
    dataRetention: int = 30
    enableMacroWarning: bool = True
    rateLimit: int = 100
    uploadPerHourLimit: int = 30
    failedLoginLimit: int = 5
    accountLockMinutes: int = 15
    sensitiveDataWarning: bool = True
    piiTypes: List[str] = Field(default_factory=lambda: ["national_id", "phone", "email", "address", "tax_code", "bank_account"])
    sensitiveDataAction: str = "mask"
    enableIpWhitelist: bool = False
    enableIpBlacklist: bool = True
    whitelistIps: str = ""
    blacklistIps: str = "45.xxx.xxx.xxx\n113.xxx.xxx.xxx"
    enableOtp2fa: bool = True
    adminAccessControl: str = "IP Whitelist (Disabled)"
    maintenanceMode: bool = False
    appName: str = "ExcelAI Workspace"
    logoUrl: str = ""
    supportEmail: str = "support@excelai.com"
    supportHotline: str = "1900 9090"
    supportWebsite: str = "https://excelai.local/support"
    timezone: str = "Asia/Saigon"
    defaultLanguage: str = "vi"
    appVersion: str = "v1.2.0"
    environment: str = "Development"
    lastUpdate: str = "10/06/2026 10:30"
    maintenanceTitle: str = "Hệ thống đang bảo trì"
    maintenanceMessage: str = "Người dùng thường sẽ bị tạm khóa truy cập cho đến khi chế độ bảo trì kết thúc."
    maintenanceStart: str = ""
    maintenanceEnd: str = ""
    maintenanceAllowAdmin: bool = True
    maintenanceAllowWhitelist: bool = True
    maintenanceAutoStart: bool = False
    maintenanceAutoEnd: bool = True


class PricingConfigRequest(BaseModel):
    monthly: Dict[str, str] = Field(default_factory=lambda: {"pro": "149,000đ", "enterprise": "399,000đ", "period": "/tháng"})
    annual: Dict[str, str] = Field(default_factory=lambda: {"pro": "119,000đ", "enterprise": "319,000đ", "period": "/tháng (trả năm)"})


class FeatureFlagsRequest(BaseModel):
    enable_autopilot: bool = True
    enable_table_builder: bool = True
    enable_document_builder: bool = True
    enable_data_checker: bool = True
    enable_reconciliation: bool = True
    enable_excel_import: bool = True
    enable_export_report: bool = True
    enable_pii_scanner: bool = True
    enable_new_dashboard: bool = False
    enable_ai_suggestion: bool = True
    flags: List[Dict[str, Any]] = Field(default_factory=list)
    rolePermissions: Dict[str, Dict[str, str]] = Field(default_factory=dict)
    changeLogs: List[Dict[str, Any]] = Field(default_factory=list)


class WorkspaceSettingsRequest(BaseModel):
    workspaceName: str = "ExcelAI Workspace"
    retention: str = "30"


class AdminWorkspaceSettingsRequest(BaseModel):
    workspaceName: str = Field(default="ExcelAI Workspace", max_length=120)
    retention: str = Field(default="30", max_length=30)
    fileSizeLimit: int = Field(default=10, ge=1, le=500)
    allowedTypes: str = Field(default=".csv, .xlsx, .xls", max_length=120)
    aiEnabled: bool = True
    notes: str = Field(default="", max_length=1000)


class ApiKeyCreateRequest(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    provider: str = "excelai"


class ApiKeyStatusRequest(BaseModel):
    status: str


class CouponRequest(BaseModel):
    code: str = Field(min_length=1, max_length=40)
    percent: int = Field(ge=1, le=100)


class JobRequest(BaseModel):
    fileName: str = Field(min_length=1, max_length=255)
    owner: str = ""
    size: str = ""
    type: str = "upload"
    status: str = "ready"
    duration: str = "0.5s"
    error: str = ""


class FeedbackRequest(BaseModel):
    userName: str = ""
    type: str = "support"
    text: str = Field(min_length=1)


class FeedbackReplyRequest(BaseModel):
    reply: str = Field(min_length=1)


class FeedbackStatusRequest(BaseModel):
    status: str = Field(min_length=1, max_length=30)


class AdminTemplateRequest(BaseModel):
    id: Optional[str] = Field(default=None, max_length=60)
    name: str = Field(min_length=1, max_length=180)
    category: str = Field(default="", max_length=80)
    description: str = ""
    file: str = Field(default="", max_length=255)
    icon: str = Field(default="XL", max_length=20)
    color: str = Field(default="accent", max_length=40)


class OperationLogRequest(BaseModel):
    type: str = Field(min_length=1, max_length=30)
    action: str = Field(min_length=1, max_length=255)


class ChatMessagePayload(BaseModel):
    sender: str
    text: str


class ChatThreadPayload(BaseModel):
    id: str
    title: str = "Cuộc chat mới"
    messages: List[ChatMessagePayload] = []


class ChatThreadsRequest(BaseModel):
    threads: List[ChatThreadPayload] = []


class BroadcastRequest(BaseModel):
    message: str = Field(min_length=1)
    severity: str = "warning"
    forceLogout: bool = True
    countdownSeconds: int = Field(default=60, ge=10, le=600)
    expiresInMinutes: int = Field(default=30, ge=1, le=1440)
