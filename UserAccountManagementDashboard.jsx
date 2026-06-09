import React, { useEffect, useMemo, useState } from "react";
import { adminService } from "./services/adminService.js";

const CURRENT_ADMIN_EMAIL = "admin150905@gmail.com";

const PERMISSIONS = [
  "manageUsers",
  "manageWorkspace",
  "uploadExcel",
  "useTableBuilder",
  "useDocumentBuilder",
  "useDataChecker",
  "exportReport",
  "viewSystemReport",
  "viewSecurityLogs",
  "configureSystem",
];

const PERMISSION_LABELS = {
  manageUsers: "Manage Users",
  manageWorkspace: "Manage Workspace",
  uploadExcel: "Upload Excel",
  useTableBuilder: "Use Table Builder",
  useDocumentBuilder: "Use Document Builder",
  useDataChecker: "Use Data Checker",
  exportReport: "Export Report",
  viewSystemReport: "View System Report",
  viewSecurityLogs: "View Security Logs",
  configureSystem: "Configure System",
};

const BACKEND_ROLE_OPTIONS = ["Admin", "User"];

const PLAN_LABEL_TO_TIER = {
  Free: "free",
  Starter: "pro",
  Pro: "pro",
  Business: "business",
  Enterprise: "enterprise",
};

const TIER_TO_PLAN_LABEL = {
  free: "Free",
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};

const UI_STATUS_TO_API_STATUS = {
  active: "active",
  locked: "suspended",
  suspended: "suspended",
  pending: "pending",
  expired: "inactive",
  inactive: "inactive",
  deleted: "deleted",
};

const API_STATUS_TO_UI_STATUS = {
  active: "active",
  suspended: "locked",
  pending: "pending",
  inactive: "expired",
  deleted: "deleted",
};

const initialPlanLimits = {
  Free: {
    monthlyUsageLimit: 100,
    tokenLimit: 100_000,
    uploadLimit: 20,
    storageLimit: 1,
  },
  Pro: {
    monthlyUsageLimit: 1_000,
    tokenLimit: 1_500_000,
    uploadLimit: 250,
    storageLimit: 10,
  },
  Business: {
    monthlyUsageLimit: 10_000,
    tokenLimit: 20_000_000,
    uploadLimit: 2_000,
    storageLimit: 100,
  },
  Enterprise: {
    monthlyUsageLimit: 100_000,
    tokenLimit: 250_000_000,
    uploadLimit: 25_000,
    storageLimit: 2_000,
  },
};

const initialRolePermissions = {
  Admin: {
    manageUsers: true,
    manageWorkspace: true,
    uploadExcel: true,
    useTableBuilder: true,
    useDocumentBuilder: true,
    useDataChecker: true,
    exportReport: true,
    viewSystemReport: true,
    viewSecurityLogs: true,
    configureSystem: true,
  },
  Manager: {
    manageUsers: false,
    manageWorkspace: true,
    uploadExcel: true,
    useTableBuilder: true,
    useDocumentBuilder: true,
    useDataChecker: true,
    exportReport: true,
    viewSystemReport: false,
    viewSecurityLogs: false,
    configureSystem: false,
  },
  User: {
    manageUsers: false,
    manageWorkspace: false,
    uploadExcel: true,
    useTableBuilder: true,
    useDocumentBuilder: true,
    useDataChecker: true,
    exportReport: false,
    viewSystemReport: false,
    viewSecurityLogs: false,
    configureSystem: false,
  },
  Viewer: {
    manageUsers: false,
    manageWorkspace: false,
    uploadExcel: false,
    useTableBuilder: false,
    useDocumentBuilder: false,
    useDataChecker: false,
    exportReport: false,
    viewSystemReport: false,
    viewSecurityLogs: false,
    configureSystem: false,
  },
};

const emptyUserForm = {
  fullName: "",
  email: "",
  phone: "",
  role: "User",
  workspace: "",
  plan: "Free",
  temporaryPassword: "",
  status: "pending",
  enable2FA: false,
  sendActivationEmail: true,
  requirePasswordChange: true,
};

const defaultPlanForm = {
  currentPlan: "",
  newPlan: "Pro",
  startDate: new Date().toISOString().slice(0, 10),
  expiryDate: "",
  monthlyUsageLimit: initialPlanLimits.Pro.monthlyUsageLimit,
  tokenLimit: initialPlanLimits.Pro.tokenLimit,
  uploadLimit: initialPlanLimits.Pro.uploadLimit,
  storageLimit: initialPlanLimits.Pro.storageLimit,
  note: "",
};

function planToTier(plan) {
  return PLAN_LABEL_TO_TIER[String(plan || "").trim()] || "free";
}

function tierToPlan(tier) {
  return TIER_TO_PLAN_LABEL[String(tier || "").trim().toLowerCase()] || "Free";
}

function apiStatusToUi(status) {
  const value = String(status || "active").trim().toLowerCase();
  return API_STATUS_TO_UI_STATUS[value] || value || "active";
}

function uiStatusToApi(status) {
  const value = String(status || "active").trim().toLowerCase();
  return UI_STATUS_TO_API_STATUS[value] || "active";
}

function normalizeRoleLabel(role) {
  return String(role || "user").trim().toLowerCase() === "admin" ? "Admin" : "User";
}

function formatBackendDateTime(value, fallback = "N/A") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

function formatBackendDate(value, fallback = "") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10) || fallback;
  return date.toISOString().slice(0, 10);
}

function buildPlanLimitsFromEntitlements(entitlements = {}, baseLimits = initialPlanLimits) {
  const nextLimits = { ...baseLimits };

  Object.entries(entitlements || {}).forEach(([tier, limits]) => {
    const plan = tierToPlan(tier);
    const previous = nextLimits[plan] || baseLimits.Free;
    nextLimits[plan] = {
      monthlyUsageLimit: Number(limits?.ai_requests_per_month ?? previous.monthlyUsageLimit ?? 0),
      tokenLimit: Number(previous.tokenLimit ?? 0),
      uploadLimit: Number(limits?.max_files ?? previous.uploadLimit ?? 0),
      storageLimit: Number(previous.storageLimit ?? 0),
    };
  });

  return nextLimits;
}

function mapBackendUser(user = {}, workspaceMap = {}, limitsMap = initialPlanLimits) {
  const plan = tierToPlan(user.tier || user.plan);
  const role = normalizeRoleLabel(user.role);
  const status = apiStatusToUi(user.status);
  const limits = limitsMap[plan] || initialPlanLimits[plan] || initialPlanLimits.Free;
  const workspace = user.workspace || user.workspaceName || workspaceMap[String(user.id)]?.name || `Workspace của ${user.name || user.email || "người dùng"}`;

  return {
    id: String(user.id || user.email || Date.now()),
    fullName: user.fullName || user.name || user.email || "Người dùng",
    name: user.name || user.fullName || user.email || "Người dùng",
    email: user.email || "",
    phone: user.phone || "N/A",
    role,
    workspace,
    plan,
    tier: planToTier(plan),
    monthlyUsage: Number(user.monthlyUsage ?? user.usageCount ?? 0),
    tokenUsage: Number(user.tokenUsage ?? user.token_count ?? 0),
    createdAt: formatBackendDate(user.createdAt || user.created_at),
    lastLogin: formatBackendDateTime(user.lastLogin || user.lastActivityAt || user.createdAt || user.created_at),
    status,
    enable2FA: Boolean(user.enable2FA ?? false),
    emailVerified: user.emailVerified ?? status !== "pending",
    device: user.device || "Backend API",
    ip: user.ip || "N/A",
    monthlyUsageLimit: Number(user.monthlyUsageLimit ?? user.usageLimit ?? limits.monthlyUsageLimit),
    tokenLimit: Number(user.tokenLimit ?? limits.tokenLimit),
    uploadLimit: Number(user.uploadLimit ?? limits.uploadLimit),
    storageLimit: Number(user.storageLimit ?? limits.storageLimit),
    permissions: user.permissions || initialRolePermissions[role] || initialRolePermissions.User,
    raw: user,
  };
}

function mapActivityLogs(logs = [], userList = []) {
  const usersById = new Map(userList.map((user) => [String(user.id), user]));

  return (logs || []).map((log, index) => {
    const owner = usersById.get(String(log.userId || log.user_id || ""));
    const action = log.message || log.action || log.text || "Hoạt động hệ thống";
    const lowered = String(action).toLowerCase();
    const failed = lowered.includes("fail") || lowered.includes("error") || lowered.includes("blocked");

    return {
      id: String(log.id || `LOG-${index}-${log.timestamp || log.created_at || Date.now()}`),
      time: formatBackendDateTime(log.timestamp || log.created_at),
      user: owner?.fullName || log.user || log.email || "System",
      action,
      ip: log.ip || log.ip_address || "N/A",
      device: log.device || log.user_agent || "Backend API",
      workspace: owner?.workspace || log.workspace || "System",
      status: failed ? "failed" : "success",
    };
  });
}

function buildSecurityAlerts(securityDashboard = {}, userList = []) {
  const failedLoginRows = securityDashboard.failedLogin || [];
  const unsafeRows = securityDashboard.blockedUnsafeVba || [];
  const apiKeyRows = securityDashboard.apiKeyChanges || [];
  const accountStateRows = [
    ...userList.filter((user) => user.status === "locked").map((user) => ({
      title: "Account locked",
      user: user.fullName,
      severity: "locked",
      detail: `${user.email} đang bị khóa trên backend.`,
      time: user.lastLogin,
    })),
    ...userList.filter((user) => user.status === "pending").map((user) => ({
      title: "Pending account",
      user: user.fullName,
      severity: "pending",
      detail: `${user.email} đang chờ kích hoạt hoặc xác minh.`,
      time: user.createdAt,
    })),
  ];

  const rows = [
    ...failedLoginRows.map((row) => ({
      title: "Login failed",
      severity: "locked",
      detail: row.action || row.message || "Backend ghi nhận đăng nhập thất bại.",
      time: row.created_at,
      userId: row.user_id,
    })),
    ...unsafeRows.map((row) => ({
      title: "Unsafe VBA blocked",
      severity: "pending",
      detail: row.action || row.message || "Backend đã chặn macro/VBA không an toàn.",
      time: row.created_at,
      userId: row.user_id,
    })),
    ...apiKeyRows.map((row) => ({
      title: "API key change",
      severity: "pending",
      detail: row.action || row.message || "Có thay đổi API key.",
      time: row.created_at,
      userId: row.user_id,
    })),
    ...accountStateRows,
  ];

  const usersById = new Map(userList.map((user) => [String(user.id), user]));
  return rows.slice(0, 8).map((row, index) => {
    const owner = usersById.get(String(row.userId || ""));
    return {
      id: String(row.id || `SEC-${index}-${row.time || Date.now()}`),
      title: row.title,
      user: row.user || owner?.fullName || "System",
      severity: row.severity,
      detail: row.detail,
      time: formatBackendDateTime(row.time, "N/A"),
    };
  });
}

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

function getInitials(name) {
  return String(name || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(-2)
    .toUpperCase();
}

function deriveUserStats(userList) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    totalUsers: userList.length,
    activeUsers: userList.filter((user) => user.status === "active").length,
    lockedUsers: userList.filter((user) => user.status === "locked").length,
    newUsersThisMonth: userList.filter((user) => new Date(user.createdAt) >= startOfMonth).length,
    freeUsers: userList.filter((user) => user.plan === "Free").length,
    proUsers: userList.filter((user) => user.plan === "Pro").length,
    businessUsers: userList.filter((user) => user.plan === "Business").length,
    enterpriseUsers: userList.filter((user) => user.plan === "Enterprise").length,
    monthlyUsage: userList.reduce((total, user) => total + Number(user.monthlyUsage || 0), 0),
    totalTokens: userList.reduce((total, user) => total + Number(user.tokenUsage || 0), 0),
    pendingVerification: userList.filter((user) => user.status === "pending" || !user.emailVerified).length,
  };
}

export default function UserAccountManagementDashboard() {
  const [users, setUsers] = useState([]);
  const [userStats, setUserStats] = useState(deriveUserStats([]));
  const [filters, setFilters] = useState({
    search: "",
    planFilter: "all",
    roleFilter: "all",
    statusFilter: "all",
    workspaceFilter: "all",
    createdDateFrom: "",
    createdDateTo: "",
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [planLimits, setPlanLimits] = useState(initialPlanLimits);
  const [rolePermissions, setRolePermissions] = useState(initialRolePermissions);

  const [selectedIds, setSelectedIds] = useState([]);
  const [activeModal, setActiveModal] = useState(null);
  const [formMode, setFormMode] = useState("add");
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [formErrors, setFormErrors] = useState({});
  const [detailTab, setDetailTab] = useState("Profile");
  const [planForm, setPlanForm] = useState(defaultPlanForm);
  const [planMode, setPlanMode] = useState("single");
  const [permissionDraft, setPermissionDraft] = useState(initialRolePermissions.User);
  const [confirmState, setConfirmState] = useState({
    action: "",
    title: "",
    message: "",
    targetUser: null,
    specialAdminLock: false,
  });
  const [toast, setToast] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dataError, setDataError] = useState("");
  const [selectedUserAudit, setSelectedUserAudit] = useState(null);
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  const filteredUsers = filterUsers();
  const workspaces = useMemo(() => [...new Set(users.map((user) => user.workspace).filter(Boolean))], [users]);
  const selectedUsers = useMemo(() => users.filter((user) => selectedIds.includes(user.id)), [users, selectedIds]);
  const allFilteredSelected = filteredUsers.length > 0 && filteredUsers.every((user) => selectedIds.includes(user.id));

  useEffect(() => {
    refreshDashboardData();
  }, []);

  function showToast(message, type = "success") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  async function refreshDashboardData(showLoading = true) {
    if (showLoading) setIsLoading(true);
    setDataError("");

    const [usersResult, entitlementsResult, logsResult, securityResult, workspacesResult] = await Promise.allSettled([
      adminService.getUsers(1, 500),
      adminService.getEntitlements(),
      adminService.getLogs(),
      adminService.getSecurityAuditDashboard(),
      adminService.getWorkspaces ? adminService.getWorkspaces() : adminService.refreshAdminCaches(),
    ]);

    const nextPlanLimits =
      entitlementsResult.status === "fulfilled"
        ? buildPlanLimitsFromEntitlements(entitlementsResult.value?.entitlements, initialPlanLimits)
        : initialPlanLimits;
    setPlanLimits(nextPlanLimits);

    const workspaceRows =
      workspacesResult.status === "fulfilled"
        ? workspacesResult.value?.workspaces || workspacesResult.value?.workspaces_available || []
        : [];
    const workspaceMap = workspaceRows.reduce((map, workspace) => {
      if (workspace?.userId) map[String(workspace.userId)] = workspace;
      return map;
    }, {});

    if (usersResult.status === "fulfilled") {
      const backendUsers = Array.isArray(usersResult.value?.users) ? usersResult.value.users : [];
      const nextUsers = backendUsers.map((user) => mapBackendUser(user, workspaceMap, nextPlanLimits));
      commitUsers(nextUsers);
      setSelectedIds((prev) => prev.filter((id) => nextUsers.some((user) => user.id === id)));
      setSelectedUser((current) => (current ? nextUsers.find((user) => user.id === current.id) || null : null));

      const backendLogs = logsResult.status === "fulfilled" ? logsResult.value?.logs || [] : [];
      const nextLogs = mapActivityLogs(backendLogs, nextUsers);
      setActivityLogs(nextLogs);

      const securityDashboard = securityResult.status === "fulfilled" ? securityResult.value || {} : {};
      setSecurityAlerts(buildSecurityAlerts(securityDashboard, nextUsers));
    }

    const failed = [usersResult, entitlementsResult, logsResult, securityResult, workspacesResult].find((result) => result.status === "rejected");
    if (failed) {
      setDataError(failed.reason?.message || "Không thể tải đầy đủ dữ liệu admin từ backend.");
    }

    setIsLoading(false);
  }

  async function loadSelectedUserAudit(user) {
    if (!user?.id) return;
    setIsAuditLoading(true);
    setSelectedUserAudit(null);

    try {
      const audit = await adminService.getUserAudit(user.id);
      setSelectedUserAudit(audit);
    } catch (error) {
      setSelectedUserAudit({ error: error.message || "Không thể tải audit trail của user." });
    } finally {
      setIsAuditLoading(false);
    }
  }

  function commitUsers(nextUsers) {
    setUsers(nextUsers);
    setUserStats(deriveUserStats(nextUsers));
  }

  function validateUserForm(form = userForm, mode = formMode) {
    const errors = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = form.email.trim().toLowerCase();

    if (!form.fullName.trim()) errors.fullName = "fullName không được rỗng.";
    if (!normalizedEmail || !emailPattern.test(normalizedEmail)) errors.email = "email phải đúng định dạng.";
    if (normalizedEmail && users.some((user) => user.email.toLowerCase() === normalizedEmail && user.id !== selectedUser?.id)) {
      errors.email = "email không được trùng.";
    }
    if (!form.role) errors.role = "role không được rỗng.";
    if (!form.plan) errors.plan = "plan không được rỗng.";
    if (mode === "add" && !form.temporaryPassword.trim()) {
      errors.temporaryPassword = "temporaryPassword không được rỗng khi tạo user mới.";
    }
    if (form.temporaryPassword.trim() && form.temporaryPassword.trim().length < 6) {
      errors.temporaryPassword = "temporaryPassword cần tối thiểu 6 ký tự.";
    }

    setFormErrors(errors);
    return { isValid: Object.keys(errors).length === 0, errors };
  }

  async function handleAddUser() {
    const validation = validateUserForm(userForm, "add");
    if (!validation.isValid) {
      showToast("Vui lòng kiểm tra lại thông tin user.", "error");
      return;
    }

    if (userForm.role !== "User") {
      showToast("Backend hiện chỉ hỗ trợ tạo tài khoản role User từ màn này.", "error");
      return;
    }

    setIsSaving(true);
    try {
      await adminService.createUser({
        name: userForm.fullName.trim(),
        email: userForm.email.trim().toLowerCase(),
        password: userForm.temporaryPassword,
        tier: planToTier(userForm.plan),
        status: uiStatusToApi(userForm.status),
        reason: "user_dashboard_create",
      });
      await refreshDashboardData(false);
      setActiveModal(null);
      setUserForm(emptyUserForm);
      showToast("Đã tạo user mới trên backend.");
    } catch (error) {
      showToast(error.message || "Không thể tạo user trên backend.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEditUser() {
    if (!selectedUser) return;

    const validation = validateUserForm(userForm, "edit");
    if (!validation.isValid) {
      showToast("Vui lòng kiểm tra lại thông tin user.", "error");
      return;
    }

    const changedUnsupportedFields = [
      userForm.phone.trim() !== String(selectedUser.phone || "").trim() && "phone",
      userForm.workspace.trim() !== String(selectedUser.workspace || "").trim() && "workspace",
      userForm.role !== selectedUser.role && "role",
      Boolean(userForm.enable2FA) !== Boolean(selectedUser.enable2FA) && "enable2FA",
      Boolean(userForm.requirePasswordChange) !== Boolean(selectedUser.requirePasswordChange) && "requirePasswordChange",
    ].filter(Boolean);

    if (changedUnsupportedFields.length) {
      showToast(`Backend chưa có API lưu: ${changedUnsupportedFields.join(", ")}.`, "error");
      return;
    }

    setIsSaving(true);
    try {
      const nextName = userForm.fullName.trim();
      const nextEmail = userForm.email.trim().toLowerCase();
      const nextTier = planToTier(userForm.plan);
      const currentTier = planToTier(selectedUser.plan);
      const nextStatus = uiStatusToApi(userForm.status);
      const currentStatus = uiStatusToApi(selectedUser.status);

      if (nextName !== selectedUser.fullName || nextEmail !== selectedUser.email) {
        await adminService.updateUserProfile(selectedUser.id, {
          name: nextName,
          email: nextEmail,
          reason: "user_dashboard_edit",
        });
      }

      if (nextTier !== currentTier) {
        await adminService.updateUserTier(selectedUser.id, nextTier, "user_dashboard_edit");
      }

      if (nextStatus !== currentStatus) {
        await adminService.updateUserStatus(selectedUser.id, nextStatus);
      }

      if (userForm.temporaryPassword.trim()) {
        await adminService.resetUserPassword(selectedUser.id, userForm.temporaryPassword.trim(), "user_dashboard_edit_password");
      }

      await refreshDashboardData(false);
      setActiveModal(null);
      showToast("Đã cập nhật user trên backend.");
    } catch (error) {
      showToast(error.message || "Không thể cập nhật user trên backend.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteUser(targetUser = selectedUser) {
    if (!targetUser) return;

    if (targetUser.email.toLowerCase() === CURRENT_ADMIN_EMAIL.toLowerCase()) {
      showToast("Không cho xóa tài khoản admin hiện tại.", "error");
      return;
    }

    setIsSaving(true);
    try {
      await adminService.deleteUser(targetUser.id);
      await refreshDashboardData(false);
      setSelectedIds((prev) => prev.filter((id) => id !== targetUser.id));
      setActiveModal(null);
      showToast(`Đã xóa mềm ${targetUser.fullName} trên backend.`);
    } catch (error) {
      showToast(error.message || "Không thể xóa user trên backend.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLockUser(targetUser = selectedUser, confirmed = false) {
    if (!targetUser) return;

    if (targetUser.role === "Admin" && !confirmed) {
      openConfirm("lock", targetUser, true);
      return;
    }

    setIsSaving(true);
    try {
      await adminService.updateUserStatus(targetUser.id, "suspended");
      await refreshDashboardData(false);
      setActiveModal(null);
      showToast(`Đã khóa ${targetUser.fullName} trên backend.`);
    } catch (error) {
      showToast(error.message || "Không thể khóa user trên backend.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUnlockUser(targetUser = selectedUser) {
    if (!targetUser) return;

    setIsSaving(true);
    try {
      await adminService.updateUserStatus(targetUser.id, "active");
      await refreshDashboardData(false);
      setActiveModal(null);
      showToast(`Đã mở khóa ${targetUser.fullName} trên backend.`);
    } catch (error) {
      showToast(error.message || "Không thể mở khóa user trên backend.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleResetPassword(targetUser = selectedUser) {
    if (!targetUser) return;

    const temporaryPassword = window.prompt(`Mật khẩu tạm mới cho ${targetUser.email}:`, "");
    if (temporaryPassword === null) return;
    if (temporaryPassword.trim().length < 6) {
      showToast("Mật khẩu tạm cần tối thiểu 6 ký tự.", "error");
      return;
    }

    setIsSaving(true);
    try {
      await adminService.resetUserPassword(targetUser.id, temporaryPassword.trim(), "user_dashboard_password_reset");
      await refreshDashboardData(false);
      setActiveModal(null);
      showToast(`Đã reset mật khẩu cho ${targetUser.fullName} trên backend.`);
    } catch (error) {
      showToast(error.message || "Không thể reset mật khẩu trên backend.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleChangePlan() {
    const targetIds = planMode === "bulk" ? selectedIds : selectedUser ? [selectedUser.id] : [];
    if (!targetIds.length) {
      showToast("Chưa chọn user để đổi gói.", "error");
      return;
    }

    if (!planForm.newPlan) {
      showToast("Vui lòng chọn gói mới.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const tier = planToTier(planForm.newPlan);
      const reason = planForm.note.trim() || "user_dashboard_change_plan";
      await Promise.all(targetIds.map((id) => adminService.updateUserTier(id, tier, reason)));
      await refreshDashboardData(false);
      setActiveModal(null);
      showToast(planMode === "bulk" ? `Đã đổi gói cho ${targetIds.length} user trên backend.` : "Đã đổi gói dịch vụ trên backend.");
    } catch (error) {
      showToast(error.message || "Không thể đổi gói trên backend.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  function handleUpdatePermissions() {
    if (!selectedUser) return;

    showToast("Backend hiện chưa có API lưu phân quyền chi tiết theo từng user.", "error");
  }

  async function handleBulkAction(action) {
    if (!selectedIds.length) {
      showToast("Hãy chọn ít nhất một user.", "error");
      return;
    }

    if (action === "lock") {
      const hasAdmin = selectedUsers.some((user) => user.role === "Admin");
      setConfirmState({
        action: "bulkLock",
        title: hasAdmin ? "Xác nhận khóa admin trong danh sách" : "Xác nhận khóa user đã chọn",
        message: hasAdmin
          ? `Danh sách có ${selectedUsers.filter((user) => user.role === "Admin").length} tài khoản Admin. Hành động này có thể ảnh hưởng quyền vận hành.`
          : `Khóa ${selectedIds.length} user đã chọn?`,
        targetUser: null,
        specialAdminLock: hasAdmin,
      });
      setActiveModal("confirm");
      return;
    }

    if (action === "lockConfirmed") {
      setIsSaving(true);
      try {
        await Promise.all(selectedIds.map((id) => adminService.updateUserStatus(id, "suspended")));
        await refreshDashboardData(false);
        setActiveModal(null);
        showToast(`Đã khóa ${selectedIds.length} user trên backend.`);
      } catch (error) {
        showToast(error.message || "Không thể khóa user hàng loạt trên backend.", "error");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (action === "unlock") {
      setIsSaving(true);
      try {
        await Promise.all(selectedIds.map((id) => adminService.updateUserStatus(id, "active")));
        await refreshDashboardData(false);
        showToast(`Đã mở khóa ${selectedIds.length} user trên backend.`);
      } catch (error) {
        showToast(error.message || "Không thể mở khóa user hàng loạt trên backend.", "error");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (action === "changePlan") {
      openChangePlanModal(null, "bulk");
      return;
    }

    if (action === "sendActivation") {
      showToast("Backend hiện chưa có API gửi activation email hàng loạt.", "error");
      return;
    }

    if (action === "delete") {
      const includesCurrentAdmin = selectedUsers.some((user) => user.email.toLowerCase() === CURRENT_ADMIN_EMAIL.toLowerCase());
      setConfirmState({
        action: "bulkDelete",
        title: includesCurrentAdmin ? "Xóa user đã chọn, bỏ qua admin hiện tại" : "Xác nhận xóa user đã chọn",
        message: includesCurrentAdmin
          ? "Tài khoản admin hiện tại sẽ không bị xóa. Các tài khoản còn lại trong danh sách chọn sẽ bị xóa."
          : `Xóa ${selectedIds.length} user đã chọn?`,
        targetUser: null,
        specialAdminLock: false,
      });
      setActiveModal("confirm");
      return;
    }

    if (action === "deleteConfirmed") {
      const removableIds = selectedUsers
        .filter((user) => user.email.toLowerCase() !== CURRENT_ADMIN_EMAIL.toLowerCase())
        .map((user) => user.id);

      if (!removableIds.length) {
        showToast("Không cho xóa tài khoản admin hiện tại.", "error");
        setActiveModal(null);
        return;
      }

      setIsSaving(true);
      try {
        await Promise.all(removableIds.map((id) => adminService.deleteUser(id)));
        await refreshDashboardData(false);
        setSelectedIds([]);
        setActiveModal(null);
        showToast(`Đã xóa mềm ${removableIds.length} user trên backend.`);
      } catch (error) {
        showToast(error.message || "Không thể xóa user hàng loạt trên backend.", "error");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (action === "exportSelected") {
      handleExportUsers("selected");
    }
  }

  function handleExportUsers(scope = "filtered") {
    const rows = scope === "selected" ? users.filter((user) => selectedIds.includes(user.id)) : filteredUsers;
    if (!rows.length) {
      showToast("Không có user để xuất.", "error");
      return;
    }

    const columns = ["id", "fullName", "email", "role", "workspace", "plan", "monthlyUsage", "tokenUsage", "createdAt", "lastLogin", "status"];
    const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      columns.join(","),
      ...rows.map((user) => columns.map((column) => escapeCsv(user[column])).join(",")),
    ].join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `excelai-users-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`Đã xuất ${rows.length} user ra CSV.`);
  }

  function getStatusBadge(status) {
    const badges = {
      active: "bg-green-500/20 text-green-400 border-green-500/30",
      locked: "bg-red-500/20 text-red-400 border-red-500/30",
      suspended: "bg-red-500/20 text-red-400 border-red-500/30",
      pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      expired: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      inactive: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      deleted: "bg-slate-700/50 text-slate-300 border-slate-600",
      failed: "bg-red-500/20 text-red-400 border-red-500/30",
      success: "bg-green-500/20 text-green-400 border-green-500/30",
    };

    return badges[String(status || "").toLowerCase()] || "bg-slate-500/20 text-slate-300 border-slate-500/30";
  }

  function getPlanBadge(plan) {
    const badges = {
      Free: "bg-slate-500/20 text-slate-300 border-slate-500/30",
      Pro: "bg-green-500/20 text-green-400 border-green-500/30",
      Business: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      Enterprise: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    };

    return badges[plan] || badges.Free;
  }

  function filterUsers() {
    return users.filter((user) => {
      const search = filters.search.trim().toLowerCase();
      const created = new Date(user.createdAt);
      const from = filters.createdDateFrom ? new Date(filters.createdDateFrom) : null;
      const to = filters.createdDateTo ? new Date(filters.createdDateTo) : null;

      const matchesSearch =
        !search ||
        user.fullName.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search) ||
        user.workspace.toLowerCase().includes(search);
      const matchesPlan = filters.planFilter === "all" || user.plan === filters.planFilter;
      const matchesRole = filters.roleFilter === "all" || user.role === filters.roleFilter;
      const matchesStatus = filters.statusFilter === "all" || user.status === filters.statusFilter;
      const matchesWorkspace = filters.workspaceFilter === "all" || user.workspace === filters.workspaceFilter;
      const matchesFrom = !from || created >= from;
      const matchesTo = !to || created <= to;

      return matchesSearch && matchesPlan && matchesRole && matchesStatus && matchesWorkspace && matchesFrom && matchesTo;
    });
  }

  function resetFilters() {
    setFilters({
      search: "",
      planFilter: "all",
      roleFilter: "all",
      statusFilter: "all",
      workspaceFilter: "all",
      createdDateFrom: "",
      createdDateTo: "",
    });
  }

  function openAddUserModal() {
    setSelectedUser(null);
    setFormMode("add");
    setUserForm(emptyUserForm);
    setFormErrors({});
    setActiveModal("userForm");
  }

  function openEditUserModal(user) {
    setSelectedUser(user);
    setFormMode("edit");
    setUserForm({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      workspace: user.workspace,
      plan: user.plan,
      temporaryPassword: "",
      status: user.status,
      enable2FA: Boolean(user.enable2FA),
      sendActivationEmail: false,
      requirePasswordChange: Boolean(user.requirePasswordChange),
    });
    setFormErrors({});
    setActiveModal("userForm");
  }

  function openDetailModal(user) {
    setSelectedUser(user);
    setDetailTab("Profile");
    loadSelectedUserAudit(user);
    setActiveModal("detail");
  }

  function openChangePlanModal(user, mode = "single") {
    const basePlan = user?.plan || "Mixed plans";
    const newPlan = user?.plan && user.plan !== "Enterprise" ? user.plan : "Pro";
    const limits = planLimits[newPlan] || planLimits.Pro;

    setSelectedUser(mode === "bulk" ? null : user || selectedUser);
    setPlanMode(mode);
    setPlanForm({
      ...defaultPlanForm,
      currentPlan: mode === "bulk" ? "Mixed plans" : basePlan,
      newPlan,
      monthlyUsageLimit: limits.monthlyUsageLimit,
      tokenLimit: limits.tokenLimit,
      uploadLimit: limits.uploadLimit,
      storageLimit: limits.storageLimit,
    });
    setActiveModal("changePlan");
  }

  function openPermissionsModal(user) {
    setSelectedUser(user);
    setPermissionDraft(user.permissions || rolePermissions[user.role] || initialRolePermissions.User);
    setActiveModal("permissions");
  }

  function openConfirm(action, user, specialAdminLock = false) {
    if (action === "delete" && user.email.toLowerCase() === CURRENT_ADMIN_EMAIL.toLowerCase()) {
      showToast("Không cho xóa tài khoản admin hiện tại.", "error");
      return;
    }

    const copy = {
      lock: {
        title: specialAdminLock ? "Xác nhận đặc biệt: khóa tài khoản Admin" : "Xác nhận khóa user",
        message: specialAdminLock
          ? `${user.fullName} là tài khoản Admin. Khóa tài khoản này có thể làm gián đoạn vận hành hệ thống.`
          : `Khóa tài khoản ${user.fullName}?`,
      },
      unlock: {
        title: "Xác nhận mở khóa user",
        message: `Mở khóa tài khoản ${user.fullName}?`,
      },
      reset: {
        title: "Xác nhận reset mật khẩu",
        message: `Tạo mật khẩu tạm mới cho ${user.fullName}?`,
      },
      delete: {
        title: "Xác nhận xóa user",
        message: `Xóa mềm tài khoản ${user.fullName} trên backend? User sẽ bị đăng xuất và chuyển trạng thái deleted.`,
      },
    };

    setSelectedUser(user);
    setConfirmState({
      action,
      title: copy[action].title,
      message: copy[action].message,
      targetUser: user,
      specialAdminLock,
    });
    setActiveModal("confirm");
  }

  async function confirmAction() {
    if (confirmState.action === "lock") await handleLockUser(confirmState.targetUser, true);
    else if (confirmState.action === "unlock") await handleUnlockUser(confirmState.targetUser);
    else if (confirmState.action === "reset") await handleResetPassword(confirmState.targetUser);
    else if (confirmState.action === "delete") await handleDeleteUser(confirmState.targetUser);
    else if (confirmState.action === "bulkDelete") await handleBulkAction("deleteConfirmed");
    else if (confirmState.action === "bulkLock") await handleBulkAction("lockConfirmed");
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleAllFiltered() {
    if (allFilteredSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredUsers.some((user) => user.id === id)));
      return;
    }

    setSelectedIds((prev) => [...new Set([...prev, ...filteredUsers.map((user) => user.id)])]);
  }

  const detailActivityLogs =
    selectedUser && Array.isArray(selectedUserAudit?.operationLogs)
      ? mapActivityLogs(selectedUserAudit.operationLogs, [selectedUser])
      : selectedUser
        ? activityLogs.filter((log) => log.user === selectedUser.fullName)
        : [];
  const detailAiUsageRows = Array.isArray(selectedUserAudit?.aiUsage) ? selectedUserAudit.aiUsage : [];
  const detailRequestUsage = detailAiUsageRows.reduce((total, row) => total + Number(row.request_count || 0), 0);
  const detailTokenUsage = detailAiUsageRows.reduce((total, row) => total + Number(row.token_count || 0), 0);
  const detailFiles = Array.isArray(selectedUserAudit?.files) ? selectedUserAudit.files : [];

  const Button = ({ children, variant = "secondary", className = "", ...props }) => {
    const variants = {
      primary: "bg-green-600 hover:bg-green-700 text-white border border-green-600",
      secondary: "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700",
      danger: "bg-transparent border border-red-500 text-red-400 hover:bg-red-500/10",
    };

    return (
      <button
        className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  };

  const Badge = ({ children, className = "" }) => (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${className}`}>{children}</span>
  );

  const Input = ({ label, error, className = "", ...props }) => (
    <label className={`space-y-2 ${className}`}>
      <span className="text-xs font-semibold uppercase text-slate-400">{label}</span>
      <input
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition placeholder:text-slate-600 focus:border-green-500"
        {...props}
      />
      {error ? <span className="block text-xs text-red-400">{error}</span> : null}
    </label>
  );

  const Select = ({ label, error, children, className = "", ...props }) => (
    <label className={`space-y-2 ${className}`}>
      <span className="text-xs font-semibold uppercase text-slate-400">{label}</span>
      <select className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-green-500" {...props}>
        {children}
      </select>
      {error ? <span className="block text-xs text-red-400">{error}</span> : null}
    </label>
  );

  const Toggle = ({ checked, onChange, label, description }) => (
    <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 accent-green-600" />
      <span>
        <span className="block text-sm font-semibold text-white">{label}</span>
        {description ? <span className="mt-1 block text-xs text-slate-400">{description}</span> : null}
      </span>
    </label>
  );

  const Modal = ({ title, children, size = "max-w-3xl" }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur">
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl ${size}`}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button
            type="button"
            onClick={() => setActiveModal(null)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1 text-sm font-semibold text-slate-300 hover:bg-slate-800"
            aria-label="Close modal"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  const StatCard = ({ label, value, hint }) => (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow">
      <p className="text-sm font-medium text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </div>
  );

  const UsageBar = ({ value, max }) => {
    const percent = Math.min(100, Math.round((Number(value || 0) / Number(max || 1)) * 100));
    const color = percent >= 100 ? "bg-red-500" : percent > 80 ? "bg-yellow-400" : "bg-green-500";

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300">{formatNumber(value)}</span>
          <span className="text-slate-500">{percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      {toast ? (
        <div
          className={`fixed right-4 top-4 z-[60] rounded-2xl border px-4 py-3 text-sm shadow-2xl ${
            toast.type === "error"
              ? "border-red-500/40 bg-red-500/15 text-red-200"
              : "border-green-500/40 bg-green-500/15 text-green-200"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-normal text-white">Quản lý Tài Khoản Người Dùng 👥</h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
                Xem, thêm mới, chỉnh sửa, khóa/mở khóa và theo dõi hoạt động tài khoản khách hàng từ backend.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => refreshDashboardData()} disabled={isLoading || isSaving}>
                Refresh data
              </Button>
              <Button variant="primary" onClick={openAddUserModal} disabled={isLoading || isSaving}>
                Thêm User Mới
              </Button>
              <Button onClick={() => handleExportUsers("filtered")} disabled={isLoading || isSaving}>Xuất danh sách</Button>
              <Button onClick={() => showToast("Backend hiện chưa có API import users.", "error")}>Import users</Button>
            </div>
          </div>
        </header>

        {dataError ? (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            {dataError}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-200">
            Đang tải dữ liệu thật từ backend...
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Users" value={formatNumber(userStats.totalUsers)} hint="Tổng tài khoản" />
          <StatCard label="Active Users" value={formatNumber(userStats.activeUsers)} hint="Đang hoạt động" />
          <StatCard label="Locked Users" value={formatNumber(userStats.lockedUsers)} hint="Bị khóa" />
          <StatCard label="New Users This Month" value={formatNumber(userStats.newUsersThisMonth)} hint="Tạo trong tháng" />
          <StatCard label="Free Users" value={formatNumber(userStats.freeUsers)} hint="Gói Free" />
          <StatCard label="Pro Users" value={formatNumber(userStats.proUsers)} hint="Gói Pro" />
          <StatCard label="Business Users" value={formatNumber(userStats.businessUsers)} hint="Gói Business" />
          <StatCard label="Enterprise Users" value={formatNumber(userStats.enterpriseUsers)} hint="Gói Enterprise" />
          <StatCard label="Monthly Usage" value={formatNumber(userStats.monthlyUsage)} hint="Tổng usage tháng" />
          <StatCard label="Total Tokens" value={formatNumber(userStats.totalTokens)} hint="Token đã dùng" />
          <StatCard label="Pending Verification" value={formatNumber(userStats.pendingVerification)} hint="Chờ xác minh" />
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input
              label="Search"
              placeholder="Tên, email, workspace..."
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            />
            <Select label="Plan" value={filters.planFilter} onChange={(event) => setFilters((prev) => ({ ...prev, planFilter: event.target.value }))}>
              <option value="all">All plans</option>
              {Object.keys(planLimits).map((plan) => (
                <option key={plan} value={plan}>
                  {plan}
                </option>
              ))}
            </Select>
            <Select label="Role" value={filters.roleFilter} onChange={(event) => setFilters((prev) => ({ ...prev, roleFilter: event.target.value }))}>
              <option value="all">All roles</option>
              {BACKEND_ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
            <Select label="Status" value={filters.statusFilter} onChange={(event) => setFilters((prev) => ({ ...prev, statusFilter: event.target.value }))}>
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="locked">Locked</option>
              <option value="pending">Pending</option>
              <option value="expired">Expired</option>
              <option value="deleted">Deleted</option>
            </Select>
            <Select label="Workspace" value={filters.workspaceFilter} onChange={(event) => setFilters((prev) => ({ ...prev, workspaceFilter: event.target.value }))}>
              <option value="all">All workspaces</option>
              {workspaces.map((workspace) => (
                <option key={workspace} value={workspace}>
                  {workspace}
                </option>
              ))}
            </Select>
            <Input
              label="Created From"
              type="date"
              value={filters.createdDateFrom}
              onChange={(event) => setFilters((prev) => ({ ...prev, createdDateFrom: event.target.value }))}
            />
            <Input
              label="Created To"
              type="date"
              value={filters.createdDateTo}
              onChange={(event) => setFilters((prev) => ({ ...prev, createdDateTo: event.target.value }))}
            />
            <div className="flex items-end">
              <Button className="w-full" onClick={resetFilters}>
                Reset filter
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Bulk Actions</h2>
              <p className="mt-1 text-sm text-slate-400">{selectedIds.length} user đang được chọn.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handleBulkAction("lock")} disabled={!selectedIds.length || isSaving}>
                Lock selected
              </Button>
              <Button onClick={() => handleBulkAction("unlock")} disabled={!selectedIds.length || isSaving}>
                Unlock selected
              </Button>
              <Button onClick={() => handleBulkAction("changePlan")} disabled={!selectedIds.length || isSaving}>
                Change plan selected
              </Button>
              <Button onClick={() => handleBulkAction("sendActivation")} disabled={!selectedIds.length || isSaving}>
                Send activation email
              </Button>
              <Button variant="danger" onClick={() => handleBulkAction("delete")} disabled={!selectedIds.length || isSaving}>
                Delete selected
              </Button>
              <Button onClick={() => handleBulkAction("exportSelected")} disabled={!selectedIds.length || isSaving}>
                Export selected
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Users Table</h2>
              <p className="mt-1 text-sm text-slate-400">Hiển thị {filteredUsers.length} / {users.length} tài khoản.</p>
            </div>
            <Badge className="border-blue-500/30 bg-blue-500/20 text-blue-400">Advanced user table</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1280px] w-full divide-y divide-slate-800 text-left text-sm">
              <thead className="bg-slate-950 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} className="h-4 w-4 rounded border-slate-700 bg-slate-900 accent-green-600" />
                  </th>
                  <th className="px-4 py-3">Avatar</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Workspace</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Monthly Usage</th>
                  <th className="px-4 py-3">Token Usage</th>
                  <th className="px-4 py-3">Created At</th>
                  <th className="px-4 py-3">Last Login</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredUsers.length ? (
                  filteredUsers.map((user) => {
                    const limits = planLimits[user.plan] || planLimits.Free;

                    return (
                      <tr key={user.id} className="hover:bg-slate-800/40">
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(user.id)}
                            onChange={() => toggleSelected(user.id)}
                            className="h-4 w-4 rounded border-slate-700 bg-slate-900 accent-green-600"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20 text-sm font-bold text-green-300">
                            {getInitials(user.fullName)}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-semibold text-white">{user.fullName}</td>
                        <td className="px-4 py-4 text-slate-300">{user.email}</td>
                        <td className="px-4 py-4 text-slate-300">{user.role}</td>
                        <td className="px-4 py-4 text-slate-300">{user.workspace}</td>
                        <td className="px-4 py-4">
                          <Badge className={getPlanBadge(user.plan)}>{user.plan}</Badge>
                        </td>
                        <td className="px-4 py-4">
                          <UsageBar value={user.monthlyUsage} max={user.monthlyUsageLimit || limits.monthlyUsageLimit} />
                        </td>
                        <td className="px-4 py-4">
                          <UsageBar value={user.tokenUsage} max={user.tokenLimit || limits.tokenLimit} />
                        </td>
                        <td className="px-4 py-4 text-slate-300">{user.createdAt}</td>
                        <td className="px-4 py-4 text-slate-300">{user.lastLogin}</td>
                        <td className="px-4 py-4">
                          <Badge className={getStatusBadge(user.status)}>{user.status}</Badge>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button className="text-xs font-semibold text-blue-400 hover:text-blue-300" onClick={() => openDetailModal(user)}>View Detail</button>
                            <button className="text-xs font-semibold text-slate-300 hover:text-white" onClick={() => openEditUserModal(user)}>Edit</button>
                            {user.status === "locked" ? (
                              <button className="text-xs font-semibold text-green-400 hover:text-green-300" onClick={() => openConfirm("unlock", user)}>Unlock</button>
                            ) : (
                              <button className="text-xs font-semibold text-yellow-400 hover:text-yellow-300" onClick={() => openConfirm("lock", user, user.role === "Admin")}>Lock</button>
                            )}
                            <button className="text-xs font-semibold text-orange-400 hover:text-orange-300" onClick={() => openConfirm("reset", user)}>Reset Password</button>
                            <button className="text-xs font-semibold text-purple-400 hover:text-purple-300" onClick={() => openChangePlanModal(user)}>Change Plan</button>
                            <button className="text-xs font-semibold text-cyan-400 hover:text-cyan-300" onClick={() => openPermissionsModal(user)}>Permissions</button>
                            <button className="text-xs font-semibold text-red-400 hover:text-red-300" onClick={() => openConfirm("delete", user)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="13" className="px-4 py-12 text-center">
                      <p className="text-lg font-semibold text-white">Không có user phù hợp</p>
                      <p className="mt-2 text-sm text-slate-400">Hãy đổi bộ lọc hoặc reset filter để xem lại danh sách.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow xl:col-span-1">
            <h2 className="text-lg font-bold text-white">Security Alerts</h2>
            <p className="mt-1 text-sm text-slate-400">Các cảnh báo tài khoản cần theo dõi.</p>

            <div className="mt-5 space-y-3">
              {!securityAlerts.length ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
                  Chưa có cảnh báo bảo mật từ backend.
                </div>
              ) : null}
              {securityAlerts.map((alert) => (
                <div key={alert.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{alert.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{alert.user}</p>
                    </div>
                    <Badge className={getStatusBadge(alert.severity)}>{alert.severity}</Badge>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-400">{alert.detail}</p>
                  <p className="mt-2 text-xs text-slate-600">{alert.time}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow xl:col-span-3">
            <h2 className="text-lg font-bold text-white">Activity Logs Table</h2>
            <p className="mt-1 text-sm text-slate-400">Lịch sử thao tác và đăng nhập gần đây.</p>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                <thead className="bg-slate-950 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">IP</th>
                    <th className="px-4 py-3">Device</th>
                    <th className="px-4 py-3">Workspace</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {activityLogs.length ? (
                    activityLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40">
                        <td className="px-4 py-4 text-slate-300">{log.time}</td>
                        <td className="px-4 py-4 font-semibold text-white">{log.user}</td>
                        <td className="px-4 py-4 text-slate-300">{log.action}</td>
                        <td className="px-4 py-4 text-slate-300">{log.ip}</td>
                        <td className="px-4 py-4 text-slate-300">{log.device}</td>
                        <td className="px-4 py-4 text-slate-300">{log.workspace}</td>
                        <td className="px-4 py-4">
                          <Badge className={getStatusBadge(log.status)}>{log.status}</Badge>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-4 py-10 text-center text-sm text-slate-400">
                        Chưa có activity log từ backend.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {activeModal === "userForm" ? (
        <Modal title={formMode === "add" ? "Thêm User Mới" : "Chỉnh sửa User"} size="max-w-4xl">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="fullName" value={userForm.fullName} error={formErrors.fullName} onChange={(event) => setUserForm((prev) => ({ ...prev, fullName: event.target.value }))} />
            <Input label="email" type="email" value={userForm.email} error={formErrors.email} onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))} />
            <Input label="phone" value={userForm.phone} onChange={(event) => setUserForm((prev) => ({ ...prev, phone: event.target.value }))} />
            <Input label="workspace" value={userForm.workspace} onChange={(event) => setUserForm((prev) => ({ ...prev, workspace: event.target.value }))} />
            <Select label="role" value={userForm.role} error={formErrors.role} onChange={(event) => setUserForm((prev) => ({ ...prev, role: event.target.value }))}>
              {BACKEND_ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </Select>
            <Select label="plan" value={userForm.plan} error={formErrors.plan} onChange={(event) => setUserForm((prev) => ({ ...prev, plan: event.target.value }))}>
              {Object.keys(planLimits).map((plan) => (
                <option key={plan} value={plan}>{plan}</option>
              ))}
            </Select>
            <Input
              label="temporaryPassword"
              type="password"
              value={userForm.temporaryPassword}
              error={formErrors.temporaryPassword}
              placeholder={formMode === "edit" ? "Để trống nếu không đổi" : "Bắt buộc khi tạo mới"}
              onChange={(event) => setUserForm((prev) => ({ ...prev, temporaryPassword: event.target.value }))}
            />
            <Select label="status" value={userForm.status} onChange={(event) => setUserForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="active">Active</option>
              <option value="locked">Locked</option>
              <option value="pending">Pending</option>
              <option value="expired">Expired</option>
              <option value="deleted">Deleted</option>
            </Select>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Toggle checked={userForm.enable2FA} onChange={(event) => setUserForm((prev) => ({ ...prev, enable2FA: event.target.checked }))} label="enable2FA" description="Bật xác thực 2 lớp." />
            <Toggle checked={userForm.sendActivationEmail} onChange={(event) => setUserForm((prev) => ({ ...prev, sendActivationEmail: event.target.checked }))} label="sendActivationEmail" description="Gửi email kích hoạt." />
            <Toggle checked={userForm.requirePasswordChange} onChange={(event) => setUserForm((prev) => ({ ...prev, requirePasswordChange: event.target.checked }))} label="requirePasswordChange" description="Bắt buộc đổi mật khẩu." />
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button onClick={() => setActiveModal(null)}>Hủy</Button>
            <Button variant="primary" onClick={formMode === "add" ? handleAddUser : handleEditUser} disabled={isSaving}>
              {isSaving ? "Đang lưu..." : formMode === "add" ? "Tạo user" : "Lưu thay đổi"}
            </Button>
          </div>
        </Modal>
      ) : null}

      {activeModal === "detail" && selectedUser ? (
        <Modal title="User Detail" size="max-w-5xl">
          <div className="flex flex-wrap gap-2">
            {["Profile", "Usage", "Security", "Activity Logs", "Workspaces", "Billing/Plan"].map((tab) => (
              <button
                key={tab}
                onClick={() => setDetailTab(tab)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  detailTab === tab ? "bg-green-600 text-white" : "bg-slate-950 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950 p-5">
            {detailTab === "Profile" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  ["Name", selectedUser.fullName],
                  ["Email", selectedUser.email],
                  ["Phone", selectedUser.phone],
                  ["Role", selectedUser.role],
                  ["Workspace", selectedUser.workspace],
                  ["Created At", selectedUser.createdAt],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs uppercase text-slate-500">{label}</p>
                    <p className="mt-1 font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {detailTab === "Usage" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-semibold text-white">Monthly Usage</p>
                  <UsageBar value={detailRequestUsage || selectedUser.monthlyUsage} max={selectedUser.monthlyUsageLimit || planLimits[selectedUser.plan]?.monthlyUsageLimit} />
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold text-white">Token Usage</p>
                  <UsageBar value={detailTokenUsage || selectedUser.tokenUsage} max={selectedUser.tokenLimit || planLimits[selectedUser.plan]?.tokenLimit} />
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <p className="text-xs text-slate-400">Upload Limit</p>
                  <p className="mt-2 text-lg font-bold text-white">{formatNumber(selectedUser.uploadLimit || planLimits[selectedUser.plan]?.uploadLimit)}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <p className="text-xs text-slate-400">Storage Limit</p>
                  <p className="mt-2 text-lg font-bold text-white">{formatNumber(selectedUser.storageLimit || planLimits[selectedUser.plan]?.storageLimit)} GB</p>
                </div>
              </div>
            ) : null}

            {detailTab === "Security" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Badge className={getStatusBadge(selectedUser.status)}>Status: {selectedUser.status}</Badge>
                <Badge className={selectedUser.enable2FA ? getStatusBadge("active") : getStatusBadge("pending")}>2FA: {selectedUser.enable2FA ? "Enabled" : "Disabled"}</Badge>
                <div>
                  <p className="text-xs uppercase text-slate-500">Last IP</p>
                  <p className="mt-1 font-semibold text-white">{selectedUser.ip}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Device</p>
                  <p className="mt-1 font-semibold text-white">{selectedUser.device}</p>
                </div>
              </div>
            ) : null}

            {detailTab === "Activity Logs" ? (
              <div className="space-y-3">
                {isAuditLoading ? <p className="text-sm text-slate-400">Đang tải audit trail từ backend...</p> : null}
                {selectedUserAudit?.error ? <p className="text-sm text-red-300">{selectedUserAudit.error}</p> : null}
                {!isAuditLoading && !selectedUserAudit?.error && !detailActivityLogs.length ? (
                  <p className="text-sm text-slate-400">Chưa có activity log cho user này.</p>
                ) : null}
                {detailActivityLogs.map((log) => (
                    <div key={log.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-white">{log.action}</p>
                        <Badge className={getStatusBadge(log.status)}>{log.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{log.time} · {log.ip} · {log.device}</p>
                    </div>
                  ))}
              </div>
            ) : null}

            {detailTab === "Workspaces" ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs uppercase text-slate-500">Primary Workspace</p>
                <p className="mt-1 text-lg font-bold text-white">{selectedUser.workspace}</p>
                <p className="mt-2 text-sm text-slate-400">Role trong workspace: {selectedUser.role}</p>
                <p className="mt-2 text-sm text-slate-400">File gần đây từ backend: {formatNumber(detailFiles.length)}</p>
              </div>
            ) : null}

            {detailTab === "Billing/Plan" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-slate-500">Current Plan</p>
                  <Badge className={`mt-2 ${getPlanBadge(selectedUser.plan)}`}>{selectedUser.plan}</Badge>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Plan Expiry</p>
                  <p className="mt-1 font-semibold text-white">{selectedUser.planExpiryDate || "Không giới hạn"}</p>
                </div>
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {activeModal === "changePlan" ? (
        <Modal title={planMode === "bulk" ? "Đổi gói hàng loạt" : "Đổi gói dịch vụ"} size="max-w-4xl">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="currentPlan" value={planForm.currentPlan} readOnly />
            <Select
              label="newPlan"
              value={planForm.newPlan}
              onChange={(event) => {
                const limits = planLimits[event.target.value] || planLimits.Free;
                setPlanForm((prev) => ({
                  ...prev,
                  newPlan: event.target.value,
                  monthlyUsageLimit: limits.monthlyUsageLimit,
                  tokenLimit: limits.tokenLimit,
                  uploadLimit: limits.uploadLimit,
                  storageLimit: limits.storageLimit,
                }));
              }}
            >
              {Object.keys(planLimits).map((plan) => (
                <option key={plan} value={plan}>{plan}</option>
              ))}
            </Select>
            <Input label="startDate" type="date" value={planForm.startDate} onChange={(event) => setPlanForm((prev) => ({ ...prev, startDate: event.target.value }))} />
            <Input label="expiryDate" type="date" value={planForm.expiryDate} onChange={(event) => setPlanForm((prev) => ({ ...prev, expiryDate: event.target.value }))} />
            <Input label="monthlyUsageLimit" type="number" value={planForm.monthlyUsageLimit} onChange={(event) => setPlanForm((prev) => ({ ...prev, monthlyUsageLimit: event.target.value }))} />
            <Input label="tokenLimit" type="number" value={planForm.tokenLimit} onChange={(event) => setPlanForm((prev) => ({ ...prev, tokenLimit: event.target.value }))} />
            <Input label="uploadLimit" type="number" value={planForm.uploadLimit} onChange={(event) => setPlanForm((prev) => ({ ...prev, uploadLimit: event.target.value }))} />
            <Input label="storageLimit (GB)" type="number" value={planForm.storageLimit} onChange={(event) => setPlanForm((prev) => ({ ...prev, storageLimit: event.target.value }))} />
            <Input label="note" className="md:col-span-2" value={planForm.note} onChange={(event) => setPlanForm((prev) => ({ ...prev, note: event.target.value }))} />
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button onClick={() => setActiveModal(null)}>Hủy</Button>
            <Button variant="primary" onClick={handleChangePlan} disabled={isSaving}>{isSaving ? "Đang lưu..." : "Cập nhật gói"}</Button>
          </div>
        </Modal>
      ) : null}

      {activeModal === "permissions" && selectedUser ? (
        <Modal title="Phân quyền user" size="max-w-3xl">
          <div className="mb-5 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="font-semibold text-white">{selectedUser.fullName}</p>
            <p className="mt-1 text-sm text-slate-400">{selectedUser.email} · {selectedUser.role}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {PERMISSIONS.map((permission) => (
              <Toggle
                key={permission}
                checked={Boolean(permissionDraft[permission])}
                onChange={(event) => setPermissionDraft((prev) => ({ ...prev, [permission]: event.target.checked }))}
                label={PERMISSION_LABELS[permission]}
                description={permission}
              />
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button onClick={() => setActiveModal(null)}>Hủy</Button>
            <Button variant="primary" onClick={handleUpdatePermissions} disabled={isSaving}>Lưu phân quyền</Button>
          </div>
        </Modal>
      ) : null}

      {activeModal === "confirm" ? (
        <Modal title={confirmState.title} size="max-w-xl">
          <div className={`rounded-2xl border p-4 ${confirmState.specialAdminLock ? "border-red-500/40 bg-red-500/10" : "border-slate-800 bg-slate-950"}`}>
            <p className={confirmState.specialAdminLock ? "text-red-200" : "text-slate-300"}>{confirmState.message}</p>
            {confirmState.specialAdminLock ? (
              <p className="mt-3 text-sm font-semibold text-red-300">
                Đây là xác nhận đặc biệt cho tài khoản Admin. Hãy chắc chắn còn ít nhất một Admin khác có quyền vận hành.
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button onClick={() => setActiveModal(null)}>Hủy</Button>
            <Button variant={confirmState.action.includes("delete") ? "danger" : "primary"} onClick={confirmAction} disabled={isSaving}>
              {isSaving ? "Đang xử lý..." : "Xác nhận"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
