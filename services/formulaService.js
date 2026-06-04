/* ==========================================================================
   EXCELAI BOT - EXCEL FORMULA GENERATION SERVICE (MOCK)
   ========================================================================== */

import { aiService } from './aiService.js';

export const formulaService = {
    generateFormula(description, context, platform = "Excel 365") {
        return new Promise((resolve) => {
            setTimeout(() => {
                const dummyConfig = { formulaPrompt: "" };
                const result = aiService.generateFormula(description, context, dummyConfig);
                
                // Customize output slightly based on platform
                if (platform === "Google Sheets") {
                    result.formula = result.formula.replace(/TEXTBEFORE\(([^,]+),\s*" "\)/, 'REGEXEXTRACT($1, "^[^ ]+")');
                }

                resolve({
                    formula: result.formula,
                    explanation: result.explanation,
                    inputExample: result.inputExample,
                    outputExample: result.outputExample,
                    platform,
                    commonErrors: "1. Sử dụng sai dấu phẩy (,) thay vì chấm phẩy (;) theo định dạng máy của bạn.\n2. Vùng dữ liệu so sánh có kích thước không khớp nhau (Ví dụ: A2:A100 so với B2:B50)."
                });
            }, 700);
        });
    }
};

export default formulaService;
