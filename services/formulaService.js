import { aiService } from "./aiService.js";

export const formulaService = {
    async generateFormula(description, context, platform = "Excel 365") {
        const result = await aiService.generateFormula(description, context);
        let formula = result.formula;

        if (platform === "Google Sheets" && formula) {
            formula = formula.replace(/TEXTBEFORE\(([^,]+),\s*" "\)/, 'REGEXEXTRACT($1, "^[^ ]+")');
        }

        return {
            formula,
            explanation: result.explanation,
            inputExample: result.inputExample,
            outputExample: result.outputExample,
            platform,
            commonErrors: "1. Kiểm tra dấu phân cách công thức theo thiết lập vùng của máy.\n2. Đảm bảo các vùng dữ liệu trong công thức có cùng kích thước."
        };
    }
};

export default formulaService;
