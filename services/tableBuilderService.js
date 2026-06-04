/* ==========================================================================
   EXCELAI BOT - AI TABLE BUILDER SERVICE (MOCK)
   ========================================================================== */

export const tableBuilderService = {
    generateTable(description, type, includeFormula = true, includeSampleData = true) {
        let result = {
            tableName: "Bảng tính được tạo bởi AI",
            columns: [],
            formulas: [],
            rows: [],
            notes: ""
        };

        const typeLower = type.toLowerCase();

        if (typeLower === "công nợ" || description.toLowerCase().includes("công nợ")) {
            result.tableName = "Bảng Quản Lý Công Nợ Khách Hàng";
            result.columns = [
                { name: "Mã Khách Hàng", type: "Văn bản", sample: "KH01" },
                { name: "Tên Khách Hàng", type: "Văn bản", sample: "Công ty Hoa Mai" },
                { name: "Số Hóa Đơn", type: "Văn bản", sample: "HĐ-102" },
                { name: "Phải Thu (VNĐ)", type: "Số", sample: "50,000,000" },
                { name: "Đã Thu (VNĐ)", type: "Số", sample: "20,000,000" },
                { name: "Còn Lại (VNĐ)", type: "Công thức", sample: "30,000,000" },
                { name: "Ngày Đến Hạn", type: "Ngày tháng", sample: "15/06/2026" },
                { name: "Trạng Thái", type: "Công thức", sample: "Chưa thu đủ" }
            ];

            if (includeFormula) {
                result.formulas = [
                    { col: "Còn Lại (VNĐ)", expr: "=D2-E2", desc: "Hiệu số giữa số tiền Phải thu và Đã thu." },
                    { col: "Trạng Thái", expr: '=IF(F2<=0, "Đã thu đủ", "Chưa thu đủ")', desc: "Tự động phân loại trạng thái thanh toán dựa trên số dư Còn lại." }
                ];
            }

            if (includeSampleData) {
                result.rows = [
                    ["KH001", "Công ty TNHH Minh Phong", "HD-2026-01", "150,000,000", "50,000,000", "100,000,000", "15/06/2026", "Chưa thu đủ"],
                    ["KH002", "Tập đoàn Đại Nam", "HD-2026-02", "80,000,000", "80,000,000", "0", "10/06/2026", "Đã thu đủ"],
                    ["KH003", "Doanh nghiệp Tư nhân Tiến Phát", "HD-2026-03", "200,000,000", "50,000,000", "150,000,000", "28/05/2026", "Chưa thu đủ"]
                ];
            }

            result.notes = "Bảng công nợ này đã cấu hình sẵn định dạng tiền tệ Việt Nam Đồng (VNĐ). Hãy nhớ áp dụng định dạng Số cho cột Phải Thu, Đã Thu và Còn Lại.";
        }
        else if (typeLower === "bảng lương" || typeLower === "lương" || description.toLowerCase().includes("lương")) {
            result.tableName = "Bảng Tính Lương Nhân Sự Tổng Hợp";
            result.columns = [
                { name: "Mã Nhân Viên", type: "Văn bản", sample: "NV01" },
                { name: "Họ và Tên", type: "Văn bản", sample: "Nguyễn Văn A" },
                { name: "Lương Thỏa Thuận", type: "Số", sample: "15,000,000" },
                { name: "Ngày Công Thực Tế", type: "Số", sample: "24" },
                { name: "Lương Ngày Công", type: "Công thức", sample: "13,846,154" },
                { name: "Phụ Cấp", type: "Số", sample: "1,000,000" },
                { name: "Khấu Trừ Bảo Hiểm", type: "Công thức", sample: "1,575,000" },
                { name: "Thực Lĩnh", type: "Công thức", sample: "13,271,154" }
            ];

            if (includeFormula) {
                result.formulas = [
                    { col: "Lương Ngày Công", expr: "=ROUND((C2/26)*D2, 0)", desc: "Tính lương theo ngày công thực tế đi làm (Giả định tháng tiêu chuẩn 26 ngày)." },
                    { col: "Khấu Trừ Bảo Hiểm", expr: "=C2*10.5%", desc: "Trích bảo hiểm bắt buộc tỷ lệ 10.5% đóng từ tiền lương thỏa thuận." },
                    { col: "Thực Lĩnh", expr: "=E2+F2-G2", desc: "Lương thực lĩnh cuối cùng nhận được sau phụ cấp và trừ đi bảo hiểm." }
                ];
            }

            if (includeSampleData) {
                result.rows = [
                    ["NV01", "Nguyễn Văn Hùng", "18,000,000", "24", "16,615,385", "1,500,000", "1,890,000", "16,225,385"],
                    ["NV02", "Lê Thị Mai", "12,000,000", "26", "12,000,000", "3,000,000", "1,260,000", "13,740,000"],
                    ["NV03", "Trần Văn Việt", "15,000,000", "22", "12,692,308", "1,000,000", "1,575,000", "12,117,308"]
                ];
            }

            result.notes = "Bảng lương đã tối ưu hóa phép làm tròn ROUND tránh số lẻ thập phân cho tiền đồng Việt Nam.";
        }
        else if (typeLower === "tồn kho" || description.toLowerCase().includes("kho") || description.toLowerCase().includes("tồn")) {
            result.tableName = "Bảng Quản Lý Xuất Nhập Tồn Kho";
            result.columns = [
                { name: "Mã Vật Tư", type: "Văn bản", sample: "VT01" },
                { name: "Tên Hàng Hóa", type: "Văn bản", sample: "Thép xây dựng A" },
                { name: "Đơn Vị Tính", type: "Văn bản", sample: "Tấn" },
                { name: "Tồn Đầu Kỳ", type: "Số", sample: "100" },
                { name: "Nhập Trong Kỳ", type: "Số", sample: "50" },
                { name: "Xuất Trong Kỳ", type: "Số", sample: "30" },
                { name: "Tồn Cuối Kỳ", type: "Công thức", sample: "120" },
                { name: "Cảnh Báo Tồn Kho", type: "Công thức", sample: "Bình thường" }
            ];

            if (includeFormula) {
                result.formulas = [
                    { col: "Tồn Cuối Kỳ", expr: "=D2+E2-F2", desc: "Tồn cuối kỳ = Tồn đầu kỳ + Nhập kho - Xuất kho." },
                    { col: "Cảnh Báo Tồn Kho", expr: '=IF(G2<15, "Yêu cầu nhập hàng", "Bình thường")', desc: "Phát cảnh báo bổ sung hàng khi số lượng tồn kho dưới ngưỡng an toàn (15)." }
                ];
            }

            if (includeSampleData) {
                result.rows = [
                    ["VT001", "Sắt cuộn Phi 8", "Tấn", "50", "30", "65", "15", "Bình thường"],
                    ["VT002", "Xi măng Hà Tiên", "Bao", "200", "150", "340", "10", "Yêu cầu nhập hàng"],
                    ["VT003", "Gạch ống Tuynel", "Viên", "10,000", "5,000", "4,000", "11,000", "Bình thường"]
                ];
            }

            result.notes = "Bạn có thể thay đổi ngưỡng cảnh báo an toàn (ví dụ: 15) trong công thức IF để khớp với chính sách lưu kho.";
        }
        else {
            result.tableName = "Bảng Tính Tự Doanh AI Builder";
            result.columns = [
                { name: "Cột A", type: "Văn bản", sample: "Thông tin A" },
                { name: "Cột B", type: "Số", sample: "100" },
                { name: "Cột C", type: "Số", sample: "20" },
                { name: "Kết quả (B*C)", type: "Công thức", sample: "2,000" }
            ];

            if (includeFormula) {
                result.formulas = [
                    { col: "Kết quả (B*C)", expr: "=B2*C2", desc: "Nhân giá trị cột B với cột C." }
                ];
            }

            if (includeSampleData) {
                result.rows = [
                    ["Mẫu dòng 1", "50", "5", "250"],
                    ["Mẫu dòng 2", "120", "2", "240"],
                    ["Mẫu dòng 3", "300", "4", "1,200"]
                ];
            }
            result.notes = "Bảng được sinh theo mô tả tùy chỉnh của bạn.";
        }

        return result;
    }
};
