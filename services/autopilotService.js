import { API_BASE, apiFetch } from "./config.js";

function normalizePlan(response) {
    const plan = response?.plan || response || {};
    return {
        ...plan,
        understanding: plan.expectedOutput?.description || "Đã đọc file thật và lập kế hoạch xử lý.",
        steps: Array.isArray(plan.steps) ? plan.steps : [],
        requiredInputs: plan.fileName ? [plan.fileName] : [],
        expectedOutputs: [plan.expectedOutput?.description || "File Excel kết quả"],
        fileProfile: plan.fileProfile || {}
    };
}

function normalizeDraft(response) {
    return response?.draft || response || null;
}

export const autopilotService = {
    async createPlan(goal, fileId) {
        const response = await apiFetch("/api/autopilot/plan", {
            method: "POST",
            body: JSON.stringify({ goal, fileId })
        });
        return normalizePlan(response);
    },

    async updatePlan(planId, payload = {}) {
        const response = await apiFetch(`/api/autopilot/plan/${encodeURIComponent(planId)}`, {
            method: "PATCH",
            body: JSON.stringify(payload)
        });
        return normalizePlan(response);
    },

    async createDraft(planId) {
        const response = await apiFetch("/api/autopilot/draft", {
            method: "POST",
            body: JSON.stringify({ planId })
        });
        return normalizeDraft(response);
    },

    async history() {
        const response = await apiFetch("/api/autopilot/history");
        return response?.items || [];
    },

    async historyDetail(planId) {
        return apiFetch(`/api/autopilot/history/${encodeURIComponent(planId)}`);
    },

    outputDownloadUrl(outputId) {
        return `${API_BASE}/api/autopilot/output/${encodeURIComponent(outputId)}/download`;
    },

    async generatePlan(goal, outputs = [], files = []) {
        const fileId = files.find(Boolean);
        if (!fileId) throw new Error("Vui lòng chọn file dữ liệu thật trước khi lập kế hoạch.");
        return this.createPlan(goal, fileId);
    }
};

export default autopilotService;
