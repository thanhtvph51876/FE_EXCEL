/* ==========================================================================
   EXCELAI BOT - FILE UTILITY, API UPLOAD, AND PARSING SERVICE
   ========================================================================== */

import { API_BASE, apiFetch } from "./config.js";

export const fileService = {
    maxSizeLimit: 10 * 1024 * 1024, // 10MB

    validateFile(file) {
        if (!file) {
            return { valid: false, error: "Không tìm thấy file!" };
        }
        
        const fileName = file.name.toLowerCase();
        const validExtensions = [".csv", ".xlsx", ".xls"];
        const hasValidExt = validExtensions.some(ext => fileName.endsWith(ext));
        
        if (!hasValidExt) {
            return { valid: false, error: "Định dạng file không hỗ trợ! Vui lòng chỉ tải lên tệp .csv, .xlsx, hoặc .xls" };
        }
        
        if (file.size > this.maxSizeLimit) {
            return { valid: false, error: "Dung lượng file vượt quá giới hạn cho phép (Tối đa 10MB)!" };
        }
        
        if (file.size === 0) {
            return { valid: false, error: "Tệp tin rỗng! Không có dữ liệu." };
        }
        
        return { valid: true };
    },

    async parseCSV(file) {
        return this.uploadFile(file);
    },

    async uploadFile(file) {
        const formData = new FormData();
        formData.append("file", file);
        const token = localStorage.getItem("excelai_token");
        const res = await fetch(`${API_BASE}/api/files/upload`, {
            method: "POST",
            headers: token ? { "Authorization": `Bearer ${token}` } : {},
            body: formData
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || "Upload thất bại");
        }
        return res.json();
    },

    async getFiles() {
        return apiFetch("/api/files");
    },

    async deleteFile(fileId) {
        return apiFetch(`/api/files/${fileId}`, { method: "DELETE" });
    },

    async getFilePreview(fileId) {
        return apiFetch(`/api/files/${fileId}/preview`);
    },

    async updateFileMetadata(fileId, metadata = {}) {
        return apiFetch(`/api/files/${encodeURIComponent(fileId)}/metadata`, {
            method: "PATCH",
            body: JSON.stringify(metadata)
        });
    },

    async parseLocalCSV(file) {
        return new Promise((resolve, reject) => {
            const fileName = file.name.toLowerCase();
            if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
                reject("Excel nhị phân cần được parse qua backend API.");
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
                
                if (lines.length === 0) {
                    reject("Tệp CSV rỗng!");
                    return;
                }
                
                // Phát hiện dấu ngăn cách tự động (phẩy hoặc chấm phẩy)
                const delimiter = this.detectDelimiter(lines[0]);
                const headers = this.parseCSVLine(lines[0], delimiter);
                
                const rows = [];
                const previewLimit = Math.min(lines.length, 101); // Đọc tối đa 100 dòng preview + 1 header
                
                for (let i = 1; i < previewLimit; i++) {
                    const row = this.parseCSVLine(lines[i], delimiter);
                    while (row.length < headers.length) row.push("");
                    rows.push(row.slice(0, headers.length));
                }
                
                const statistics = this.buildDataStatistics(headers, rows, lines.length - 1);
                
                resolve({
                    name: file.name,
                    size: file.size,
                    rowCount: lines.length - 1,
                    colCount: headers.length,
                    headers,
                    rows: rows,
                    statistics
                });
            };
            reader.onerror = () => {
                reject("Có lỗi xảy ra khi đọc tệp tin!");
            };
            reader.readAsText(file);
        });
    },

    detectDelimiter(line) {
        const counts = { ",": 0, ";": 0, "\t": 0 };
        for (let char of line) {
            if (char in counts) counts[char]++;
        }
        if (counts[";"] > counts[","]) return ";";
        if (counts["\t"] > counts[","]) return "\t";
        return ",";
    },

    parseCSVLine(line, delimiter) {
        const result = [];
        let curVal = "";
        let insideQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                insideQuotes = !insideQuotes;
            } else if (char === delimiter && !insideQuotes) {
                result.push(curVal.trim());
                curVal = "";
            } else {
                curVal += char;
            }
        }
        result.push(curVal.trim());
        return result;
    },

    buildDataStatistics(headers, rows, totalRowCount) {
        const stats = {
            totalRows: totalRowCount,
            totalCols: headers.length,
            missingValues: 0,
            duplicateRows: 0,
            columns: []
        };
        
        // Kiểm tra dòng trùng lặp trong phạm vi dữ liệu đã đọc
        const uniqueStrings = new Set();
        rows.forEach(r => {
            const rowStr = r.join("|");
            if (uniqueStrings.has(rowStr)) {
                stats.duplicateRows++;
            } else {
                uniqueStrings.add(rowStr);
            }
        });
        
        // Tính phóng đại nếu file nhiều hơn 100 dòng
        if (totalRowCount > rows.length && stats.duplicateRows > 0) {
            stats.duplicateRows = Math.round(stats.duplicateRows * (totalRowCount / rows.length));
        }

        // Kiểm tra kiểu dữ liệu cho từng cột
        headers.forEach((h, colIndex) => {
            let emptyCount = 0;
            let numberCount = 0;
            let textCount = 0;
            const valuesMap = {};
            
            rows.forEach(r => {
                const val = r[colIndex];
                if (val === undefined || val === null || val.trim() === "") {
                    emptyCount++;
                } else if (!isNaN(parseFloat(val.replace(/,/g, '')))) {
                    numberCount++;
                } else {
                    textCount++;
                }
                
                if (val && val.trim() !== "") {
                    valuesMap[val] = (valuesMap[val] || 0) + 1;
                }
            });
            
            stats.missingValues += emptyCount;
            
            let colType = "Văn bản";
            if (numberCount > textCount && numberCount > 0) colType = "Số";
            
            const topValues = Object.entries(valuesMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(entry => `${entry[0]} (${entry[1]} lần)`);

            stats.columns.push({
                name: h,
                type: colType,
                missingCount: Math.round(emptyCount * (totalRowCount / Math.max(1, rows.length))),
                topValues: topValues.length > 0 ? topValues.join(", ") : "Không có"
            });
        });

        stats.missingValues = Math.round(stats.missingValues * (totalRowCount / Math.max(1, rows.length)));
        
        return stats;
    },

    // RÀ SOÁT LỖI DỮ LIỆU THỰC TẾ
    async findDetailedErrors(headers, rows, fileId = null) {
        if (fileId) {
            const data = await apiFetch("/api/ai/data-check", {
                method: "POST",
                body: JSON.stringify({ fileId })
            });
            return (data.errors || []).map(err => ({
                row: err.row,
                colName: err.column,
                value: err.value,
                errorType: err.issue,
                suggestion: err.issue,
                healthScore: data.healthScore,
                aiNarrative: data.aiNarrative
            }));
        }
        return this.findDetailedErrorsLocal(headers, rows);
    },

    findDetailedErrorsLocal(headers, rows) {
        const errors = [];
        const lowercaseHeaders = headers.map(h => h.toLowerCase().trim());
        
        // Detect key indices
        const emailIndex = lowercaseHeaders.findIndex(h => h.includes("email") || h.includes("thư điện tử"));
        const phoneIndex = lowercaseHeaders.findIndex(h => h.includes("phone") || h.includes("điện thoại") || h.includes("sđt"));
        const dateIndex = lowercaseHeaders.findIndex(h => h.includes("ngày") || h.includes("date"));
        const amountIndex = lowercaseHeaders.findIndex(h => h.includes("tiền") || h.includes("price") || h.includes("amount") || h.includes("doanh thu") || h.includes("giá"));
        const qtyIndex = lowercaseHeaders.findIndex(h => h.includes("số lượng") || h.includes("quantity") || h.includes("qty") || h.includes("s/l"));
        const totalIndex = lowercaseHeaders.findIndex(h => h.includes("thành tiền") || h.includes("total"));
        const keyIndex = lowercaseHeaders.findIndex(h => h.includes("mã") || h.includes("id") || h.includes("key"));

        // Check for duplicates on first column or primary key
        const uniqueKeys = new Map();
        const primaryColIndex = keyIndex !== -1 ? keyIndex : 0;

        rows.forEach((row, rowIndex) => {
            const displayRow = rowIndex + 2; // Row number in sheet (1-based + 1 for header)

            // 1. Check duplicate primary key
            const pKey = row[primaryColIndex];
            if (pKey && pKey.trim() !== "") {
                if (uniqueKeys.has(pKey)) {
                    errors.push({
                        row: displayRow,
                        colName: headers[primaryColIndex],
                        value: pKey,
                        errorType: "Duplicate row",
                        suggestion: `Mã khóa chính bị trùng lặp với dòng ${uniqueKeys.get(pKey)}. Gợi ý: Hãy tạo ID duy nhất.`
                    });
                } else {
                    uniqueKeys.set(pKey, displayRow);
                }
            }

            row.forEach((cellVal, colIndex) => {
                const cellValTrim = cellVal ? cellVal.trim() : "";
                const colName = headers[colIndex];

                // 2. Check Missing Value
                if (cellValTrim === "") {
                    // Ignore empty key if it was already marked, but check essential fields
                    errors.push({
                        row: displayRow,
                        colName: colName,
                        value: "",
                        errorType: "Missing value",
                        suggestion: `Trường dữ liệu rỗng. Gợi ý: Hãy bổ sung giá trị hoặc điền giá trị mặc định.`
                    });
                    return; // Skip other validations for empty cell
                }

                // 3. Validate Email format
                if (colIndex === emailIndex) {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(cellValTrim)) {
                        errors.push({
                            row: displayRow,
                            colName: colName,
                            value: cellVal,
                            errorType: "Invalid format",
                            suggestion: `Email không đúng định dạng. Gợi ý: Kiểm tra ký tự '@' và domain (ví dụ: name@company.com).`
                        });
                    }
                }

                // 4. Validate Phone number
                if (colIndex === phoneIndex) {
                    const phoneClean = cellValTrim.replace(/[\s\-\(\)]/g, "");
                    const isAllDigits = /^\+?[0-9]{9,15}$/.test(phoneClean);
                    if (!isAllDigits) {
                        errors.push({
                            row: displayRow,
                            colName: colName,
                            value: cellVal,
                            errorType: "Invalid format",
                            suggestion: `Số điện thoại không hợp lệ. Gợi ý: Nhập số từ 9-11 chữ số, bỏ ký tự chữ.`
                        });
                    }
                }

                // 5. Validate Date format
                if (colIndex === dateIndex) {
                    // Try parsing date
                    const parts = cellValTrim.split(/[\/\-\.]/);
                    let isValidDate = false;
                    if (parts.length === 3) {
                        let d = parseInt(parts[0]);
                        let m = parseInt(parts[1]) - 1;
                        let y = parseInt(parts[2]);
                        // Support YYYY/MM/DD or DD/MM/YYYY format guess
                        if (parts[0].length === 4) {
                            y = parseInt(parts[0]);
                            d = parseInt(parts[2]);
                        }
                        const testDate = new Date(y, m, d);
                        if (testDate.getFullYear() === y && testDate.getMonth() === m && testDate.getDate() === d) {
                            isValidDate = true;
                        }
                    }
                    if (!isValidDate) {
                        errors.push({
                            row: displayRow,
                            colName: colName,
                            value: cellVal,
                            errorType: "Invalid format",
                            suggestion: `Định dạng ngày tháng không hợp lệ. Gợi ý: Chuyển về định dạng DD/MM/YYYY chuẩn.`
                        });
                    }
                }

                // 6. Validate Outliers/Negative values
                if (colIndex === amountIndex) {
                    const numVal = parseFloat(cellValTrim.replace(/,/g, ''));
                    if (isNaN(numVal)) {
                        errors.push({
                            row: displayRow,
                            colName: colName,
                            value: cellVal,
                            errorType: "Invalid format",
                            suggestion: `Không phải định dạng số. Gợi ý: Loại bỏ chữ và các ký tự đặc biệt.`
                        });
                    } else if (numVal < 0) {
                        errors.push({
                            row: displayRow,
                            colName: colName,
                            value: cellVal,
                            errorType: "Outlier",
                            suggestion: `Số tiền âm bất thường. Gợi ý: Xác minh giao dịch hoàn tiền hoặc sai sót nhập liệu.`
                        });
                    }
                }
            });

            // 7. Validate cross-column logic (Total = Qty * Price)
            if (qtyIndex !== -1 && amountIndex !== -1 && totalIndex !== -1) {
                const qtyVal = parseFloat(row[qtyIndex].replace(/,/g, ''));
                const priceVal = parseFloat(row[amountIndex].replace(/,/g, ''));
                const totalVal = parseFloat(row[totalIndex].replace(/,/g, ''));

                if (!isNaN(qtyVal) && !isNaN(priceVal) && !isNaN(totalVal)) {
                    const expectedTotal = qtyVal * priceVal;
                    if (Math.abs(expectedTotal - totalVal) > 1) { // 1 unit tolerance
                        errors.push({
                            row: displayRow,
                            colName: headers[totalIndex],
                            value: row[totalIndex],
                            errorType: "Logic error",
                            suggestion: `Tính toán sai lệch. Gợi ý: ${headers[totalIndex]} phải bằng ${headers[qtyIndex]} (${qtyVal}) x ${headers[amountIndex]} (${priceVal}) = ${expectedTotal.toLocaleString()}.`
                        });
                    }
                }
            }
        });

        return errors;
    },

    // ĐỐI SOÁT DỮ LIỆU HAI FILE A VÀ B
    async performReconciliation(fileA, fileB, keyColA, keyColB, valColA, valColB) {
        if (fileA?.id && fileB?.id) {
            const data = await apiFetch("/api/ai/reconcile", {
                method: "POST",
                body: JSON.stringify({
                    fileAId: fileA.id,
                    fileBId: fileB.id,
                    keyA: keyColA,
                    keyB: keyColB,
                    valA: valColA,
                    valB: valColB
                })
            });
            const discrepancies = data.discrepancies || [];
            const mismatched = discrepancies
                .filter(item => item.reason === "Chênh lệch giá trị")
                .map(item => ({
                    key: item.key,
                    rowA: item.rowA || "-",
                    rowB: item.rowB || "-",
                    valA: item.valA || 0,
                    valB: item.valB || 0,
                    difference: item.diff || 0,
                    desc: `Khóa '${item.key}' có giá trị File A = ${(item.valA || 0).toLocaleString()}đ, File B = ${(item.valB || 0).toLocaleString()}đ.`
                }));
            const missingInB = discrepancies
                .filter(item => item.reason === "Thiếu ở File B")
                .map(item => ({
                    key: item.key,
                    rowA: item.rowA || "-",
                    valA: item.valA || 0,
                    desc: `Khóa '${item.key}' xuất hiện trong File A nhưng bị thiếu ở File B.`
                }));
            const missingInA = discrepancies
                .filter(item => item.reason === "Thiếu ở File A")
                .map(item => ({
                    key: item.key,
                    rowB: item.rowB || "-",
                    valB: item.valB || 0,
                    desc: `Khóa '${item.key}' xuất hiện trong File B nhưng bị thiếu ở File A.`
                }));

            return {
                matchedCount: data.summary?.matched || 0,
                mismatchedCount: data.summary?.mismatched || 0,
                missingInBCount: data.summary?.missingB || 0,
                missingInACount: data.summary?.missingA || 0,
                missingInB,
                missingInA,
                mismatched,
                aiNarrative: data.aiNarrative || ""
            };
        }
        return this.performLocalReconciliation(fileA, fileB, keyColA, keyColB, valColA, valColB);
    },

    performLocalReconciliation(fileA, fileB, keyColA, keyColB, valColA, valColB) {
        const headersA = fileA.headers;
        const headersB = fileB.headers;
        const rowsA = fileA.rows;
        const rowsB = fileB.rows;

        const colIdxKeyA = headersA.indexOf(keyColA);
        const colIdxKeyB = headersB.indexOf(keyColB);
        const colIdxValA = headersA.indexOf(valColA);
        const colIdxValB = headersB.indexOf(valColB);

        const mapA = new Map();
        const mapB = new Map();

        rowsA.forEach((row, idx) => {
            const key = row[colIdxKeyA];
            if (key) mapA.set(key.trim(), { row, index: idx + 2 });
        });

        rowsB.forEach((row, idx) => {
            const key = row[colIdxKeyB];
            if (key) mapB.set(key.trim(), { row, index: idx + 2 });
        });

        const matched = [];
        const missingInB = [];
        const missingInA = [];
        const mismatched = [];

        // Loop A to find matches and missing in B
        mapA.forEach((dataA, key) => {
            const valAStr = dataA.row[colIdxValA] || "0";
            const valA = parseFloat(valAStr.replace(/,/g, '')) || 0;

            if (mapB.has(key)) {
                const dataB = mapB.get(key);
                const valBStr = dataB.row[colIdxValB] || "0";
                const valB = parseFloat(valBStr.replace(/,/g, '')) || 0;

                if (Math.abs(valA - valB) < 0.01) {
                    matched.push({
                        key,
                        rowA: dataA.index,
                        rowB: dataB.index,
                        valA,
                        valB
                    });
                } else {
                    mismatched.push({
                        key,
                        rowA: dataA.index,
                        rowB: dataB.index,
                        valA,
                        valB,
                        difference: valA - valB,
                        desc: `Lệch cột giá trị: ${keyColA} '${key}' có tiền File A = ${valA.toLocaleString()}đ, File B = ${valB.toLocaleString()}đ (Lệch ${ (valA - valB).toLocaleString() }đ).`
                    });
                }
            } else {
                missingInB.push({
                    key,
                    rowA: dataA.index,
                    valA,
                    desc: `Khóa '${key}' xuất hiện trong File A (dòng ${dataA.index}) nhưng bị thiếu ở File B.`
                });
            }
        });

        // Loop B to find missing in A
        mapB.forEach((dataB, key) => {
            if (!mapA.has(key)) {
                const valBStr = dataB.row[colIdxValB] || "0";
                const valB = parseFloat(valBStr.replace(/,/g, '')) || 0;
                missingInA.push({
                    key,
                    rowB: dataB.index,
                    valB,
                    desc: `Khóa '${key}' xuất hiện trong File B (dòng ${dataB.index}) nhưng bị thiếu ở File A.`
                });
            }
        });

        return {
            matchedCount: matched.length,
            missingInBCount: missingInB.length,
            missingInACount: missingInA.length,
            mismatchedCount: mismatched.length,
            missingInB,
            missingInA,
            mismatched
        };
    }
};
