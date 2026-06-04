# Bản Vẽ Mô Hình Dữ Liệu (Data Model Specification) — ExcelAI Bot

Tài liệu này đặc tả cấu trúc bảng (schema) và thực thể dữ liệu đề xuất cho Backend khi thiết lập cơ sở dữ liệu (PostgreSQL, MySQL, MongoDB...) để tương thích hoàn toàn với trạng thái ứng dụng trên Frontend.

---

## 👥 1. Thực thể: `User` (Người dùng)
Bảng lưu trữ thông tin tài khoản, cấp độ SaaS (Tiers), và giới hạn sử dụng.

| Tên trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL / INT | PK, Auto Increment | Khóa chính |
| `name` | VARCHAR(100) | NOT NULL | Họ và tên người dùng |
| `email` | VARCHAR(150) | UNIQUE, NOT NULL | Địa chỉ Email đăng nhập |
| `password_hash` | VARCHAR(255) | NOT NULL | Mật khẩu băm (bcrypt/argon2) |
| `tier` | VARCHAR(20) | NOT NULL, Default: 'free' | Gói dịch vụ: `free`, `pro`, `enterprise` |
| `usage_count` | INT | Default: 0 | Số lượt gọi API/Chat đã dùng trong chu kỳ |
| `usage_limit` | INT | Default: 20 | Giới hạn tối đa lượt dùng cho phép |
| `status` | VARCHAR(20) | Default: 'Hoạt động' | Trạng thái: `Hoạt động`, `Bị khóa` |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP| Ngày đăng ký |

---

## 📂 2. Thực thể: `File` (Tệp dữ liệu tải lên)
Bảng lưu trữ siêu dữ liệu (metadata) của các tệp Excel/CSV mà người dùng đã tải lên. Dữ liệu tệp thực tế được lưu trên Object Storage (S3, Cloud Storage).

| Tên trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID / VARCHAR(50)| PK | Mã định danh tệp tin |
| `user_id` | INT | FK -> `User(id)` | Người sở hữu tệp |
| `name` | VARCHAR(255) | NOT NULL | Tên tệp gốc (ví dụ: `sales_2026.csv`) |
| `path` | VARCHAR(500) | NOT NULL | Đường dẫn lưu trữ vật lý trên Cloud |
| `size` | VARCHAR(50) | | Dung lượng tệp tin (ví dụ: `24.5 KB`) |
| `row_count` | INT | | Tổng số dòng dữ liệu thực tế |
| `col_count` | INT | | Tổng số cột dữ liệu |
| `uploaded_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP| Thời điểm tải lên |

---

## 💬 3. Thực thể: `ChatThread` & `ChatMessage` (Hội thoại AI)
Hỗ trợ lưu trữ lịch sử chat của người dùng với trợ lý AI.

### 3.1. Bảng `ChatThread`
| Tên trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(50) | PK | Mã định danh phòng chat |
| `user_id` | INT | FK -> `User(id)` | Người sở hữu cuộc hội thoại |
| `title` | VARCHAR(150) | | Tiêu đề cuộc hội thoại (tự sinh từ tin đầu) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP| Ngày khởi tạo |

### 3.2. Bảng `ChatMessage`
| Tên trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL / INT | PK | Mã tin nhắn |
| `thread_id` | VARCHAR(50) | FK -> `ChatThread(id)` | Thuộc phòng chat nào |
| `sender` | VARCHAR(10) | NOT NULL | Người gửi: `bot` hoặc `user` |
| `text` | TEXT | NOT NULL | Nội dung tin nhắn (hỗ trợ markdown/code) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP| Thời điểm gửi |

---

## 📜 4. Thực thể: `OperationLog` (Nhật ký thao tác - Audit Log)
Lưu trữ lịch sử hành động người dùng thao tác trên workspace để hiển thị tại Dashboard và phục vụ Audit.

| Tên trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL / INT | PK | Khóa chính |
| `user_id` | INT | FK -> `User(id)` | Người thực hiện |
| `type` | VARCHAR(30) | NOT NULL | Phân loại: `file`, `formula`, `vba`, `payment` |
| `action` | VARCHAR(255) | NOT NULL | Mô tả hành động (ví dụ: `Tải lên file sales.csv`) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP| Thời điểm thực hiện |

---

## 🔑 5. Thực thể: `ApiKey` (Khóa kết nối Developer)
Bảng quản lý các Token API do người dùng tự sinh để tích hợp ứng dụng bên ngoài.

| Tên trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL / INT | PK | Khóa chính |
| `user_id` | INT | FK -> `User(id)` | Chủ sở hữu khóa |
| `label` | VARCHAR(100) | NOT NULL | Nhãn gợi nhớ (ví dụ: `Key kiểm thử kho`) |
| `token` | VARCHAR(100) | UNIQUE, NOT NULL | Giá trị key (che giấu đầu/cuôi trên UI) |
| `status` | VARCHAR(20) | Default: 'Hoạt động' | Trạng thái: `Hoạt động`, `Đã thu hồi` |
| `usage_data` | JSON / TEXT | | Lưu mảng số lượng gọi API theo ngày |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP| Ngày sinh khóa |
