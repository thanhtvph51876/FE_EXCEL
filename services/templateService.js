/* ==========================================================================
   EXCELAI BOT - SPREADSHEET TEMPLATES SERVICE
   ========================================================================== */

import { API_BASE, apiFetch } from "./config.js";

const cache = {
    templates: []
};

export const templateService = {
    async listTemplates() {
        const payload = await apiFetch("/api/templates");
        cache.templates = Array.isArray(payload.templates) ? payload.templates : [];
        return cache.templates;
    },

    loadTemplates() {
        return cache.templates;
    },

    async useTemplate(templateId) {
        const payload = await apiFetch(`/api/templates/${encodeURIComponent(templateId)}`);
        return {
            template: payload.template,
            sheet: null,
            downloadUrl: `${API_BASE}/api/templates/${encodeURIComponent(templateId)}/download`
        };
    }
};

export default templateService;
