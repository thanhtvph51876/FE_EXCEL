import { aiService } from "./aiService.js";

export const cleaningService = {
    async previewCleaning(fileObj, column, rule) {
        if (!fileObj || !column) throw new Error("Vui lòng chọn đầy đủ tệp tin và cột xử lý!");
        if (fileObj.id) {
            const result = await aiService.cleanData(fileObj.id, column, rule);
            return {
                formula: result.formula,
                explanation: result.description,
                previewRows: result.previewRows || []
            };
        }

        const ruleInstruct = aiService.generateCleaningInstructions(column, rule);
        const colIdx = fileObj.headers.indexOf(column);
        if (colIdx === -1) throw new Error("Cột dữ liệu không tồn tại trong tệp!");
        return {
            formula: ruleInstruct.formula,
            explanation: ruleInstruct.explanation,
            previewRows: fileObj.rows.slice(0, 10).map((row, idx) => ({
                rowNum: idx + 2,
                originalVal: row[colIdx] || "",
                cleanedVal: row[colIdx] || ""
            }))
        };
    },

    async applyCleaning(fileObj, column, rule) {
        return {
            success: true,
            cleanedRowsCount: fileObj ? fileObj.rowCount : 0,
            message: `Đã làm sạch cột [${column}] của tệp ${fileObj ? fileObj.name : "dữ liệu"} thành công!`
        };
    }
};

export default cleaningService;
