/* ==========================================================================
   EXCELAI BOT - FILE CHAT SERVICE (MOCK)
   ========================================================================== */

export const chatService = {
    askFile(fileObj, question) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const text = question.toLowerCase().trim();
                const fileName = fileObj ? fileObj.name : "dữ liệu mẫu";
                const rowCount = fileObj ? fileObj.rowCount : 120;
                
                let response = `Tôi đã đọc thành công tệp tin **${fileName}** (${rowCount} dòng).\n\nHãy cho tôi biết bạn muốn hỏi gì về tệp tin này (ví dụ: Tổng doanh thu, Mặt hàng bán chạy nhất, hoặc rà soát lỗi)?`;

                if (text.includes("tóm tắt") || text.includes("summary") || text.includes("đọc") || text.includes("file")) {
                    response = `### 📊 Tóm tắt cấu trúc tệp **${fileName}**
- **Quy mô**: ${rowCount} dòng dữ liệu, ${fileObj ? fileObj.colCount : 5} cột.
- **Trạng thái**: Dữ liệu ổn định. Phát hiện khoảng 3 ô trống và 1 dòng trùng.
- **Nhận xét AI**: Tập dữ liệu hoạt động ổn định, doanh số tập trung mạnh vào các tháng cuối quý. Các trường số liệu tài chính đã sẵn sàng làm báo cáo.`;
                } else if (text.includes("doanh thu") || text.includes("tiền") || text.includes("tổng") || text.includes("doanh số")) {
                    response = `### 💰 Phân tích tài chính / Doanh thu từ **${fileName}**
- **Tổng doanh thu dự kiến**: **189,500,000đ**
- **Nhóm đóng góp nhiều nhất**: Thiết bị điện tử (chiếm 48.5%).
- **Công thức tính tổng áp dụng**: \`=SUM(E2:E${rowCount+1})\`
- **Gợi ý**: Bạn có muốn tôi lập biểu đồ phân bổ doanh thu theo tháng cho bạn không?`;
                } else if (text.includes("lỗi") || text.includes("kiểm tra") || text.includes("checker") || text.includes("sai")) {
                    response = `### 🔍 Báo cáo kiểm lỗi nhanh cho **${fileName}**
- Tìm thấy **4 lỗi** tiềm ẩn.
- Cụ thể: 2 ô trống ở cột *Ngày Đến Hạn*, 1 dòng trùng lặp ở mã khách hàng *KH002*, và 1 số âm bất thường ở cột *Đơn Giá*.
- Bạn có thể chuyển sang tab **AI Data Checker** để tự động sửa nhanh các lỗi này.`;
                } else if (text.includes("top") || text.includes("cao nhất") || text.includes("khách hàng") || text.includes("bán chạy")) {
                    response = `### 🏆 Top 3 Chỉ số nổi bật từ **${fileName}**
1. **Khách hàng lớn nhất**: Công ty TNHH Minh Phong (Dư nợ: 150,000,000đ).
2. **Sản phẩm bán chạy nhất**: Tai nghe Sony WH-1000XM5.
3. **Khu vực tăng trưởng nhanh**: Hà Nội & TP. Hồ Chí Minh.`;
                }

                resolve({
                    answer: response,
                    summary: `Phân tích tệp ${fileName}`,
                    recommendedAction: "Xem báo cáo biểu đồ"
                });
            }, 900);
        });
    }
};

export default chatService;
