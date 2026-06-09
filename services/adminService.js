/* ==========================================================================
   EXCELAI BOT - SYSTEM MANAGEMENT AND ADMIN SERVICE
   ========================================================================== */

import { API_BASE, apiFetch } from "./config.js";

const defaultPromptConfig = {
    systemPrompt: "Bạn là trợ lý ExcelAI Bot chuyên nghiệp của hệ thống ExcelAI. Nhiệm vụ của bạn là giải đáp thắc mắc của người dùng về Excel, Google Sheets, VBA một cách ngắn gọn, súc tích và có ví dụ đi kèm rõ ràng.",
    freeLimit: 20,
    formulaPrompt: "Hãy tạo công thức Excel tối ưu nhất cho yêu cầu này.",
    vbaPrompt: "Hãy tạo mã Macro VBA Excel chuẩn hóa, có chú thích chi tiết bằng tiếng Việt.",
    analysisPrompt: "Hãy đóng vai trò là chuyên gia phân tích dữ liệu.",
    checkerPrompt: "Hãy đóng vai trò chuyên gia kiểm toán dữ liệu.",
    cleanerPrompt: "Chỉ dẫn AI làm sạch dữ liệu.",
    reconciliationPrompt: "Chỉ dẫn AI đối soát 2 bảng dữ liệu A và B.",
    reportPrompt: "Chỉ dẫn AI xây dựng báo cáo."
};

const defaultSecuritySettings = {
    fileSizeLimit: 10,
    allowedTypes: ".csv, .xlsx, .xls",
    blockedTypes: ".exe, .bat, .cmd, .js, .vbs, .scr, .dll",
    maxExcelRows: 100000,
    maxExcelSheets: 20,
    scanMalware: true,
    blockVbaMacro: true,
    allowXlsm: false,
    dataRetention: 30,
    enableMacroWarning: true,
    rateLimit: 100,
    uploadPerHourLimit: 30,
    failedLoginLimit: 5,
    accountLockMinutes: 15,
    sensitiveDataWarning: true,
    piiTypes: ["national_id", "phone", "email", "address", "tax_code", "bank_account"],
    sensitiveDataAction: "mask",
    enableIpWhitelist: false,
    enableIpBlacklist: true,
    whitelistIps: "",
    blacklistIps: "45.xxx.xxx.xxx\n113.xxx.xxx.xxx",
    enableOtp2fa: true,
    adminAccessControl: "IP Whitelist (Disabled)",
    maintenanceMode: false,
    appName: "ExcelAI Workspace",
    logoUrl: "",
    supportEmail: "support@excelai.com",
    supportHotline: "1900 9090",
    supportWebsite: "https://excelai.local/support",
    timezone: "Asia/Saigon",
    defaultLanguage: "vi",
    appVersion: "v1.2.0",
    environment: "Development",
    lastUpdate: "10/06/2026 10:30",
    maintenanceTitle: "Hệ thống đang bảo trì",
    maintenanceMessage: "Người dùng thường sẽ bị tạm khóa truy cập cho đến khi chế độ bảo trì kết thúc.",
    maintenanceStart: "",
    maintenanceEnd: "",
    maintenanceAllowAdmin: true,
    maintenanceAllowWhitelist: true,
    maintenanceAutoStart: false,
    maintenanceAutoEnd: true
};

const defaultFeatureFlags = {
    enable_autopilot: true,
    enable_table_builder: true,
    enable_document_builder: true,
    enable_data_checker: true,
    enable_reconciliation: true,
    enable_excel_import: true,
    enable_export_report: true,
    enable_pii_scanner: true,
    enable_new_dashboard: false,
    enable_ai_suggestion: true,
    flags: [],
    rolePermissions: {},
    changeLogs: []
};

const defaultPricingConfig = {
    monthly: { pro: "149,000đ", business: "299,000đ", enterprise: "399,000đ", period: "/tháng" },
    annual: { pro: "119,000đ", business: "239,000đ", enterprise: "319,000đ", period: "/tháng (trả năm)" }
};

const defaultWorkspaceSettings = {
    workspaceName: "ExcelAI Workspace",
    retention: "30"
};

const cache = {
    apiKeys: [],
    promptConfig: { ...defaultPromptConfig },
    systemLogs: [],
    jobs: [],
    feedbacks: [],
    coupons: [],
    workspaces: [],
    broadcasts: [],
    checkoutRequests: [],
    billingDashboard: null,
    pricingConfig: { ...defaultPricingConfig },
    securitySettings: { ...defaultSecuritySettings },
    featureFlags: { ...defaultFeatureFlags },
    workspaceSettings: { ...defaultWorkspaceSettings },
    templates: []
};

async function safeRequest(task, fallback = null) {
    try {
        return await task();
    } catch (error) {
        console.warn(error.message || error);
        return fallback;
    }
}

function normalizeLog(log) {
    const date = log.timestamp ? new Date(log.timestamp) : new Date();
    return {
        time: log.time || date.toTimeString().split(" ")[0],
        timestamp: log.timestamp || date.toISOString(),
        type: log.type || "info",
        text: log.text || log.message || "Hoạt động hệ thống",
        message: log.message || log.text || "Hoạt động hệ thống",
        userId: log.userId || null
    };
}

export const adminService = {
    async getMetrics() {
        return apiFetch("/api/admin/metrics");
    },

    async getUsers(page = 1, pageSize = 100, query = "") {
        const suffix = query ? `&q=${encodeURIComponent(query)}` : "";
        return apiFetch(`/api/admin/users?page=${page}&pageSize=${pageSize}${suffix}`);
    },

    async createUser(profile = {}) {
        return apiFetch("/api/admin/users", {
            method: "POST",
            body: JSON.stringify({
                name: profile.name,
                email: profile.email,
                password: profile.password,
                tier: profile.tier || "free",
                status: profile.status || "active",
                reason: profile.reason || "admin_create_user"
            })
        });
    },

    async updateUserProfile(id, profile = {}) {
        return apiFetch(`/api/admin/users/${id}`, {
            method: "PUT",
            body: JSON.stringify({
                name: profile.name,
                email: profile.email,
                reason: profile.reason || "admin_user_edit"
            })
        });
    },

    async updateUserTier(id, tier, reason = "admin_user_edit") {
        return apiFetch(`/api/admin/billing/users/${id}/tier`, {
            method: "PUT",
            body: JSON.stringify({ tier, reason })
        });
    },

    async grantUserTier(id, tier, reason = "admin_manual_grant") {
        return this.updateUserTier(id, tier, reason);
    },

    async updateUserStatus(id, status) {
        return apiFetch(`/api/admin/users/${id}/status`, {
            method: "PUT",
            body: JSON.stringify({ status })
        });
    },

    async resetUserPassword(id, password, reason = "admin_password_reset") {
        return apiFetch(`/api/admin/users/${encodeURIComponent(id)}/password`, {
            method: "PUT",
            body: JSON.stringify({ password, reason })
        });
    },

    async deleteUser(id) {
        return apiFetch(`/api/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" });
    },

    async getUserAudit(id) {
        return apiFetch(`/api/admin/users/${encodeURIComponent(id)}/audit`);
    },

    async getWorkspaces() {
        const payload = await apiFetch("/api/admin/workspaces");
        cache.workspaces = Array.isArray(payload?.workspaces) ? payload.workspaces : [];
        return payload;
    },

    async getWorkspaceSettings(userId) {
        return apiFetch(`/api/admin/workspaces/${encodeURIComponent(userId)}/settings`);
    },

    async updateWorkspaceSettings(userId, settings = {}) {
        const payload = await apiFetch(`/api/admin/workspaces/${encodeURIComponent(userId)}/settings`, {
            method: "PUT",
            body: JSON.stringify(settings)
        });
        if (payload?.workspace) {
            const index = cache.workspaces.findIndex(item => String(item.userId) === String(userId));
            if (index >= 0) cache.workspaces[index] = payload.workspace;
        }
        return payload?.workspace || null;
    },

    async getEntitlements() {
        return apiFetch("/api/admin/billing/entitlements");
    },

    async getCheckoutRequests(statusFilter = "") {
        const suffix = statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : "";
        const payload = await apiFetch(`/api/admin/billing/checkout-requests${suffix}`);
        cache.checkoutRequests = Array.isArray(payload?.checkoutRequests) ? payload.checkoutRequests : [];
        return payload;
    },

    async getBillingDashboard() {
        const payload = await apiFetch("/api/admin/dashboards/billing");
        cache.billingDashboard = payload || null;
        return payload;
    },

    async getBillingAdvancedDashboard() {
        return apiFetch("/api/admin/dashboards/billing-advanced");
    },

    async createPricingPlan(plan = {}) {
        return apiFetch("/api/admin/billing/plans", {
            method: "POST",
            body: JSON.stringify(plan)
        });
    },

    async updatePricingPlan(planCode, plan = {}) {
        return apiFetch(`/api/admin/billing/plans/${encodeURIComponent(planCode)}`, {
            method: "PUT",
            body: JSON.stringify(plan)
        });
    },

    async deletePricingPlan(planCode, force = false) {
        const suffix = force ? "?force=true" : "";
        return apiFetch(`/api/admin/billing/plans/${encodeURIComponent(planCode)}${suffix}`, { method: "DELETE" });
    },

    async getBillingCoupons() {
        return apiFetch("/api/admin/billing/coupons");
    },

    async createBillingCoupon(coupon = {}) {
        return apiFetch("/api/admin/billing/coupons", {
            method: "POST",
            body: JSON.stringify(coupon)
        });
    },

    async updateBillingCoupon(code, coupon = {}) {
        return apiFetch(`/api/admin/billing/coupons/${encodeURIComponent(code)}`, {
            method: "PUT",
            body: JSON.stringify(coupon)
        });
    },

    async deleteBillingCoupon(code) {
        return apiFetch(`/api/admin/billing/coupons/${encodeURIComponent(code)}`, { method: "DELETE" });
    },

    async manualUpgradeUser(payload = {}) {
        return apiFetch("/api/admin/billing/manual-upgrade", {
            method: "POST",
            body: JSON.stringify(payload)
        });
    },

    async requestCheckoutMoreInfo(id, adminNote = "") {
        return apiFetch(`/api/admin/billing/checkout-requests/${encodeURIComponent(id)}/more-info`, {
            method: "PUT",
            body: JSON.stringify({ adminNote })
        });
    },

    async deleteCheckoutRequest(id) {
        return apiFetch(`/api/admin/billing/checkout-requests/${encodeURIComponent(id)}`, { method: "DELETE" });
    },

    async changeSubscriptionPlan(id, targetPlan) {
        return apiFetch(`/api/admin/billing/subscriptions/${encodeURIComponent(id)}/plan`, {
            method: "PUT",
            body: JSON.stringify({ targetPlan })
        });
    },

    async cancelSubscription(id, reason = "admin_cancel_subscription") {
        return apiFetch(`/api/admin/billing/subscriptions/${encodeURIComponent(id)}/cancel`, {
            method: "PUT",
            body: JSON.stringify({ reason })
        });
    },

    async saveBillingSettings(settings = {}) {
        return apiFetch("/api/admin/billing/settings", {
            method: "PUT",
            body: JSON.stringify(settings)
        });
    },

    async getPromptDashboard() {
        return apiFetch("/api/admin/ai-prompts/dashboard");
    },

    async createPrompt(prompt = {}) {
        return apiFetch("/api/admin/ai-prompts/items", {
            method: "POST",
            body: JSON.stringify(prompt)
        });
    },

    async updatePrompt(promptKey, prompt = {}) {
        return apiFetch(`/api/admin/ai-prompts/items/${encodeURIComponent(promptKey)}`, {
            method: "PUT",
            body: JSON.stringify(prompt)
        });
    },

    async deletePrompt(promptKey) {
        return apiFetch(`/api/admin/ai-prompts/items/${encodeURIComponent(promptKey)}`, { method: "DELETE" });
    },

    async duplicatePrompt(promptKey) {
        return apiFetch(`/api/admin/ai-prompts/items/${encodeURIComponent(promptKey)}/duplicate`, { method: "POST" });
    },

    async testPrompt(playground = {}) {
        return apiFetch("/api/admin/ai-prompts/test", {
            method: "POST",
            body: JSON.stringify(playground)
        });
    },

    async rollbackPromptVersion(versionId) {
        return apiFetch(`/api/admin/ai-prompts/versions/${encodeURIComponent(versionId)}/rollback`, { method: "POST" });
    },

    async setActivePromptVersion(versionId) {
        return apiFetch(`/api/admin/ai-prompts/versions/${encodeURIComponent(versionId)}/active`, { method: "PUT" });
    },

    async savePromptRoutingSettings(settings = {}) {
        return apiFetch("/api/admin/ai-prompts/routing-settings", {
            method: "PUT",
            body: JSON.stringify(settings)
        });
    },

    async togglePromptSafetyRule(ruleKey, rule = {}) {
        return apiFetch(`/api/admin/ai-prompts/safety-rules/${encodeURIComponent(ruleKey)}`, {
            method: "PUT",
            body: JSON.stringify(rule)
        });
    },

    async updatePromptABTest(action, payload = {}) {
        return apiFetch(`/api/admin/ai-prompts/ab-tests/${encodeURIComponent(action)}`, {
            method: "POST",
            body: JSON.stringify(payload)
        });
    },

    async getAiCostDashboard(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters || {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null && String(value).trim() !== "" && String(value) !== "all") {
                params.set(key, value);
            }
        });
        const suffix = params.toString() ? `?${params.toString()}` : "";
        return apiFetch(`/api/admin/dashboards/ai-cost${suffix}`);
    },

    async getAiQuotaConfig() {
        return apiFetch("/api/admin/dashboards/ai-cost/quota-config");
    },

    async saveAiQuotaConfig(config = {}) {
        return apiFetch("/api/admin/dashboards/ai-cost/quota-config", {
            method: "PUT",
            body: JSON.stringify(config)
        });
    },

    async blockAiSystem(reason = "admin_block_ai_system") {
        return apiFetch("/api/admin/dashboards/ai-cost/system-block", {
            method: "POST",
            body: JSON.stringify({ reason })
        });
    },

    async unblockAiSystem() {
        return apiFetch("/api/admin/dashboards/ai-cost/system-block", { method: "DELETE" });
    },

    async clearAiCache() {
        return apiFetch("/api/admin/dashboards/ai-cost/cache/clear", { method: "POST" });
    },

    async checkAiProvider() {
        return apiFetch("/api/health/ai");
    },

    async getFileProcessingDashboard() {
        return apiFetch("/api/admin/dashboards/files");
    },

    async getSecurityAuditDashboard() {
        return apiFetch("/api/admin/dashboards/security");
    },

    async getSystemReportDashboard(filters = {}) {
        const params = new URLSearchParams();
        if (filters.timeRange) params.set("timeRange", filters.timeRange);
        if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
        if (filters.dateTo) params.set("dateTo", filters.dateTo);
        const suffix = params.toString() ? `?${params.toString()}` : "";
        return apiFetch(`/api/admin/dashboards/system-report${suffix}`);
    },

    async confirmCheckoutRequest(id, adminNote = "") {
        const payload = await apiFetch(`/api/admin/billing/checkout-requests/${encodeURIComponent(id)}/confirm`, {
            method: "PUT",
            body: JSON.stringify({ adminNote })
        });
        if (payload?.checkoutRequest) {
            const index = cache.checkoutRequests.findIndex(item => String(item.id) === String(id));
            if (index >= 0) cache.checkoutRequests[index] = payload.checkoutRequest;
        }
        return payload;
    },

    async rejectCheckoutRequest(id, adminNote = "") {
        const payload = await apiFetch(`/api/admin/billing/checkout-requests/${encodeURIComponent(id)}/reject`, {
            method: "PUT",
            body: JSON.stringify({ adminNote })
        });
        if (payload?.checkoutRequest) {
            const index = cache.checkoutRequests.findIndex(item => String(item.id) === String(id));
            if (index >= 0) cache.checkoutRequests[index] = payload.checkoutRequest;
        }
        return payload;
    },

    async refreshAdminCaches() {
        const [
            promptConfig,
            logs,
            apiKeys,
            coupons,
            jobs,
            feedbacks,
            securitySettings,
            pricingConfig,
            featureFlags,
            templates,
            workspaces,
            broadcasts,
            checkoutRequests,
            billingDashboard
        ] = await Promise.all([
            safeRequest(() => apiFetch("/api/admin/prompt-config")),
            safeRequest(() => apiFetch("/api/admin/logs")),
            safeRequest(() => apiFetch("/api/admin/api-keys")),
            safeRequest(() => apiFetch("/api/admin/coupons")),
            safeRequest(() => apiFetch("/api/admin/jobs")),
            safeRequest(() => apiFetch("/api/admin/feedbacks")),
            safeRequest(() => apiFetch("/api/admin/security-settings")),
            safeRequest(() => apiFetch("/api/admin/pricing-config")),
            safeRequest(() => apiFetch("/api/admin/feature-flags")),
            safeRequest(() => apiFetch("/api/admin/templates")),
            safeRequest(() => apiFetch("/api/admin/workspaces")),
            safeRequest(() => apiFetch("/api/admin/broadcasts")),
            safeRequest(() => this.getCheckoutRequests()),
            safeRequest(() => this.getBillingDashboard())
        ]);

        if (promptConfig) cache.promptConfig = { ...defaultPromptConfig, ...promptConfig };
        if (logs?.logs) cache.systemLogs = logs.logs.map(normalizeLog);
        if (apiKeys?.apiKeys) cache.apiKeys = apiKeys.apiKeys;
        if (coupons?.coupons) cache.coupons = coupons.coupons;
        if (jobs?.jobs) cache.jobs = jobs.jobs;
        if (feedbacks?.feedbacks) cache.feedbacks = feedbacks.feedbacks;
        if (securitySettings) cache.securitySettings = { ...defaultSecuritySettings, ...securitySettings };
        if (pricingConfig) cache.pricingConfig = {
            monthly: { ...defaultPricingConfig.monthly, ...(pricingConfig.monthly || {}) },
            annual: { ...defaultPricingConfig.annual, ...(pricingConfig.annual || {}) }
        };
        if (featureFlags) cache.featureFlags = { ...defaultFeatureFlags, ...featureFlags };
        if (templates?.templates) cache.templates = templates.templates;
        if (workspaces?.workspaces) cache.workspaces = workspaces.workspaces;
        if (broadcasts?.broadcasts) cache.broadcasts = broadcasts.broadcasts;
        if (checkoutRequests?.checkoutRequests) cache.checkoutRequests = checkoutRequests.checkoutRequests;
        if (billingDashboard) cache.billingDashboard = billingDashboard;

        return this.getCacheSnapshot();
    },

    async refreshUserSettings() {
        const [featureFlags, workspaceSettings] = await Promise.all([
            safeRequest(() => apiFetch("/api/settings/feature-flags")),
            safeRequest(() => apiFetch("/api/settings/workspace"))
        ]);
        if (featureFlags) cache.featureFlags = { ...defaultFeatureFlags, ...featureFlags };
        if (workspaceSettings) cache.workspaceSettings = { ...defaultWorkspaceSettings, ...workspaceSettings };
        return {
            featureFlags: cache.featureFlags,
            workspaceSettings: cache.workspaceSettings
        };
    },

    getCacheSnapshot() {
        return {
            apiKeys: cache.apiKeys,
            promptConfig: cache.promptConfig,
            systemLogs: cache.systemLogs,
            jobs: cache.jobs,
            feedbacks: cache.feedbacks,
            workspaces: cache.workspaces,
            broadcasts: cache.broadcasts,
            securitySettings: cache.securitySettings,
            pricingConfig: cache.pricingConfig,
            featureFlags: cache.featureFlags,
            workspaceSettings: cache.workspaceSettings,
            templates: cache.templates,
            coupons: cache.coupons || [],
            checkoutRequests: cache.checkoutRequests || [],
            billingDashboard: cache.billingDashboard
        };
    },

    async getSystemPrompt() {
        return apiFetch("/api/admin/system-prompt");
    },

    async updateSystemPrompt(prompt) {
        return apiFetch("/api/admin/system-prompt", {
            method: "PUT",
            body: JSON.stringify({ prompt })
        });
    },

    async getLogs() {
        return apiFetch("/api/admin/logs");
    },

    loadAPIKeys() {
        return cache.apiKeys;
    },

    saveAPIKeys(keys) {
        cache.apiKeys = Array.isArray(keys) ? keys : [];
        return Promise.resolve({ success: true, apiKeys: cache.apiKeys });
    },

    async createAPIKey(label) {
        const payload = await apiFetch("/api/admin/api-keys", {
            method: "POST",
            body: JSON.stringify({ label })
        });
        if (payload?.apiKey) cache.apiKeys.unshift(payload.apiKey);
        return payload?.apiKey;
    },

    async updateAPIKeyStatus(id, status) {
        const payload = await apiFetch(`/api/admin/api-keys/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify({ status })
        });
        const updated = payload?.apiKey;
        if (updated) {
            const index = cache.apiKeys.findIndex(key => String(key.id) === String(id));
            if (index >= 0) cache.apiKeys[index] = updated;
        }
        return updated;
    },

    async deleteAPIKey(id) {
        await apiFetch(`/api/admin/api-keys/${encodeURIComponent(id)}`, { method: "DELETE" });
        cache.apiKeys = cache.apiKeys.filter(key => String(key.id) !== String(id));
        return { success: true };
    },

    loadPromptConfig() {
        return cache.promptConfig;
    },

    async savePromptConfig(config) {
        cache.promptConfig = { ...defaultPromptConfig, ...(config || {}) };
        return apiFetch("/api/admin/prompt-config", {
            method: "PUT",
            body: JSON.stringify(cache.promptConfig)
        });
    },

    loadSystemLogs() {
        return cache.systemLogs;
    },

    saveSystemLogs(logs) {
        cache.systemLogs = Array.isArray(logs) ? logs : [];
        if (cache.systemLogs.length === 0) {
            return safeRequest(() => apiFetch("/api/admin/logs", { method: "DELETE" }), { success: true });
        }
        return Promise.resolve({ success: true });
    },

    async clearSystemLogs() {
        await apiFetch("/api/admin/logs", { method: "DELETE" });
        cache.systemLogs = [];
        return { success: true };
    },

    addSystemLog(type, text) {
        const timeNow = new Date().toTimeString().split(" ")[0];
        const log = { time: timeNow, type, text };
        cache.systemLogs.push(log);
        if (cache.systemLogs.length > 100) cache.systemLogs.shift();
        safeRequest(() => apiFetch("/api/admin/logs", {
            method: "POST",
            body: JSON.stringify({ type, action: text })
        }));
        return cache.systemLogs;
    },

    getSystemDashboardMetrics(users, backendMetrics = null) {
        const totalUsers = users.length;
        const activeUsersCount = users.filter(u => (u.status || "active") === "active").length;
        const totalRequests = users.reduce((sum, user) => sum + (user.usageCount || 0), 0);
        const failedJobs = cache.jobs.filter(j => ["failed", "error", "Lỗi"].includes(j.status)).length;
        const errorRate = ((failedJobs / Math.max(1, cache.jobs.length)) * 100).toFixed(2) + "%";

        return {
            totalUsers: backendMetrics?.totalUsers ?? totalUsers,
            activeUsers: backendMetrics?.activeUsers ?? activeUsersCount,
            totalRequests: backendMetrics?.apiRequestsCount ?? totalRequests,
            filesProcessed: backendMetrics?.filesProcessed ?? 0,
            uptime: backendMetrics?.uptime ?? "N/A",
            errorRate: backendMetrics?.errorRate ?? errorRate,
            mrr: backendMetrics?.mrr ?? 0
        };
    },

    loadJobs() {
        return cache.jobs;
    },

    loadWorkspaces() {
        return cache.workspaces;
    },

    loadBroadcasts() {
        return cache.broadcasts;
    },

    loadCheckoutRequests() {
        return cache.checkoutRequests;
    },

    loadBillingDashboard() {
        return cache.billingDashboard;
    },

    saveJobs(jobs) {
        cache.jobs = Array.isArray(jobs) ? jobs : [];
        return Promise.resolve({ success: true });
    },

    addJob(fileName, owner, size, type, status, duration = "0.5s", error = "") {
        const newJob = {
            id: "job_" + Date.now(),
            fileName,
            owner,
            size,
            type,
            status,
            duration,
            error
        };
        cache.jobs.unshift(newJob);
        if (cache.jobs.length > 100) cache.jobs.pop();
        safeRequest(async () => {
            const payload = await apiFetch("/api/admin/jobs", {
                method: "POST",
                body: JSON.stringify(newJob)
            });
            if (payload?.job) {
                const index = cache.jobs.findIndex(job => job.id === newJob.id);
                if (index >= 0) cache.jobs[index] = payload.job;
            }
        });
        return newJob;
    },

    loadFeedbacks() {
        return cache.feedbacks;
    },

    saveFeedbacks(feedbacks) {
        cache.feedbacks = Array.isArray(feedbacks) ? feedbacks : [];
        return Promise.resolve({ success: true });
    },

    addFeedback(userName, type, text) {
        const newFeedback = {
            id: Date.now(),
            userName,
            type,
            text,
            status: "new",
            reply: ""
        };
        cache.feedbacks.unshift(newFeedback);
        return newFeedback;
    },

    async replyFeedback(id, replyText) {
        const payload = await apiFetch(`/api/admin/feedbacks/${encodeURIComponent(id)}/reply`, {
            method: "PUT",
            body: JSON.stringify({ reply: replyText })
        });
        const updated = payload?.feedback;
        if (updated) {
            const index = cache.feedbacks.findIndex(item => String(item.id) === String(id));
            if (index >= 0) cache.feedbacks[index] = updated;
        }
        return updated || null;
    },

    async updateFeedbackStatus(id, status) {
        const payload = await apiFetch(`/api/admin/feedbacks/${encodeURIComponent(id)}/status`, {
            method: "PUT",
            body: JSON.stringify({ status })
        });
        const updated = payload?.feedback;
        if (updated) {
            const index = cache.feedbacks.findIndex(item => String(item.id) === String(id));
            if (index >= 0) cache.feedbacks[index] = updated;
        }
        return updated || null;
    },

    loadTemplates() {
        return cache.templates;
    },

    async getTemplateDashboard() {
        const payload = await apiFetch("/api/admin/templates-advanced");
        cache.templates = Array.isArray(payload?.templates) ? payload.templates : cache.templates;
        return payload;
    },

    async uploadTemplateFile(file, templateId = "") {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("templateId", templateId || "");
        return apiFetch("/api/admin/templates-advanced/upload", {
            method: "POST",
            body: formData
        });
    },

    async createTemplateAdvanced(template = {}) {
        const payload = await apiFetch("/api/admin/templates-advanced", {
            method: "POST",
            body: JSON.stringify(template)
        });
        if (payload?.template) cache.templates.unshift(payload.template);
        return payload?.template || null;
    },

    async updateTemplateAdvanced(id, template = {}) {
        const payload = await apiFetch(`/api/admin/templates-advanced/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify(template)
        });
        const updated = payload?.template;
        if (updated) {
            const index = cache.templates.findIndex(item => String(item.id) === String(id));
            if (index >= 0) cache.templates[index] = updated;
        }
        return updated || null;
    },

    async deleteTemplateAdvanced(id, force = false) {
        const suffix = force ? "?force=true" : "";
        await apiFetch(`/api/admin/templates-advanced/${encodeURIComponent(id)}${suffix}`, { method: "DELETE" });
        cache.templates = cache.templates.filter(item => String(item.id) !== String(id));
        return { success: true };
    },

    async previewTemplate(id) {
        return apiFetch(`/api/admin/templates-advanced/${encodeURIComponent(id)}/preview`);
    },

    async validateTemplate(id) {
        return apiFetch(`/api/admin/templates-advanced/${encodeURIComponent(id)}/validate`, { method: "POST" });
    },

    async updateTemplateVersion(id, payload = {}) {
        return apiFetch(`/api/admin/templates-advanced/${encodeURIComponent(id)}/versions`, {
            method: "POST",
            body: JSON.stringify(payload)
        });
    },

    async rollbackTemplateVersion(id, versionIndex = 0) {
        return apiFetch(`/api/admin/templates-advanced/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionIndex)}/rollback`, { method: "POST" });
    },

    async updateTemplatePermissions(id, payload = {}) {
        return apiFetch(`/api/admin/templates-advanced/${encodeURIComponent(id)}/permissions`, {
            method: "PUT",
            body: JSON.stringify(payload)
        });
    },

    async bulkTemplateAction(action, ids = [], value = "") {
        return apiFetch("/api/admin/templates-advanced/bulk", {
            method: "POST",
            body: JSON.stringify({ action, ids, value })
        });
    },

    getTemplateDownloadUrl(id) {
        return `${API_BASE}/api/templates/${encodeURIComponent(id)}/download`;
    },

    async createTemplate(template = {}) {
        const payload = await apiFetch("/api/admin/templates", {
            method: "POST",
            body: JSON.stringify(template)
        });
        if (payload?.template) cache.templates.unshift(payload.template);
        return payload?.template || null;
    },

    async updateTemplate(id, template = {}) {
        const payload = await apiFetch(`/api/admin/templates/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify(template)
        });
        const updated = payload?.template;
        if (updated) {
            const index = cache.templates.findIndex(item => String(item.id) === String(id));
            if (index >= 0) cache.templates[index] = updated;
        }
        return updated || null;
    },

    async deleteTemplate(id) {
        await apiFetch(`/api/admin/templates/${encodeURIComponent(id)}`, { method: "DELETE" });
        cache.templates = cache.templates.filter(item => String(item.id) !== String(id));
        return { success: true };
    },

    loadSecuritySettings() {
        return cache.securitySettings;
    },

    async saveSecuritySettings(settings) {
        cache.securitySettings = { ...defaultSecuritySettings, ...(settings || {}) };
        return apiFetch("/api/admin/security-settings", {
            method: "PUT",
            body: JSON.stringify(cache.securitySettings)
        });
    },

    loadPricingConfig() {
        return cache.pricingConfig;
    },

    async savePricingConfig(pricing) {
        cache.pricingConfig = {
            monthly: { ...defaultPricingConfig.monthly, ...(pricing?.monthly || {}) },
            annual: { ...defaultPricingConfig.annual, ...(pricing?.annual || {}) }
        };
        const payload = await apiFetch("/api/admin/pricing-config", {
            method: "PUT",
            body: JSON.stringify(cache.pricingConfig)
        });
        if (payload?.pricing) cache.pricingConfig = payload.pricing;
        return cache.pricingConfig;
    },

    async sendBroadcast(message, options = {}) {
        const payload = await apiFetch("/api/admin/broadcasts", {
            method: "POST",
            body: JSON.stringify({
                message,
                severity: options.severity || "warning",
                forceLogout: options.forceLogout !== false,
                countdownSeconds: options.countdownSeconds || 60,
                expiresInMinutes: options.expiresInMinutes || 30
            })
        });
        if (payload?.broadcast) cache.broadcasts.unshift(payload.broadcast);
        return payload?.broadcast;
    },

    async deactivateBroadcast(id) {
        await apiFetch(`/api/admin/broadcasts/${encodeURIComponent(id)}`, { method: "DELETE" });
        const broadcast = cache.broadcasts.find(item => String(item.id) === String(id));
        if (broadcast) broadcast.active = false;
        return { success: true };
    },

    async getActiveBroadcast() {
        return apiFetch("/api/system/broadcasts/active");
    },

    loadFeatureFlags() {
        return cache.featureFlags;
    },

    async saveFeatureFlags(flags) {
        cache.featureFlags = { ...defaultFeatureFlags, ...(flags || {}) };
        return apiFetch("/api/admin/feature-flags", {
            method: "PUT",
            body: JSON.stringify(cache.featureFlags)
        });
    },

    loadWorkspaceSettings() {
        return cache.workspaceSettings;
    },

    async saveWorkspaceSettings(settings) {
        cache.workspaceSettings = { ...defaultWorkspaceSettings, ...(settings || {}) };
        return apiFetch("/api/settings/workspace", {
            method: "PUT",
            body: JSON.stringify(cache.workspaceSettings)
        });
    }
};

export default adminService;
