import { API_BASE, apiFetch, getAccessToken } from "./config.js";

function buildQuery(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") query.set(key, value);
    });
    const text = query.toString();
    return text ? `?${text}` : "";
}

export const documentBuilderService = {
    getWorkspaceFiles() {
        return apiFetch("/api/workspace/files");
    },

    getSheets(fileId) {
        return apiFetch(`/api/workspace/files/${encodeURIComponent(fileId)}/sheets`);
    },

    getPreviewContext(fileId, params = {}) {
        return apiFetch(`/api/workspace/files/${encodeURIComponent(fileId)}/preview${buildQuery(params)}`);
    },

    getTemplates() {
        return apiFetch("/api/document/templates");
    },

    generateDocument(payload) {
        return apiFetch("/api/ai-document/generate", {
            method: "POST",
            body: JSON.stringify(payload)
        });
    },

    getHistory() {
        return apiFetch("/api/ai-document/history");
    },

    getDocument(documentId) {
        return apiFetch(`/api/ai-document/${encodeURIComponent(documentId)}`);
    },

    exportDocument(documentId, format) {
        return apiFetch(`/api/ai-document/${encodeURIComponent(documentId)}/export`, {
            method: "POST",
            body: JSON.stringify({ format })
        });
    },

    downloadUrl(pathOrOutput) {
        if (typeof pathOrOutput === "string") {
            return `${API_BASE}${pathOrOutput}`;
        }
        if (pathOrOutput?.downloadUrl) return `${API_BASE}${pathOrOutput.downloadUrl}`;
        if (pathOrOutput?.output?.id) return `${API_BASE}/api/exports/${pathOrOutput.output.id}/download`;
        return "";
    },

    authHeaders() {
        const token = getAccessToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
    }
};

export default documentBuilderService;
