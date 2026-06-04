/* ==========================================================================
   EXCELAI BOT - VBA WRITER SERVICE (MOCK)
   ========================================================================== */

import { aiService } from './aiService.js';

export const vbaService = {
    generateMacro(description, task = "Lọc dữ liệu") {
        return new Promise((resolve) => {
            setTimeout(() => {
                const searchPrompt = description || task;
                const result = aiService.generateVBA(searchPrompt);
                
                resolve({
                    code: result.code,
                    explanation: result.explanation,
                    instructions: "1. Trong Excel, nhấn Alt + F11 để mở cửa sổ VBA Microsoft Visual Basic for Applications.\n2. Vào menu Insert > Module.\n3. Sao chép và dán đoạn mã bên trái vào Module mới tạo.\n4. Trở lại trang tính Excel chính, chọn tab Developer > Macros và chạy Sub tương ứng (hoặc nhấn F5 trong Editor).",
                    securityWarning: "⚠️ Chỉ chạy macro từ nguồn tin cậy. Hãy kiểm tra kỹ code trước khi chạy trên file quan trọng chứa dữ liệu thật để tránh ghi đè dữ liệu."
                });
            }, 800);
        });
    }
};

export default vbaService;
