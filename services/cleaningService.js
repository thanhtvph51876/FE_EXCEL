import { API_BASE, apiFetch, getAccessToken } from "./config.js";

function buildQuery(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") query.set(key, value);
    });
    const text = query.toString();
    return text ? `?${text}` : "";
}

export const cleaningService = {
    async getWorkspaceFiles() {
        const payload = await apiFetch("/api/workspace/files");
        return Array.isArray(payload) ? { files: payload } : payload;
    },

    getSheets(fileId) {
        return apiFetch(`/api/workspace/files/${encodeURIComponent(fileId)}/sheets`);
    },

    getColumns(fileId, sheetName = "") {
        return apiFetch(`/api/workspace/files/${encodeURIComponent(fileId)}/columns${buildQuery({ sheetName })}`);
    },

    getPreview(fileId, params = {}) {
        return apiFetch(`/api/workspace/files/${encodeURIComponent(fileId)}/preview${buildQuery(params)}`);
    },

    previewCleaning(payload) {
        return apiFetch("/api/data-cleaning/preview", {
            method: "POST",
            body: JSON.stringify(payload)
        });
    },

    applyCleaning(payload) {
        return apiFetch("/api/data-cleaning/apply", {
            method: "POST",
            body: JSON.stringify(payload)
        });
    },

    getHistory() {
        return apiFetch("/api/data-cleaning/history");
    },

    getJob(jobId) {
        return apiFetch(`/api/data-cleaning/jobs/${encodeURIComponent(jobId)}`);
    },

    downloadUrl(path) {
        return path ? `${API_BASE}${path}` : "";
    },

    authHeaders() {
        const token = getAccessToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
    }
};

export default cleaningService;
