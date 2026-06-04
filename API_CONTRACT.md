# Hợp Đồng API (API Contract) — ExcelAI & Office Autopilot

Tài liệu này định nghĩa các điểm kết nối (endpoints) HTTP RESTful mà Backend cần triển khai để tích hợp với Frontend ExcelAI & Office Autopilot. Tất cả dữ liệu truyền nhận sử dụng định dạng JSON.

---

## 🔐 1. Xác thực & Phân quyền (Authentication)

### 1.1. Đăng nhập (Mock Auth Session)
* **Endpoint**: `/api/auth/login`
* **Method**: `POST`
* **Request Body**:
  ```json
  {
    "email": "trinh@excelai.com",
    "password": "hashed_password"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "token": "jwt_session_token_here",
    "user": {
      "id": 1,
      "name": "Trần Minh Trí",
      "email": "trinh@excelai.com",
      "tier": "free",
      "usageCount": 12,
      "usageLimit": 20,
      "status": "Hoạt động"
    }
  }
  ```

### 1.2. Đăng xuất
* **Endpoint**: `/api/auth/logout`
* **Method**: `POST`
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Đăng xuất thành công"
  }
  ```

---

## 📂 2. Quản lý Tệp tin (File Management)

### 2.1. Tải lên tệp (Excel/CSV)
* **Endpoint**: `/api/files/upload`
* **Method**: `POST`
* **Content-Type**: `multipart/form-data`
* **Request Body**: File binary (Excel/CSV)
* **Success Response (201 Created)**:
  ```json
  {
    "id": "file_uuid_123",
    "name": "orders.csv",
    "size": "45.2 KB",
    "rowCount": 1420,
    "colCount": 12,
    "uploadedAt": "2026-06-04T13:49:33Z"
  }
  ```

### 2.2. Xem trước tệp (Giới hạn tối đa 100 dòng trên Frontend)
* **Endpoint**: `/api/files/:id/preview`
* **Method**: `GET`
* **Success Response (200 OK)**:
  ```json
  {
    "id": "file_uuid_123",
    "name": "orders.csv",
    "headers": ["Mã đơn", "Ngày mua", "Sản phẩm", "Doanh thu"],
    "rows": [
      ["OD001", "2026-01-01", "Màn hình Dell", "4500000"],
      ["OD002", "2026-01-02", "Bàn phím cơ", "1200000"]
    ],
    "totalRows": 1420
  }
  ```

### 2.3. Xóa tệp
* **Endpoint**: `/api/files/:id`
* **Method**: `DELETE`
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Đã xóa tệp thành công"
  }
  ```

---

## 🤖 3. Các chức năng AI & Autopilot

### 3.1. Rà soát lỗi dữ liệu (Data Quality Checker)
* **Endpoint**: `/api/ai/data-check`
* **Method**: `POST`
* **Request Body**:
  ```json
  {
    "fileId": "file_uuid_123"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "healthScore": 85.5,
    "scannedRows": 100,
    "errors": [
      { "row": 14, "column": "Email", "value": "tri_gmail.com", "issue": "Lỗi định dạng Email thiếu '@'" },
      { "row": 35, "column": "Số lượng", "value": "-20", "issue": "Lỗi Outlier: Giá trị âm bất thường" }
    ]
  }
  ```

### 3.2. Làm sạch dữ liệu (Data Cleaning)
* **Endpoint**: `/api/ai/clean`
* **Method**: `POST`
* **Request Body**:
  ```json
  {
    "fileId": "file_uuid_123",
    "column": "Số điện thoại",
    "rule": "phone"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "formula": "=SUBSTITUTE(SUBSTITUTE(A2, \" \", \"\"), \"+84\", \"0\")",
    "previewRows": [
      { "original": "+84 987 654 321", "cleaned": "0987654321" }
    ]
  }
  ```

### 3.3. Đối soát dữ liệu (Reconciliation)
* **Endpoint**: `/api/ai/reconcile`
* **Method**: `POST`
* **Request Body**:
  ```json
  {
    "fileAId": "file_uuid_a",
    "fileBId": "file_uuid_b",
    "keyA": "Mã GD",
    "keyB": "Mã GD",
    "valA": "Số tiền",
    "valB": "Số tiền"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "summary": {
      "matched": 1250,
      "mismatched": 12,
      "missingA": 3,
      "missingB": 5
    },
    "discrepancies": [
      { "key": "GD_9987", "valA": 5000000, "valB": 4850000, "reason": "Chênh lệch số tiền giao dịch" }
    ],
    "aiNarrative": "Hệ thống phát hiện 12 giao dịch lệch tiền..."
  }
  ```

### 3.4. Sinh công thức Excel
* **Endpoint**: `/api/ai/formula`
* **Method**: `POST`
* **Request Body**:
  ```json
  {
    "prompt": "Tính tổng tiền cột C nếu phòng ban ở cột B là Kế toán",
    "context": "chung"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "formula": "=SUMIFS(C:C, B:B, \"Kế toán\")",
    "explanation": "Tính tổng dải ô C:C khi cột B:B bằng \"Kế toán\""
  }
  ```

### 3.5. Viết mã VBA / Macro
* **Endpoint**: `/api/ai/vba`
* **Method**: `POST`
* **Request Body**:
  ```json
  {
    "prompt": "Định dạng in đậm tiêu đề dòng 1 màu xanh lá cây"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "code": "Sub FormatHeader()\n  With Range(\"A1:G1\")\n    .Font.Bold = True\n    .Interior.Color = RGB(16, 124, 65)\n  End With\nEnd Sub",
    "explanation": "Mã lệnh định dạng dòng tiêu đề xanh lá cây..."
  }
  ```

---

## 📈 4. Quản trị hệ thống (Admin APIs)

### 4.1. Lấy chỉ số tổng quan (System Dashboard)
* **Endpoint**: `/api/admin/metrics`
* **Method**: `GET`
* **Success Response (200 OK)**:
  ```json
  {
    "mrr": 59800000,
    "totalUsers": 2420,
    "uptime": "99.98%",
    "apiRequestsCount": 18240
  }
  ```

### 4.2. Cập nhật gói dịch vụ người dùng
* **Endpoint**: `/api/admin/users/:id/tier`
* **Method**: `PUT`
* **Request Body**:
  ```json
  {
    "tier": "pro"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "user": {
      "id": 1,
      "tier": "pro"
    }
  }
  ```

---

## 🚨 5. Các mã lỗi chung (Standard Error Codes)
Hệ thống API trả về định dạng chuẩn khi gặp lỗi:
* **JSON Schema**:
  ```json
  {
    "success": false,
    "errorCode": "INVALID_FILE_TYPE",
    "message": "Tệp tin tải lên không đúng định dạng Excel/CSV."
  }
  ```
* **HTTP Status Codes**:
  - `400 Bad Request`: Payload không hợp lệ.
  - `401 Unauthorized`: Token xác thực bị thiếu hoặc hết hạn.
  - `403 Forbidden`: Tài khoản bị khóa hoặc không đủ quyền truy cập (ví dụ: gói Free gọi API Pro).
  - `413 Payload Too Large`: Dòng dữ liệu tải lên vượt quá giới hạn hệ thống.
  - `500 Internal Server Error`: Lỗi máy chủ xử lý AI.
