# Hướng Dẫn Bàn Giao Kỹ Thuật (Frontend Handoff Guide)

Tài liệu này hướng dẫn kỹ sư Backend cách đọc hiểu cấu trúc Frontend hiện tại và lộ trình từng bước để thay thế Mock Service Layer bằng API thật.

---

## 🏗️ 1. Kiến Trúc Frontend Hiện Tại

Ứng dụng là một trang đơn (**SPA - Single Page Application**) chạy hoàn toàn trên Client-side bằng JavaScript ES Modules:
* **`index.html`**: Chứa toàn bộ giao diện của Landing Page, User Workspace (16 tabs) và Admin Panel (14 tabs). Các tab được chuyển đổi bằng cách thêm/xóa class CSS `.active`.
* **`styles.css`**: Chứa toàn bộ hệ thống design system mờ ảo (Glassmorphism), biến CSS, responsive layouts, và animation.
* **`app.js`**: File điều phối trung tâm. Đăng ký sự kiện, quản lý trạng thái client (`state`), và kết nối các thành phần UI với Service Layer.
* **`services/`**: Thư mục chứa các module nghiệp vụ riêng biệt. Mỗi dịch vụ trả về một `Promise` với độ trễ (delay) giả lập **500 - 1200ms** kèm theo spinner loading trên giao diện để mô phỏng chính xác kết nối mạng.

---

## ⚡ 2. Cách Chuyển Đổi Sang API Thật (Replacing Mock Layer)

Toàn bộ các mock service đều nằm tập trung tại thư mục `services/`. Backend chỉ cần mở rộng các file này và thay thế các giá trị trả về tĩnh bằng phương thức `fetch()` hoặc `axios` gọi đến máy chủ.

### Ví dụ: Chuyển đổi Sinh Công Thức (`services/formulaService.js`)

**Trước (Mock):**
```javascript
export const formulaService = {
    generateFormula: (prompt, context, config) => {
        return {
            formula: "=SUMIFS(C:C, B:B, \"Kế toán\")",
            explanation: "Tính tổng dải ô C:C khi cột B:B bằng Kế toán."
        };
    }
};
```

**Sau khi kết nối API thật:**
```javascript
export const formulaService = {
    generateFormula: async (prompt, context) => {
        const response = await fetch('/api/ai/formula', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, context })
        });
        if (!response.ok) throw new Error("Lỗi máy chủ AI");
        return await response.json(); // Trả về { formula, explanation }
    }
};
```

---

## 📑 3. Điểm Cần Lưu Ý Khi Lập Trình Backend

### 1. Phân Tách Vai Trò (User vs Admin Roles)
* Hiện tại nút chuyển chế độ "User" / "Admin" ở góc header được viết hoàn toàn bằng JS (`showView('workspace')` / `showView('admin')`).
* Khi làm BE, hãy thay thế cơ chế này bằng **Session/JWT Role Check**. Nếu User không phải Admin, Server API phải chặn hoàn toàn các endpoint bắt đầu bằng `/api/admin/*`.

### 2. Giới Hạn Hiển Thị Bảng (Preview Row Limit)
* Đối với các tệp tin CSV lớn, Frontend chỉ kết xuất tối đa **100 dòng đầu tiên** lên bảng tính HTML để tránh đơ trình duyệt.
* **Backend cần phải**: Xử lý toàn bộ dữ liệu (tất cả dòng) trên RAM hoặc lưu database để vẽ biểu đồ và phân tích chất lượng, sau đó chỉ cắt mảng 100 dòng gửi về client kèm theo thuộc tính `totalRows`.

### 3. Xử Lý Tệp Tin Nhị Phân Excel (`.xlsx`)
* Frontend không thể đọc file Excel nhị phân trực tiếp bằng Javascript thuần.
* Hiện tại fileService sẽ chặn và báo lỗi nếu người dùng tải lên `.xlsx` (yêu cầu chuyển BE).
* **Backend cần**: Sử dụng các thư viện như `openpyxl` (Python) hoặc `exceljs` (Node) để parse dữ liệu Excel, chuyển thành định dạng JSON có cấu trúc gồm `headers` và `rows` rồi trả về cho client.

### 4. Che Giấu API Key (Masking)
* API Key hiển thị ở tab cấu hình developer được che giấu trên UI bằng định dạng `demo_key_xxxx...xxxx` ở client.
* Backend hãy bảo đảm giá trị API Key thực tế chỉ được gửi đầy đủ một lần duy nhất lúc tạo mới, các lần lấy danh sách sau đó bắt buộc phải che giấu từ SQL Query.

---

## 🛠️ 4. Checklist Tích Hợp Từng Bước Cho Backend Developer

- [ ] **Bước 1**: Thiết lập Cơ sở dữ liệu dựa theo [DATA_MODEL.md](file:///H:/Trang%20web%20giao%20dien%20bot%20excel/DATA_MODEL.md).
- [ ] **Bước 2**: Cài đặt API server và viết các router khớp với [API_CONTRACT.md](file:///H:/Trang%20web%20giao%20dien%20bot%20excel/API_CONTRACT.md).
- [ ] **Bước 3**: Cài đặt JWT/Auth và thay đổi flow đăng nhập tại `services/authService.js`.
- [ ] **Bước 4**: Tích hợp các LLM APIs (OpenAI, Gemini...) để thực thi xử lý Prompts tại `/api/ai/*`.
- [ ] **Bước 5**: Viết logic tính toán chênh lệch đối soát tệp A/B và trả về kết quả JSON cho tab Reconciliation.
- [ ] **Bước 6**: Thay thế các hàm trong `services/` bằng `fetch()` tương ứng và xóa bỏ tệp mock data `services/mockData.js`.
