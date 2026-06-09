import { API_BASE, apiFetch } from "./config.js";

export const exportService = {
    async exportDocx(payload) {
        return apiFetch("/api/exports/docx", {
            method: "POST",
            body: JSON.stringify(payload)
        });
    },

    async exportTableXlsx(payload) {
        return apiFetch("/api/exports/table-xlsx", {
            method: "POST",
            body: JSON.stringify(payload)
        });
    },

    async exportPdf(payload) {
        return apiFetch("/api/exports/pdf", {
            method: "POST",
            body: JSON.stringify(payload)
        });
    },

    async exportCleanedXlsx(payload) {
        return apiFetch("/api/exports/cleaned-xlsx", {
            method: "POST",
            body: JSON.stringify(payload)
        });
    },

    async exportReconciliationXlsx(payload) {
        return apiFetch("/api/exports/reconciliation-xlsx", {
            method: "POST",
            body: JSON.stringify(payload)
        });
    },

    downloadUrl(outputId) {
        return `${API_BASE}/api/exports/${encodeURIComponent(outputId)}/download`;
    }
};

export default exportService;
