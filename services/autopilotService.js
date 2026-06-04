/* ==========================================================================
   EXCELAI BOT - AI AUTOPILOT SERVICE (MOCK)
   ========================================================================== */

export const autopilotService = {
    generatePlan(goal, outputs = [], files = []) {
        const goalLower = goal.toLowerCase();
        
        let plan = {
            understanding: `Tự động hóa tác vụ: "${goal}" sử dụng các công nghệ AI nâng cao.`,
            steps: [],
            requiredInputs: ["Yêu cầu nghiệp vụ bằng tiếng Việt"],
            expectedOutputs: [],
            previewType: "excel", // "excel", "document", "errors"
            previewData: null
        };

        if (files.length > 0) {
            plan.requiredInputs.push(`Tệp tin nguồn: ${files.join(", ")}`);
        }

        // 1. Debt (Công nợ) Scenario
        if (goalLower.includes("công nợ") || goalLower.includes("phải thu") || goalLower.includes("phải trả")) {
            plan.understanding = "Tự động thiết lập hệ thống theo dõi và đối chiếu công nợ khách hàng/nhà cung cấp.";
            plan.steps = [
                { num: 1, title: "Phân tích cấu trúc bảng công nợ", desc: "Xác định các trường thông tin cốt lõi (Mã KH, Tên KH, Số HĐ, Phải thu, Đã thu, Ngày đến hạn).", status: "completed" },
                { num: 2, title: "Thiết lập công thức tính toán", desc: "Tự động tạo công thức cột [Còn lại = Phải thu - Đã thu] và cột [Trạng thái = IF(Còn lại>0, 'Chưa thu', 'Đã thu')].", status: "completed" },
                { num: 3, title: "Kiểm tra dữ liệu & Cảnh báo hạn nợ", desc: "Quét và phát hiện các dòng thiếu thông tin ngày đến hạn hoặc số hóa đơn trùng lặp.", status: "pending" },
                { num: 4, title: "Dựng biểu đồ công nợ quá hạn", desc: "Vẽ đồ thị cột hiển thị dư nợ lớn nhất của các khách hàng để gửi báo cáo.", status: "pending" }
            ];
            plan.expectedOutputs = ["Bảng quản lý công nợ (XLSX)", "Báo cáo phân tích công nợ quá hạn (PDF)"];
            plan.previewType = "excel";
            plan.previewData = {
                headers: ["Mã KH", "Tên Khách Hàng", "Số HĐ", "Phải Thu", "Đã Thu", "Còn Lại", "Ngày Đến Hạn", "Trạng Thái"],
                rows: [
                    ["KH001", "Công ty TNHH Minh Phong", "HD-2026-01", "150,000,000", "50,000,000", "100,000,000", "15/06/2026", "Chưa thu"],
                    ["KH002", "Tập đoàn Đại Nam", "HD-2026-02", "80,000,000", "80,000,000", "0", "10/06/2026", "Đã thu"],
                    ["KH003", "Doanh nghiệp Tư nhân Tiến Phát", "HD-2026-03", "200,000,000", "50,000,000", "150,000,000", "28/05/2026", "Quá hạn"],
                    ["KH004", "Thương mại dịch vụ Khánh An", "HD-2026-04", "120,000,000", "120,000,000", "0", "01/06/2026", "Đã thu"],
                    ["KH005", "Công ty Cổ phần Sao Mai", "HD-2026-05", "90,000,000", "20,000,000", "70,000,000", "12/06/2026", "Chưa thu"]
                ]
            };
        } 
        // 2. Salary/Payroll (Bảng lương) Scenario
        else if (goalLower.includes("lương") || goalLower.includes("nhân sự") || goalLower.includes("chấm công")) {
            plan.understanding = "Tự động xây dựng bảng tính lương nhân sự, tính thuế TNCN và thực lĩnh dựa trên dữ liệu chấm công.";
            plan.steps = [
                { num: 1, title: "Khởi tạo thông tin nhân viên", desc: "Map danh sách nhân sự từ file chấm công nguồn (Mã NV, Họ tên, Bộ phận, Lương cơ bản).", status: "completed" },
                { num: 2, title: "Tính toán ngày công & Phụ cấp", desc: "Áp dụng công thức tính phụ cấp ăn trưa, phụ cấp trách nhiệm và quy đổi ngày công làm việc thực tế.", status: "completed" },
                { num: 3, title: "Khấu trừ bảo hiểm & Thuế", desc: "Tự động áp dụng công thức bảo hiểm bắt buộc (10.5%) và biểu thuế lũy tiến TNCN.", status: "pending" },
                { num: 4, title: "Lập phiếu lương (Payslip) tự động", desc: "Thiết kế biểu mẫu phiếu lương để sẵn sàng gửi email hàng loạt cho nhân viên.", status: "pending" }
            ];
            plan.expectedOutputs = ["Bảng lương nhân sự tổng hợp (XLSX)", "Mẫu Phiếu lương nhân viên (DOCX)"];
            plan.previewType = "excel";
            plan.previewData = {
                headers: ["Mã NV", "Họ và Tên", "Bộ Phận", "Lương Cơ Bản", "Ngày Công", "Phụ Cấp", "Bảo Hiểm (10.5%)", "Thực Lĩnh"],
                rows: [
                    ["NV01", "Nguyễn Văn Hùng", "Kỹ thuật", "18,000,000", "24", "1,500,000", "1,890,000", "17,610,000"],
                    ["NV02", "Lê Thị Mai", "Kinh doanh", "12,000,000", "26", "3,000,000", "1,260,000", "13,740,000"],
                    ["NV03", "Trần Minh Trí", "Nhân sự", "15,000,000", "22", "1,200,000", "1,575,000", "14,625,000"],
                    ["NV04", "Phạm Văn Long", "Kinh doanh", "10,000,000", "25", "2,500,000", "1,050,000", "11,450,000"]
                ]
            };
        }
        // 3. Report/Written Report Scenario
        else if (goalLower.includes("báo cáo") || goalLower.includes("văn bản") || goalLower.includes("tờ trình") || goalLower.includes("email")) {
            plan.understanding = "Tự động phân tích dữ liệu nguồn và soạn thảo văn bản/email báo cáo hành chính chuyên nghiệp.";
            plan.steps = [
                { num: 1, title: "Tổng hợp dữ liệu số liệu thô", desc: "Đọc dữ liệu từ tệp tin tải lên, tổng hợp doanh số, chi phí và tỷ lệ tăng trưởng.", status: "completed" },
                { num: 2, title: "Viết tóm tắt nhận định AI", desc: "Phát hiện các điểm sáng doanh số hoặc các khu vực chi tiêu bất thường cần lưu ý.", status: "completed" },
                { num: 3, title: "Dựng khung văn bản mẫu", desc: "Tạo cấu trúc báo cáo gửi cấp trên với ngôn phong trang trọng, chuẩn mực văn phòng.", status: "pending" },
                { num: 4, title: "Đề xuất email thông báo kèm theo", desc: "Soạn thảo nội dung email ngắn gọn để gửi đính kèm file báo cáo này.", status: "pending" }
            ];
            plan.expectedOutputs = ["Báo cáo phân tích gửi Ban Giám Đốc (DOCX)", "Mẫu Email đính kèm (TXT)"];
            plan.previewType = "document";
            plan.previewData = {
                title: "BÁO CÁO PHÂN TÍCH KẾT QUẢ HOẠT ĐỘNG (DỰ THẢO AUTOPILOT)",
                content: `Kính gửi: Ban Giám đốc Công ty,\n\nDựa trên dữ liệu hoạt động tổng hợp, bộ phận Phân tích dữ liệu AI xin báo cáo kết quả sơ bộ như sau:\n\n1. KẾT QUẢ ĐẠT ĐƯỢC:\n- Tổng doanh thu đạt mức tăng trưởng 12.5% so với cùng kỳ.\n- Các chỉ số chi phí vận hành được tối ưu hóa tốt, giảm 5.4% nhờ cắt giảm quy trình thủ công.\n\n2. CÁC ĐIỂM CẦN LƯU Ý (CẢNH BÁO AI):\n- Tồn kho của nhóm hàng điện tử đang ở mức cao (vượt 20% định mức an toàn).\n- Có 3 khách hàng lớn có công nợ quá hạn quá 30 ngày cần đối soát thu hồi.\n\nKính trình Ban Giám đốc xem xét và cho ý kiến chỉ đạo.\n\nTrân trọng cảm ơn.`
            };
        }
        // 4. Default / Generic Scenario
        else {
            plan.understanding = "Thiết lập quy trình xử lý dữ liệu và tạo bảng Excel thông minh từ mô tả yêu cầu.";
            plan.steps = [
                { num: 1, title: "Phân tích yêu cầu tự động", desc: "Phân tích từ khóa nghiệp vụ trong mô tả để thiết lập cấu trúc trường.", status: "completed" },
                { num: 2, title: "Dựng lưới dữ liệu thô", desc: "Khởi tạo bảng mẫu với các cột logic tương ứng và chèn dữ liệu test.", status: "completed" },
                { num: 3, title: "Bổ sung công thức & Tối ưu", desc: "Tự động thiết lập các công thức SUM, AVERAGE, IF cơ bản để tự động hóa tính toán.", status: "pending" }
            ];
            plan.expectedOutputs = ["Bảng tính kết quả tự động (XLSX)"];
            plan.previewType = "excel";
            plan.previewData = {
                headers: ["STT", "Tên Chỉ Tiêu", "Giá Trị Định Mức", "Thực Tế Đạt Được", "Tỷ Lệ Hoàn Thành", "Ghi Chú"],
                rows: [
                    ["1", "Chỉ tiêu doanh số nhóm A", "100,000,000", "105,000,000", "105%", "Đạt mục tiêu"],
                    ["2", "Chỉ tiêu doanh số nhóm B", "150,000,000", "135,000,000", "90%", "Cần thúc đẩy"],
                    ["3", "Tỷ lệ khách hàng hài lòng", "95%", "97%", "102%", "Xuất sắc"]
                ]
            };
        }

        return plan;
    }
};
