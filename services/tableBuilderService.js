import { API_BASE, apiFetch, getAccessToken } from "./config.js";

function buildQuery(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") query.set(key, value);
    });
    const text = query.toString();
    return text ? `?${text}` : "";
}

export const tableBuilderService = {
    async getWorkspaceFiles() {
        try {
            return await apiFetch("/api/workspace/files");
        } catch (error) {
            if (!String(error.message || "").includes("404")) throw error;
            const payload = await apiFetch("/api/files");
            return {
                files: payload.files || payload.items || payload || []
            };
        }
    },

    getSheets(fileId) {
        return apiFetch(`/api/workspace/files/${encodeURIComponent(fileId)}/sheets`);
    },

    getPreview(fileId, params = {}) {
        return apiFetch(`/api/workspace/files/${encodeURIComponent(fileId)}/preview${buildQuery(params)}`);
    },

    generateTable(payload) {
        return apiFetch("/api/ai-table-builder/generate", {
            method: "POST",
            body: JSON.stringify(payload)
        });
    },

    getHistory() {
        return apiFetch("/api/ai-table-builder/history");
    },

    getTable(tableId) {
        return apiFetch(`/api/ai-table-builder/${encodeURIComponent(tableId)}`);
    },

    exportTable(tableId, format) {
        return apiFetch(`/api/ai-table-builder/${encodeURIComponent(tableId)}/export`, {
            method: "POST",
            body: JSON.stringify({ format })
        });
    },

    saveToWorkspace(tableId) {
        return apiFetch(`/api/ai-table-builder/${encodeURIComponent(tableId)}/save-to-workspace`, {
            method: "POST"
        });
    },

    downloadUrl(payload) {
        if (payload?.downloadUrl) return `${API_BASE}${payload.downloadUrl}`;
        if (payload?.output?.id) return `${API_BASE}/api/exports/${payload.output.id}/download`;
        return "";
    },

    authHeaders() {
        const token = getAccessToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
    }
};

export default tableBuilderService;
