import { apiFetch } from "./config.js";

export const jobService = {
    async createJob(type, payload = {}, options = {}) {
        return apiFetch("/api/jobs", {
            method: "POST",
            body: JSON.stringify({
                type,
                payload,
                workspaceId: options.workspaceId || null,
                fileId: options.fileId || null,
                idempotencyKey: options.idempotencyKey || ""
            })
        });
    },

    async listJobs() {
        return apiFetch("/api/jobs");
    },

    async getJob(jobId) {
        return apiFetch(`/api/jobs/${encodeURIComponent(jobId)}`);
    },

    async cancelJob(jobId) {
        return apiFetch(`/api/jobs/${encodeURIComponent(jobId)}/cancel`, { method: "POST" });
    }
};

export default jobService;
