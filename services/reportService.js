/* ==========================================================================
   EXCELAI BOT - REAL AUTO REPORT API SERVICE
   ========================================================================== */

import { apiFetch } from "./config.js";

function buildQuery(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            query.set(key, value);
        }
    });
    const text = query.toString();
    return text ? `?${text}` : "";
}

export const reportService = {
    getWorkspaceFiles() {
        return apiFetch("/api/workspace/files");
    },

    getSheets(fileId) {
        return apiFetch(`/api/workspace/files/${encodeURIComponent(fileId)}/sheets`);
    },

    getPreview(fileId, params = {}) {
        return apiFetch(`/api/workspace/files/${encodeURIComponent(fileId)}/preview${buildQuery(params)}`);
    },

    getAutoReport(params = {}) {
        return apiFetch(`/api/reports/auto${buildQuery(params)}`);
    },

    createAutoReport(fileId, sheetName) {
        return apiFetch("/api/reports/auto", {
            method: "POST",
            body: JSON.stringify({ fileId, sheetName })
        });
    },

    getHistory() {
        return apiFetch("/api/reports/history");
    }
};

export default reportService;
