import { apiFetch } from "./config.js";

function query(params = {}) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            search.set(key, value);
        }
    });
    const text = search.toString();
    return text ? `?${text}` : "";
}

export const officeService = {
    async getDashboard(workspaceId = null) {
        return apiFetch(`/api/office/dashboard${query({ workspace_id: workspaceId })}`);
    },

    async listWorkflows(workspaceId = null) {
        return apiFetch(`/api/office/workflows${query({ workspace_id: workspaceId })}`);
    },

    async createWorkflow(payload) {
        return apiFetch("/api/office/workflows", {
            method: "POST",
            body: JSON.stringify(payload)
        });
    },

    async getWorkflow(workflowId) {
        return apiFetch(`/api/office/workflows/${encodeURIComponent(workflowId)}`);
    },

    async updateWorkflow(workflowId, payload) {
        return apiFetch(`/api/office/workflows/${encodeURIComponent(workflowId)}`, {
            method: "PUT",
            body: JSON.stringify(payload)
        });
    },

    async updateWorkflowStatus(workflowId, status) {
        return apiFetch(`/api/office/workflows/${encodeURIComponent(workflowId)}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status })
        });
    },

    async archiveWorkflow(workflowId) {
        return apiFetch(`/api/office/workflows/${encodeURIComponent(workflowId)}`, {
            method: "DELETE"
        });
    },

    async runWorkflow(workflowId, payload = {}) {
        return apiFetch(`/api/office/workflows/${encodeURIComponent(workflowId)}/run`, {
            method: "POST",
            body: JSON.stringify(payload)
        });
    }
};

export default officeService;
