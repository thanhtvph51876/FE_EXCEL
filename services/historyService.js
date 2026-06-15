/* ==========================================================================
   EXCELAI BOT - HISTORY PERSISTENCE SERVICE
   ========================================================================== */

import { apiFetch } from "./config.js";

const cache = {
    chatThreads: [],
    operations: []
};

function formatOperation(row) {
    if (row.date && row.time) return row;
    const date = row.createdAt ? new Date(row.createdAt) : new Date();
    return {
        ...row,
        date: date.toLocaleDateString("vi-VN"),
        time: date.toTimeString().split(" ")[0].substring(0, 5)
    };
}

async function safeRequest(task) {
    try {
        return await task();
    } catch (error) {
        console.warn(error.message || error);
        return null;
    }
}

export const historyService = {
    async getHistory() {
        const payload = await apiFetch("/api/history");
        cache.operations = Array.isArray(payload) ? payload.map(formatOperation) : [];
        return cache.operations;
    },

    async refreshChatThreads() {
        const payload = await apiFetch("/api/history/chat-threads");
        cache.chatThreads = Array.isArray(payload.threads) ? payload.threads : [];
        return cache.chatThreads;
    },

    loadChatThreads(defaultThreads = []) {
        return cache.chatThreads.length > 0 ? cache.chatThreads : defaultThreads;
    },

    saveChatThreads(threads) {
        cache.chatThreads = Array.isArray(threads) ? threads : [];
        safeRequest(() => apiFetch("/api/history/chat-threads", {
            method: "PUT",
            body: JSON.stringify({ threads: cache.chatThreads })
        }));
        return Promise.resolve({ success: true, threads: cache.chatThreads });
    },

    loadOperationsHistory() {
        return cache.operations;
    },

    saveOperationsHistory(operations) {
        cache.operations = Array.isArray(operations) ? operations : [];
        return Promise.resolve({ success: true, operations: cache.operations });
    },

    addOperation(type, action) {
        const now = new Date();
        const operation = {
            id: Date.now(),
            type,
            action,
            time: now.toTimeString().split(" ")[0].substring(0, 5),
            date: now.toLocaleDateString("vi-VN")
        };
        
        cache.operations.unshift(operation);
        if (cache.operations.length > 100) cache.operations.pop();

        safeRequest(async () => {
            const payload = await apiFetch("/api/history", {
                method: "POST",
                body: JSON.stringify({ type, action })
            });
            if (payload?.operation) {
                const index = cache.operations.findIndex(item => item.id === operation.id);
                if (index >= 0) cache.operations[index] = formatOperation(payload.operation);
            }
        });

        return cache.operations;
    },

    clearLocalData() {
        cache.chatThreads = [];
        cache.operations = [];
    }
};

export default historyService;
