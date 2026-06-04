/* ==========================================================================
   EXCELAI BOT - DATA CLEANING SERVICE (MOCK)
   ========================================================================== */

import { aiService } from './aiService.js';

export const cleaningService = {
    previewCleaning(fileObj, column, rule) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (!fileObj || !column) {
                    reject("Vui lòng chọn đầy đủ tệp tin và cột xử lý!");
                    return;
                }

                const ruleInstruct = aiService.generateCleaningInstructions(column, rule);
                const colIdx = fileObj.headers.indexOf(column);
                if (colIdx === -1) {
                    reject("Cột dữ liệu không tồn tại trong tệp!");
                    return;
                }

                const previewRows = [];
                const rowsToShow = fileObj.rows.slice(0, 10); // show up to 10 rows preview

                rowsToShow.forEach((row, idx) => {
                    const originalVal = row[colIdx] || "";
                    let cleanedVal = originalVal;

                    if (rule === "trim") {
                        cleanedVal = originalVal.trim().replace(/\s+/g, ' ');
                    } else if (rule === "upper") {
                        cleanedVal = originalVal.toUpperCase();
                    } else if (rule === "lower") {
                        cleanedVal = originalVal.toLowerCase();
                    } else if (rule === "phone") {
                        const cleanPhone = originalVal.replace(/[\s\-\(\)]/g, "");
                        cleanedVal = cleanPhone.startsWith("0") ? cleanPhone : "0" + cleanPhone;
                    } else if (rule === "email") {
                        cleanedVal = originalVal.trim().toLowerCase();
                    } else if (rule === "name") {
                        cleanedVal = originalVal.trim().split(" ").slice(0, -1).join(" ");
                    }

                    previewRows.push({
                        rowNum: idx + 2, // 1-indexed headers
                        originalVal,
                        cleanedVal
                    });
                });

                resolve({
                    formula: ruleInstruct.formula,
                    explanation: ruleInstruct.explanation,
                    previewRows
                });
            }, 800);
        });
    },

    applyCleaningDemo(fileObj, column, rule) {
        return new Promise((resolve) => {
            setTimeout(() => {
                // Return mock cleaned summary
                resolve({
                    success: true,
                    cleanedRowsCount: fileObj ? fileObj.rowCount : 0,
                    message: `Đã làm sạch cột [${column}] của tệp ${fileObj ? fileObj.name : "dữ liệu"} thành công!`
                });
            }, 1000);
        });
    }
};

export default cleaningService;
