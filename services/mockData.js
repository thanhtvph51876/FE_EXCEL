/* ==========================================================================
   EXCELAI BOT - MOCK DATABASE SYSTEM
   ========================================================================== */

export const initialUsers = [
    { id: 1, name: "Trần Minh Trí", email: "trinh@excelai.com", tier: "free", usageCount: 12, usageLimit: 20, status: "Hoạt động", registeredAt: "01/05/2026" },
    { id: 2, name: "Nguyễn Văn Hùng", email: "hungnv@gmail.com", tier: "pro", usageCount: 148, usageLimit: 500, status: "Hoạt động", registeredAt: "12/05/2026" },
    { id: 3, name: "Lê Thị Mai", email: "maile@outlook.com", tier: "enterprise", usageCount: 924, usageLimit: Infinity, status: "Hoạt động", registeredAt: "18/05/2026" },
    { id: 4, name: "Phạm Minh Tuấn", email: "tuanpm@yahoo.com", tier: "free", usageCount: 20, usageLimit: 20, status: "Hoạt động", registeredAt: "24/05/2026" },
    { id: 5, name: "Hoàng Gia Bảo", email: "baohg@company.com", tier: "free", usageCount: 2, usageLimit: 20, status: "Đã khóa", registeredAt: "28/05/2026" }
];

export const initialCoupons = [
    { code: "EXCEL50", percent: 50 },
    { code: "FREEPRO", percent: 100 },
    { code: "AI30", percent: 30 }
];

export const initialApiKeys = [
    { id: 1, label: "Excel Macro Home", key: "demo_key_ex9872a9118f3d51cc", status: "Hoạt động", created: "01/06/2026", usage: [12, 18, 22, 15, 29, 32, 24] },
    { id: 2, label: "Office Production Server", key: "demo_key_ex2f93a1188ba922ef", status: "Hoạt động", created: "03/06/2026", usage: [89, 120, 140, 110, 134, 152, 148] }
];

export const initialPromptConfig = {
    systemPrompt: "Bạn là trợ lý ExcelAI Bot chuyên nghiệp của hệ thống ExcelAI. Nhiệm vụ của bạn là giải đáp thắc mắc của người dùng về Excel, Google Sheets, VBA một cách ngắn gọn, súc tích và có ví dụ đi kèm rõ ràng. Định dạng công thức trong khối code `=FORMULA()` và code VBA trong khối code ```vba ... ```.",
    freeLimit: 20,
    formulaPrompt: "Hãy tạo công thức Excel tối ưu nhất cho yêu cầu này. Hãy luôn giải thích chi tiết ý nghĩa từng đối số và cung cấp ví dụ mẫu.",
    vbaPrompt: "Hãy tạo mã Macro VBA Excel chuẩn hóa, có chú thích chi tiết bằng tiếng Việt trong từng dòng lệnh. Luôn sử dụng cú pháp sạch, xử lý lỗi và thụt lề chuẩn. Lưu ý: viết đúng từ khóa `End Sub` (không viết dính liền).",
    analysisPrompt: "Hãy đóng vai trò là chuyên gia phân tích dữ liệu, tóm tắt tệp Excel này, chỉ ra các dòng bất thường (anomalies), dữ liệu bị thiếu hoặc trùng lặp, và gợi ý hướng xử lý tiếp theo.",
    checkerPrompt: "Hãy đóng vai trò chuyên gia kiểm toán dữ liệu. Rà soát file Excel, tìm các ô trống (missing), dòng trùng (duplicates), sai định dạng ngày tháng/email, dữ liệu số âm bất thường, và đề xuất cách sửa chi tiết từng dòng.",
    cleanerPrompt: "Chỉ dẫn AI làm sạch dữ liệu. Hướng dẫn người dùng chuẩn hóa định dạng, xóa khoảng trắng thừa, viết hoa đầu từ, điền giá trị còn thiếu theo quy chuẩn.",
    reconciliationPrompt: "Chỉ dẫn AI đối soát 2 bảng dữ liệu A và B. So khớp các giao dịch dựa trên mã đơn hàng khóa chính, tìm ra chênh lệch về tiền, số lượng hoặc trạng thái giữa hai bảng.",
    reportPrompt: "Chỉ dẫn AI xây dựng báo cáo. Tổng hợp các chỉ số tài chính/vận hành, tính toán tỷ lệ tăng trưởng, đề xuất 3 biểu đồ chính kèm theo các nhận định kinh doanh quan trọng."
};

export const initialSystemLogs = [
    { time: "09:05:12", type: "success", text: "API Call: User 'Lê Thị Mai' generated VBA Macro - 142 tokens" },
    { time: "09:10:01", type: "success", text: "API Call: User 'Nguyễn Văn Hùng' parsed sales_report.csv - 892 tokens" },
    { time: "09:11:00", type: "warning", text: "Limit Alert: User 'Phạm Minh Tuấn' reached Free tier limit (20/20)" },
    { time: "09:15:33", type: "success", text: "Data Check: User 'Trần Minh Trí' executed AI Data Checker on data_sales_2026.csv" }
];

export const initialTemplates = [
    { id: "t1", name: "Báo cáo Thu Chi Nội Bộ", category: "kế toán", description: "Tự động hóa sổ quỹ tiền mặt, tính toán số dư tồn quỹ và báo cáo tổng hợp theo tháng.", file: "Bao_cao_thu_chi_ExcelAI.xlsx", icon: "📊", color: "success" },
    { id: "t2", name: "Bảng Lương & KPI Nhân Viên", category: "nhân sự", description: "Tự động hóa tính lương theo ngày công, hệ số và đánh giá KPI điểm thưởng.", file: "Bang_luong_KPI_ExcelAI.xlsx", icon: "👥", color: "accent" },
    { id: "t3", name: "Tiến Độ Dự Án Gantt Chart", category: "quản lý", description: "Trực quan hóa tiến độ công việc, lập lịch ngày bắt đầu và thanh tiến độ hoàn thành tự động.", file: "Tien_do_Gantt_ExcelAI.xlsx", icon: "📅", color: "purple" },
    { id: "t4", name: "Quản Lý Báo Cáo Tồn Kho", category: "tồn kho", description: "Theo dõi nhập xuất tồn, cảnh báo số lượng dưới hạn định mức tối thiểu tự động.", file: "Bao_cao_ton_kho_ExcelAI.xlsx", icon: "📦", color: "success" },
    { id: "t5", name: "Báo Cáo Bán Hàng Tuần/Tháng", category: "bán hàng", description: "Phân tích doanh số theo nhân viên, mặt hàng chủ lực và vẽ biểu đồ hiệu suất trực quan.", file: "Sales_Report_ExcelAI.xlsx", icon: "📈", color: "accent" }
];

export const initialJobs = [
    { id: "j1", fileName: "data_sales_2026.csv", owner: "Trần Minh Trí", size: "1.2 MB", type: "data_check", status: "ready", duration: "1.2s", error: "" },
    { id: "j2", fileName: "employee_attendance.xlsx", owner: "Nguyễn Văn Hùng", size: "4.8 MB", type: "cleaning", status: "ready", duration: "2.5s", error: "" },
    { id: "j3", fileName: "reconcile_bank_invoice.xlsx", owner: "Lê Thị Mai", size: "12.4 MB", type: "reconciliation", status: "failed", duration: "0.5s", error: "File exceeds Business maximum size limit (10MB)" }
];

export const initialFeedbacks = [
    { id: 1, userName: "Nguyễn Văn Hùng", type: "Bug", text: "Lỗi dính chữ EndSub ở file VBA đã sinh. Đã sửa tay lại được nhưng AI nên sửa.", status: "resolved", reply: "Cảm ơn bạn đã phản hồi. Chúng tôi đã cập nhật prompt hệ thống viết đúng End Sub." },
    { id: 2, userName: "Lê Thị Mai", type: "Feature request", text: "Tôi muốn thêm tính năng đối soát so sánh dữ liệu giữa 2 sheet hoặc 2 file Excel.", status: "resolved", reply: "Chào chị Mai. Tính năng đối soát (Reconciliation) đã được cập nhật thành công lên bản MVP!" },
    { id: 3, userName: "Phạm Minh Tuấn", type: "Wrong AI answer", text: "Hàm SUMIFS sinh ra bị thiếu dấu ngoặc kép ở điều kiện lọc. Vui lòng kiểm tra lại prompt.", status: "new", reply: "" }
];
