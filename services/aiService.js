import { API_BASE, apiFetch } from "./config.js";

export const aiService = {
    async generateChatResponse(message, threadHistory = [], systemPrompt = "", fileId = null) {
        const data = await apiFetch("/api/ai/chat", {
            method: "POST",
            body: JSON.stringify({ message, history: threadHistory, fileId })
        });
        return data.reply;
    },

    async streamChat(message, history = [], fileId = null, onChunk) {
        const token = localStorage.getItem("excelai_token");
        const res = await fetch(`${API_BASE}/api/ai/chat/stream`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ message, history, fileId })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || err.detail || `Lỗi ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                buffer += decoder.decode();
                if (!buffer.trim()) break;
                buffer += "\n";
            } else {
                buffer += decoder.decode(value, { stream: true });
            }

            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (data === "[DONE]") return fullText;
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.error) throw new Error(parsed.error);
                    if (parsed.chunk) {
                        fullText += parsed.chunk;
                        if (onChunk) onChunk(parsed.chunk, fullText);
                    }
                } catch (error) {
                    if (error instanceof SyntaxError) continue;
                    throw error;
                }
            }
            if (done) break;
        }
        return fullText;
    },

    async generateFormula(description, context = "chung", promptConfig = null) {
        return apiFetch("/api/ai/formula", {
            method: "POST",
            body: JSON.stringify({ prompt: description, context })
        });
    },

    async generateVBA(description, promptConfig = null) {
        return apiFetch("/api/ai/vba", {
            method: "POST",
            body: JSON.stringify({ prompt: description })
        });
    },

    async explainVBA(code) {
        const data = await apiFetch("/api/ai/chat", {
            method: "POST",
            body: JSON.stringify({
                message: `Giải thích chi tiết từng dòng VBA code sau bằng tiếng Việt:\n\`\`\`vba\n${code}\n\`\`\``
            })
        });
        return data.reply;
    },

    async runDataCheck(fileId) {
        return apiFetch("/api/ai/data-check", {
            method: "POST",
            body: JSON.stringify({ fileId })
        });
    },

    async cleanData(fileId, column, rule) {
        return apiFetch("/api/ai/clean", {
            method: "POST",
            body: JSON.stringify({ fileId, column, rule })
        });
    },

    async reconcileFiles(fileAId, fileBId, keyA, keyB, valA, valB) {
        return apiFetch("/api/ai/reconcile", {
            method: "POST",
            body: JSON.stringify({ fileAId, fileBId, keyA, keyB, valA, valB })
        });
    },

    async generateDataAnalysisSuggestions(stats) {
        const data = await apiFetch("/api/ai/chat", {
            method: "POST",
            body: JSON.stringify({
                message: `Phân tích chất lượng dữ liệu với thống kê sau và đưa ra 3 đề xuất cụ thể: ${JSON.stringify(stats)}`
            })
        });
        return [{ type: "Phân tích AI", text: data.reply }];
    },

    async generateReconciliationSuggestions(stats) {
        if (stats?.aiNarrative) return stats.aiNarrative;
        const data = await apiFetch("/api/ai/chat", {
            method: "POST",
            body: JSON.stringify({
                message: `Tổng kết kết quả đối soát dữ liệu: ${JSON.stringify(stats)}. Viết nhận xét và khuyến nghị bằng tiếng Việt.`
            })
        });
        return data.reply;
    },

    generateCleaningInstructions(column, rule) {
        const map = {
            trim: { desc: `Xóa khoảng trắng thừa cột [${column}]`, formula: `=TRIM(${column}2)` },
            upper: { desc: `Chuyển IN HOA cột [${column}]`, formula: `=UPPER(${column}2)` },
            lower: { desc: `Chuyển chữ thường cột [${column}]`, formula: `=LOWER(${column}2)` },
            phone: { desc: `Chuẩn hóa số điện thoại [${column}]`, formula: `=IF(LEFT(TRIM(${column}2),1)="0",TRIM(${column}2),"0"&TRIM(${column}2))` },
            email: { desc: `Chuẩn hóa email [${column}]`, formula: `=LOWER(TRIM(${column}2))` },
            name: { desc: `Chuẩn hóa họ tên [${column}]`, formula: `=PROPER(TRIM(${column}2))` }
        };
        const result = map[rule] || { desc: "Không rõ rule", formula: "" };
        return { ...result, explanation: result.desc };
    }
};

export default aiService;
