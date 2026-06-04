/* ==========================================================================
   EXCELAI BOT - AI DOCUMENT BUILDER SERVICE (MOCK)
   ========================================================================== */

export const documentBuilderService = {
    generateDocument(type, facts, fileData = null, tone = "chuyên nghiệp") {
        let title = "Văn bản được tạo bởi AI";
        let content = "";
        let factsUsed = [];
        let checks = [];

        const typeLower = type.toLowerCase();
        
        // Formulate source data description
        let sourceDesc = "Dữ liệu nhập tay của người dùng.";
        if (fileData) {
            sourceDesc = `Phân tích từ tệp tin '${fileData.name}' (${fileData.rowCount} dòng).`;
            factsUsed.push(`Tổng số lượng bản ghi: ${fileData.rowCount} hàng`);
        }
        
        if (facts) {
            factsUsed.push(`Dữ kiện đi kèm: "${facts.length > 50 ? facts.substring(0, 50) + "..." : facts}"`);
        }

        // 1. Revenue Report
        if (typeLower.includes("doanh thu") || typeLower.includes("sales")) {
            title = "BÁO CÁO PHÂN TÍCH DOANH THU KINH DOANH";
            content = `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
---
Hà Nội, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm 2026

BÁO CÁO KẾT QUẢ DOANH THU HOẠT ĐỘNG KINH DOANH

Kính gửi: Ban Giám Đốc và các Trưởng bộ phận,

Dựa trên dữ liệu nguồn tổng kết doanh thu kinh doanh thực tế của kỳ, bộ phận phân tích dữ liệu xin báo cáo cụ thể như sau:

1. ĐÁNH GIÁ CHUNG:
- Kết quả doanh số đạt mức độ tăng trưởng khả quan so với kế hoạch ban đầu nhờ tập trung đẩy mạnh chuyển đổi số và các chương trình bán lẻ.
- Doanh thu ghi nhận sự phân bổ đồng đều ở các nhóm ngành hàng chính, không bị phụ thuộc quá nhiều vào một đại lý đơn lẻ.

2. CÁC PHÂN TÍCH TRỌNG TÂM:
- Nhóm mặt hàng chủ lực đạt 108% so với định mức KPI đề ra.
- Chi phí chiết khấu bán hàng phát sinh ở mức 4.5% trên tổng doanh thu (đảm bảo mục tiêu dưới ngưỡng 5.0%).

3. ĐỀ XUẤT HÀNH ĐỘNG KẾ TIẾP:
- Tăng cường ngân sách truyền thông cho nhóm sản phẩm đang có biên lợi nhuận cao.
- Triển khai rà soát các hợp đồng đại lý cấp 2 có dư nợ công nợ vượt hạn để đảm bảo dòng tiền lành mạnh.

Người lập báo cáo,
Trợ lý AI Autopilot`;
            checks = [
                "Xác thực lại tỷ lệ phần trăm chiết khấu thực tế trong bảng phụ lục.",
                "Đảm bảo các đại lý cấp 2 được nhắc đến đã nhận thông báo công nợ."
            ];
        } 
        // 2. HR Report
        else if (typeLower.includes("nhân sự") || typeLower.includes("hr") || typeLower.includes("lương")) {
            title = "BÁO CÁO TỔNG HỢP BIẾN ĐỘNG NHÂN SỰ & QUỸ LƯƠNG";
            content = `BÁO CÁO NỘI BỘ VỀ BIẾN ĐỘNG NHÂN SỰ VÀ QUỸ LƯƠNG KỲ Q2/2026

Kính gửi: Bộ phận Hành chính Nhân sự và Ban Giám Đốc,

Tôi xin tóm tắt các nội dung quan trọng liên quan đến tình hình biến động lao động và chi trả quỹ lương trong kỳ báo cáo:

1. VỀ QUY MÔ NHÂN SỰ:
- Tổng số lượng nhân viên hoạt động chính thức ghi nhận biến động nhẹ ở khối Sales và Kỹ thuật do nhu cầu tuyển dụng bổ sung dự án mới.
- Tỷ lệ nghỉ việc (Turnover rate) được kiểm soát ở mức 2.8% (thấp hơn mục tiêu trần 5%).

2. VỀ CHI PHÍ LƯƠNG BỔNG & BẢO HIỂM:
- Quỹ lương thực chi tăng 3.2% do điều chỉnh lương thâm niên và các khoản thưởng quý.
- Các khoản chi bảo hiểm y tế, bảo hiểm xã hội đã được trích nộp đầy đủ theo quy định của pháp luật hiện hành.

3. ĐỀ XUẤT CỦA BỘ PHẬN NHÂN SỰ:
- Đẩy nhanh tiến độ tuyển dụng 3 vị trí Kỹ sư cấp cao để kịp tiến độ bàn giao sản phẩm.
- Lên kế hoạch đào tạo nội bộ định kỳ về an toàn thông tin cho toàn văn phòng.

Trân trọng trình duyệt.`;
            checks = [
                "Đối soát số lượng nhân viên thực tế với bảng chấm công gốc trước khi gửi sếp.",
                "Đảm bảo các khoản trích thưởng quý đã khớp số liệu tài chính."
            ];
        }
        // 3. Email to Boss
        else if (typeLower.includes("sếp") || typeLower.includes("boss") || typeLower.includes("email")) {
            title = "EMAIL GỬI BAN GIÁM ĐỐC / CẤP TRÊN";
            content = `Tiêu đề Email: [Báo cáo] Tóm tắt kết quả phân tích số liệu vận hành kỳ này

Kính gửi Anh/Chị,

Em xin gửi anh/chị nội dung tóm tắt kết quả xử lý và phân tích số liệu vận hành tệp dữ liệu hoạt động vừa qua:

1. Kết quả tổng hợp nhanh:
- Dữ liệu thô sau khi được rà soát và làm sạch đã loại bỏ được các lỗi trùng lặp và thiếu thông tin.
- Các chỉ số hiệu suất chung vẫn đang bám sát biểu đồ tăng trưởng đề ra từ đầu quý.

2. Đề xuất kiến nghị:
- Hiện tại có một vài điểm bất thường nhỏ ở tiến độ chi tiêu ngân sách tiếp thị (đang hơi vượt hạn mức 8%). Em đề xuất làm việc lại với đội ngũ Marketing để điều chỉnh.
- Chi tiết bảng tính đã được em làm sạch và tải lên thư mục chung. Anh/chị vui lòng xem tệp đính kèm để biết thêm chi tiết.

Em xin kính trình anh/chị xem xét phê duyệt.

Trân trọng,
[Tên nhân viên]`;
            checks = [
                "Thay đổi [Tên nhân viên] bằng tên thật của bạn ở dòng ký tên cuối cùng.",
                "Kiểm tra lại số tiền marketing vượt hạn xem có đúng là 8% không."
            ];
        }
        // 4. Default / Generic Memo
        else {
            title = "BIÊN BẢN / TỜ TRÌNH PHÂN TÍCH TỔNG HỢP";
            content = `TỜ TRÌNH KIẾN NGHỊ VỀ VIỆC XỬ LÝ SỐ LIỆU VÀ CẢI TIẾN QUY TRÌNH

Kính gửi: Thủ trưởng đơn vị,

Căn cứ vào yêu cầu rà soát và tối ưu hóa hiệu suất làm việc văn phòng, trợ lý AI xin đề xuất phương án cải tiến như sau:

- Nội dung nghiệp vụ: ${facts || "Chưa cung cấp thông tin mô tả chi tiết."}
- Nguồn số liệu áp dụng: ${sourceDesc}

Phương án thực hiện:
1. Áp dụng chuẩn hóa toàn bộ dữ liệu Excel thô qua AI Data Cleaner để ngăn ngừa lỗi định dạng.
2. Thiết lập quy chuẩn báo cáo tuần tự động thay thế cho công tác nhập tay thủ công trước đây.

Kính mong nhận được ý kiến phê duyệt của cấp trên.

Người trình bày,
Đội ngũ Dự án`;
            checks = [
                "Điền thêm các dữ kiện bổ sung để nội dung được cụ thể hóa hơn.",
                "In ấn hoặc xuất PDF để làm tài liệu lưu hành nội bộ."
            ];
        }

        // Adjust content tone visually
        if (tone === "ngắn gọn") {
            content = content.split("\n\n").slice(0, 3).join("\n\n") + "\n\n(Bản rút gọn chi tiết theo yêu cầu)";
        } else if (tone === "dễ hiểu") {
            content = "💡 [Bản diễn giải bình dân dễ hiểu]\n\n" + content.replace(/định mức KPI/g, "mục tiêu công việc").replace(/vận hành/g, "hoạt động hàng ngày");
        }

        return {
            title,
            content,
            factsUsed,
            checks
        };
    }
};
