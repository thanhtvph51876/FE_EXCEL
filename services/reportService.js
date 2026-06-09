/* ==========================================================================
   EXCELAI BOT - REPORT GENERATION SERVICE
   ========================================================================== */

import { aiService } from './aiService.js';

export const reportService = {
    generateReport(fileObj, reportType = "Doanh thu") {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (!fileObj) {
                    resolve({
                        title: "Báo cáo trống",
                        rowCount: 0,
                        stat1: "N/A",
                        stat2: "N/A",
                        stat3: "N/A",
                        chartLabels: [],
                        chartValues: [],
                        chartLabel: "N/A",
                        insights: "Chưa có dữ liệu phân tích."
                    });
                    return;
                }

                const stats = fileObj.statistics || { columns: [] };
                const numCols = stats.columns ? stats.columns.filter(c => c.type === "Số") : [];
                let valColName = numCols.length > 0 ? numCols[0].name : fileObj.headers[0];
                
                let chartLabels = [];
                let chartValues = [];
                const valColIdx = numCols.length > 0 ? fileObj.headers.indexOf(valColName) : 0;
                
                fileObj.rows.forEach((r, i) => {
                    chartLabels.push(r[0] || `Dòng ${i+2}`);
                    const val = parseFloat(r[valColIdx].replace(/,/g, ''));
                    chartValues.push(isNaN(val) ? 1 : val);
                });
                
                let totalSum = chartValues.reduce((a, b) => a + b, 0);
                let avgVal = chartValues.length > 0 ? Math.round(totalSum / chartValues.length) : 0;
                
                const unit = numCols.length > 0 ? "đ" : "";
                const stat1 = totalSum.toLocaleString() + unit;
                const stat2 = avgVal.toLocaleString() + unit;
                const stat3 = fileObj.headers[0] || "N/A";
                
                // Get AI advice
                const suggestions = aiService.generateDataAnalysisSuggestions(fileObj.statistics || { rows: fileObj.rowCount });
                const suggestionsText = suggestions.map(s => `• <strong>[${s.type}]</strong> ${s.text}`).join("<br>");
                
                resolve({
                    title: `Báo Cáo Hoạt Động - Phân hệ ${reportType}`,
                    rowCount: fileObj.rowCount,
                    stat1,
                    stat2,
                    stat3,
                    chartLabels: chartLabels.slice(0, 10),
                    chartValues: chartValues.slice(0, 10),
                    chartLabel: valColName,
                    insights: `<strong>Tóm tắt tự động AI:</strong><br>${suggestionsText}`
                });
            }, 1000);
        });
    }
};

export default reportService;
