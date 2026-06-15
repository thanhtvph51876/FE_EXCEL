import { apiFetch, fetchWithBackendFallback, getApiBase, getAccessToken } from "./config.js";

export const chatService = {
    getConversations() {
        return apiFetch("/api/chat/conversations");
    },

    createConversation(title = "Cuộc trò chuyện mới") {
        return apiFetch("/api/chat/conversations", {
            method: "POST",
            body: JSON.stringify({ title })
        });
    },

    getMessages(conversationId) {
        return apiFetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`);
    },

    sendMessage(conversationId, payload) {
        return apiFetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
            method: "POST",
            body: JSON.stringify(payload)
        });
    },

    getContext() {
        return apiFetch("/api/chat/context");
    },

    getSummary(conversationId) {
        return apiFetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}/summary`);
    },

    attachWorkspaceFile(conversationId, fileId) {
        return apiFetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}/attach-workspace-file`, {
            method: "POST",
            body: JSON.stringify({ fileId })
        });
    },

    async upload(file) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetchWithBackendFallback("/api/chat/upload", {
            method: "POST",
            body: formData
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || err.detail || `Lỗi ${res.status}`);
        }
        return res.json();
    },

    downloadUrl(path) {
        if (!path) return "";
        const token = getAccessToken();
        const sep = path.includes("?") ? "&" : "?";
        return `${getApiBase()}${path}${token ? `${sep}token=${encodeURIComponent(token)}` : ""}`;
    }
};

export default chatService;
