import { aiService } from "./aiService.js";

export const vbaService = {
    async generateMacro(description, task = "Lọc dữ liệu") {
        const result = await aiService.generateVBA(description || task);
        return {
            code: result.code,
            explanation: result.explanation,
            instructions: "1. Trong Excel, nhấn Alt + F11 để mở cửa sổ VBA.\n2. Vào Insert > Module.\n3. Dán đoạn mã vào Module mới.\n4. Chạy macro sau khi đã kiểm tra trên bản sao dữ liệu.",
            securityWarning: "Chỉ chạy macro từ nguồn tin cậy và nên thử trên bản sao của file quan trọng."
        };
    }
};

export default vbaService;
