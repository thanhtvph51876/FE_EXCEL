/* ==========================================================================
   EXCELAI BOT - DATA CHECKING SERVICE (MOCK)
   ========================================================================== */

import { fileService } from './fileService.js';

export const dataCheckService = {
    runChecks(fileObj, rules = []) {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (!fileObj) {
                    resolve({
                        totalRows: 0,
                        totalCols: 0,
                        totalErrors: 0,
                        riskLevel: "Thấp",
                        errors: []
                    });
                    return;
                }

                // Call validation in fileService
                const errors = fileService.findDetailedErrors(fileObj.headers, fileObj.rows);
                
                // Filter errors based on active rules if specified
                const filteredErrors = errors.filter(err => {
                    if (rules.length === 0) return true;
                    // Map rules to internal error types
                    const typeLower = err.errorType.toLowerCase();
                    const descLower = err.suggestion.toLowerCase();
                    
                    return rules.some(rule => {
                        const ruleLower = rule.toLowerCase();
                        if (ruleLower === "missing values" && typeLower.includes("trống")) return true;
                        if (ruleLower === "duplicate rows" && typeLower.includes("trùng")) return true;
                        if (ruleLower === "invalid email" && descLower.includes("email")) return true;
                        if (ruleLower === "invalid phone" && descLower.includes("sđt")) return true;
                        if (ruleLower === "invalid date" && descLower.includes("ngày")) return true;
                        if (ruleLower === "negative amount" && descLower.includes("âm")) return true;
                        return false;
                    });
                });

                const totalCells = fileObj.rowCount * fileObj.colCount;
                const errorRatio = filteredErrors.length / Math.max(1, totalCells);
                
                let riskLevel = "Thấp";
                if (errorRatio > 0.1) {
                    riskLevel = "Cao 🔴";
                } else if (errorRatio > 0.03) {
                    riskLevel = "Trung bình 🟡";
                } else {
                    riskLevel = "Thấp 🟢";
                }

                resolve({
                    totalRows: fileObj.rowCount,
                    totalCols: fileObj.colCount,
                    totalErrors: filteredErrors.length,
                    riskLevel,
                    errors: filteredErrors
                });
            }, 1000);
        });
    }
};

export default dataCheckService;
