# AI Excel & Office Autopilot — Frontend MVP Final

Trang web ứng dụng hỗ trợ người dùng tự động hóa công việc văn phòng & xử lý dữ liệu Excel bằng trí tuệ nhân tạo (AI), sở hữu giao diện **Glassmorphism** tối giản, sang trọng đi kèm hiệu ứng chuyển động mượt mà và các tính năng tương tác phong phú.

Tài liệu này đánh dấu trạng thái **FRONTEND MVP FINAL — READY FOR BACKEND**, sẵn sàng chuyển giao cho kỹ sư Backend.

---

## 🌟 Định Vị & Tính Năng Sản Phẩm

Sản phẩm đã được nâng cấp toàn diện từ một prototype đơn giản thành giải pháp tự động hóa toàn diện: **AI Excel & Office Autopilot**. Không chỉ là chatbot, sản phẩm hỗ trợ:
* Rà soát lỗi dữ liệu (Email sai cú pháp, giá trị âm, lịch không hợp lệ).
* Đối soát chênh lệch số dư/giao dịch giữa hai bảng tính A và B.
* Sinh công thức Excel và viết mã VBA/Macro tự động, an toàn.
* Tự động hóa soạn thảo văn bản từ dữ liệu bảng tính.
* Tạo lập bảng dữ liệu theo mô tả tiếng Việt.

### 1. Landing Page (Trang chủ & Bảng giá)
* **Demo Tương Tác 6 Tabs**: Cho phép người dùng trải nghiệm nhanh cách hoạt động của AI (Tạo bảng từ mô tả, Tự nhập số liệu, Rà soát lỗi file, Sinh công thức, Viết VBA, Tạo báo cáo) kèm theo huy hiệu `DEMO MODE` và các nút sao chép kết quả.
* **Bảng Giá SaaS Tiers**: Tích hợp nút chuyển đổi chu kỳ thanh toán Tháng/Năm giảm 20%.

### 2. Workspace Người Dùng (User Workspace - 16 Tabs)
Tất cả 16 tabs được phân nhóm rõ ràng trên Sidebar:
1. **Tổng Quan (Dashboard)**: Thống kê nhanh lượt sử dụng, thời gian tiết kiệm, lối tắt và nhật ký hoạt động.
2. **AI Autopilot**: Trình tự động hóa công việc theo mục tiêu người dùng.
3. **AI Table Builder**: Tạo bảng cấu trúc từ mô tả tiếng Việt.
4. **AI Doc Builder**: Soạn thảo tài liệu văn phòng tự động.
5. **Sinh Công Thức (Formula Lab)**: Sinh công thức từ mô tả tiếng Việt kèm chạy thử.
6. **Viết VBA (VBA Writer)**: Sinh macro VBA định dạng và xử lý dữ liệu.
7. **Quản Lý Tệp (File Manager)**: Quản lý và xem trước tệp Excel/CSV.
8. **Rà Soát Lỗi (Data Checker)**: Quét lỗi định dạng trên tệp.
9. **Làm Sạch (Data Cleaning)**: Chuẩn hóa khoảng trắng, email, số điện thoại.
10. **Trợ Lý AI (Chatbot)**: Trò chuyện hỏi đáp sâu về file dữ liệu.
11. **Đối Soát (Reconciliation)**: So khớp dữ liệu chênh lệch giữa hai bảng tính.
12. **Báo Cáo (Reports)**: Lập biểu đồ trực quan hóa dữ liệu tự động.
13. **Mẫu Excel (Templates)**: Thư viện tệp mẫu theo ngành nghề.
14. **Lịch Sử (History)**: Nhật ký hoạt động chi tiết.
15. **Thanh Toán (Billing)**: Quản lý gói cước và mô phỏng thanh toán thẻ tín dụng.
16. **Cấu Hình (Settings)**: Thiết lập cấu hình Workspace.

### 3. Trang Quản Trị Hệ Thống (Admin Panel - 14 Tabs)
Trang quản trị toàn diện cho phép theo dõi doanh thu MRR, cấu hình System Prompts, kiểm tra nhật ký lỗi máy chủ, quản lý người dùng (Khóa/Mở khóa), quản lý feature flags và phân quyền.

---

## 🛠️ Kiến Trúc Frontend & Các Điểm Cần Lưu Ý

1. **Modular Service Layer (`/services`)**: Mọi logic tương tác của 16 tab người dùng và 14 tab admin đã được tách rời khỏi UI, trả về Promise kèm độ trễ **500 - 1200ms** giả lập kết nối API thật.
2. **Sửa Lỗi Runtime**: Rà soát và thêm null guards cho toàn bộ sự kiện click/input. Khắc phục triệt để lỗi console do thiếu các selector cũ đã bị xóa khỏi HTML.
3. **An Toàn Dữ Liệu**:
   - Tích hợp helper `escapeHTML` chống XSS khi hiển thị dữ liệu động từ tệp tin tải lên.
   - Giới hạn render preview bảng tính tối đa 100 dòng kèm cảnh báo chi tiết.
   - Định dạng API keys thành dạng an toàn `demo_key_` và che giấu (masking) khi hiển thị.
4. **Excel Add-in Connection**: Hỗ trợ Office.js SDK. Tự động hiển thị các nút nạp dữ liệu khi chạy trong môi trường Microsoft Excel thực tế.

---

## 📂 Tài Liệu Chuyển Giao Cho Backend Developer

Vui lòng tham khảo bộ 3 tài liệu bàn giao tại thư mục gốc để triển khai API:
1. **[API_CONTRACT.md](file:///H:/Trang%20web%20giao%20dien%20bot%20excel/API_CONTRACT.md)**: Đặc tả endpoints, request/response payload và error codes.
2. **[DATA_MODEL.md](file:///H:/Trang%20web%20giao%20dien%20bot%20excel/DATA_MODEL.md)**: Thiết kế mô hình cơ sở dữ liệu đề xuất.
3. **[FRONTEND_HANDOFF.md](file:///H:/Trang%20web%20giao%20dien%20bot%20excel/FRONTEND_HANDOFF.md)**: Hướng dẫn thay thế mock layer và lưu ý kỹ thuật.

---

## 🚀 Hướng Dẫn Khởi Chạy
Bạn có thể khởi chạy server demo bằng máy chủ cục bộ:
```bash
# Sử dụng Python http server
python -m http.server 8000

# Hoặc sử dụng Node serve / live-server
npx live-server
```
Truy cập ứng dụng tại `http://localhost:8000`.
