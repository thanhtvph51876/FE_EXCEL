import { aiService } from "./aiService.js";
import { fileService } from "./fileService.js";

export const dataCheckService = {
    async runChecks(fileObj, rules = []) {
        if (!fileObj) {
            return { totalRows: 0, totalCols: 0, totalErrors: 0, riskLevel: "Thấp", errors: [] };
        }

        if (fileObj.id) {
            const result = await aiService.runDataCheck(fileObj.id);
            return {
                totalRows: result.scannedRows,
                totalCols: fileObj.colCount,
                totalErrors: result.errors.length,
                riskLevel: result.healthScore >= 90 ? "Thấp" : result.healthScore >= 70 ? "Trung bình" : "Cao",
                errors: result.errors,
                aiNarrative: result.aiNarrative
            };
        }

        const errors = fileService.findDetailedErrorsLocal(fileObj.headers, fileObj.rows);
        return {
            totalRows: fileObj.rowCount,
            totalCols: fileObj.colCount,
            totalErrors: errors.length,
            riskLevel: errors.length > 10 ? "Cao" : errors.length > 3 ? "Trung bình" : "Thấp",
            errors
        };
    }
};

export default dataCheckService;
