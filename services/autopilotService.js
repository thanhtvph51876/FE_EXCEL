import { apiFetch } from "./config.js";

function withPreview(plan) {
    const normalized = {
        understanding: plan.understanding || "Đã phân tích yêu cầu tự động hóa.",
        steps: Array.isArray(plan.steps) ? plan.steps : [],
        requiredInputs: Array.isArray(plan.requiredInputs) ? plan.requiredInputs : [],
        expectedOutputs: Array.isArray(plan.expectedOutputs) ? plan.expectedOutputs : [],
        previewType: plan.previewType || "excel",
        previewData: plan.previewData || null
    };

    if (!normalized.previewData && normalized.previewType === "document") {
        normalized.previewData = {
            title: normalized.expectedOutputs[0] || "BẢN NHÁP AUTOPILOT",
            content: normalized.steps.map(step => `${step.num}. ${step.title}\n${step.desc}`).join("\n\n")
        };
    }

    if (!normalized.previewData) {
        normalized.previewType = "excel";
        normalized.previewData = {
            headers: ["Bước", "Hạng mục", "Mô tả", "Trạng thái"],
            rows: normalized.steps.map(step => [String(step.num), step.title, step.desc, step.status])
        };
    }

    return normalized;
}

export const autopilotService = {
    async generatePlan(goal, outputs = [], files = []) {
        const plan = await apiFetch("/api/ai/autopilot", {
            method: "POST",
            body: JSON.stringify({ goal, outputs, files })
        });
        return withPreview(plan);
    }
};

export default autopilotService;
