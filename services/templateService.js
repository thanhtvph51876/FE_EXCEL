/* ==========================================================================
   EXCELAI BOT - SPREADSHEET TEMPLATES SERVICE (MOCK)
   ========================================================================== */

import { initialTemplates } from './mockData.js';

export const templateService = {
    listTemplates() {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(initialTemplates);
            }, 500);
        });
    },

    useTemplate(templateId) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const found = initialTemplates.find(t => t.id === templateId);
                if (found) {
                    // Define custom schema matching template
                    let mockSheet = {
                        name: found.file,
                        headers: ["STT", "Chỉ tiêu", "Định mức", "Thực tế", "Tỷ lệ hoàn thành"],
                        rows: [
                            ["1", "Chỉ tiêu doanh số nhóm A", "100,000,000", "105,000,000", "105%"],
                            ["2", "Chỉ tiêu doanh số nhóm B", "150,000,000", "135,000,000", "90%"],
                            ["3", "Tỷ lệ khách hàng hài lòng", "95%", "97%", "102%"]
                        ]
                    };

                    if (templateId === "t1") {
                        mockSheet.headers = ["Ngày", "Nội dung giao dịch", "Số tiền Thu", "Số tiền Chi", "Số dư Tồn"];
                        mockSheet.rows = [
                            ["01/06/2026", "Số dư tồn quỹ đầu kỳ", "50,000,000", "0", "50,000,000"],
                            ["02/06/2026", "Thu tiền bán hàng đại lý A", "120,000,000", "0", "170,000,000"],
                            ["03/06/2026", "Chi thanh toán hóa đơn tiền điện", "0", "8,500,000", "161,500,000"],
                            ["04/06/2026", "Tạm ứng chi phí đi công tác phòng Kinh Doanh", "0", "15,000,000", "146,500,000"]
                        ];
                    } else if (templateId === "t2") {
                        mockSheet.headers = ["Mã NV", "Họ và Tên", "Lương cứng", "Ngày công thực tế", "Thực nhận"];
                        mockSheet.rows = [
                            ["NV001", "Nguyễn Văn Hùng", "18,000,000", "24", "16,615,385"],
                            ["NV002", "Lê Thị Mai", "12,000,000", "26", "12,000,000"],
                            ["NV003", "Trần Văn Việt", "15,000,000", "22", "12,692,308"]
                        ];
                    } else if (templateId === "t4") {
                        mockSheet.headers = ["Mã Vật Tư", "Tên Hàng Hóa", "Đơn Vị Tính", "Tồn Đầu Kỳ", "Nhập Kho", "Xuất Kho", "Tồn Cuối Kỳ"];
                        mockSheet.rows = [
                            ["VT001", "Sắt cuộn Phi 8", "Tấn", "50", "30", "65", "15"],
                            ["VT002", "Xi măng Hà Tiên", "Bao", "200", "150", "340", "10"],
                            ["VT003", "Gạch ống Tuynel", "Viên", "10,000", "5,000", "4,000", "11,000"]
                        ];
                    }

                    resolve({
                        template: found,
                        mockSheet
                    });
                } else {
                    reject("Mẫu biểu không tồn tại!");
                }
            }, 600);
        });
    }
};

export default templateService;
