# ExcelAI & Office Autopilot SaaS

ExcelAI & Office Autopilot SaaS giúp người dùng xử lý Excel/CSV bằng AI theo 3 workflow có giá trị thương mại:

- **Clean Data**: upload file, rà lỗi dữ liệu, chọn rule làm sạch, export XLSX thật.
- **Reconcile**: đối soát 2 file/sheet theo key và cột giá trị, export báo cáo XLSX thật.
- **Report/Document Builder**: tạo báo cáo hoặc văn bản có cấu trúc, export DOCX/PDF cơ bản.

Các module phụ vẫn giữ: Formula Lab, VBA Writer, Chat with file, Table Builder, Templates, History, Billing và Admin Panel.

## Stack

- Frontend: static HTML/CSS/ES module JavaScript.
- Backend: FastAPI.
- Database: PostgreSQL/pgAdmin 4.
- Auth: bcrypt + JWT.
- AI provider: Gemini.
- Storage: local file storage trong MVP.
- Excel output: `openpyxl`.
- DOCX/PDF output: backend-generated Office/PDF files.

## Cấu Trúc

```text
.
├── index.html, app.js, styles.css
├── services/
├── docs/
├── backend/
│   ├── main.py
│   ├── routers/
│   ├── services/
│   ├── entitlements.py
│   ├── auth_policy.py
│   ├── schema.sql
│   └── security_runtime_tests.py
└── API_CONTRACT.md
```

## Environment

`backend/.env`:

```env
ENVIRONMENT=development
FRONTEND_URL=http://localhost:5500
CORS_ORIGINS=http://localhost:5500,http://127.0.0.1:5500

DATABASE_URL=
DB_HOST=localhost
DB_PORT=2005
DB_NAME=excelai
DB_USER=postgres
DB_PASSWORD=your-postgres-password

JWT_SECRET=change-this-secret
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-2.5-flash

STORAGE_BACKEND=local
LOCAL_STORAGE_DIR=./storage
STORAGE_BUCKET=excel-files

PAYMENT_MANUAL_ENABLED=true
```

## Chạy Local

Backend:

```powershell
cd "H:\Trang web giao diện bot excel\backend"
.\.venv\Scripts\Activate.ps1
python -m uvicorn main:app --host 127.0.0.1 --port 8002
```

Trên Windows máy này nên tránh `--reload`.

Frontend:

```powershell
cd "H:\Trang web giao diện bot excel"
python -m http.server 5500
```

Mở `http://localhost:5500`.

## Database

Tạo database `excelai`, sau đó chạy `backend/schema.sql`. Schema hiện có:

- `users`
- `files`
- `output_files`
- `checkout_requests`
- `ai_usage`
- `ai_usage_events`
- `billing_tier_audit`
- `operation_logs`
- settings/admin/support tables

Admin tổng chỉ hợp lệ khi:

- `email = admin150905@gmail.com`
- `role = admin`

## Entitlement Theo Gói

Config server-side nằm ở `backend/entitlements.py`, gồm:

- `free`
- `pro`
- `business`
- `enterprise`

Backend kiểm tra quyền tính năng và quota, không tin client gửi tier/quota. User thường không thể tự nâng gói. `PUT /api/billing/tier` trả `403`.

## Payment Manual

MVP hiện dùng manual checkout:

1. User chọn gói.
2. Backend tạo `checkout_requests.status=pending`.
3. User thấy hướng dẫn thanh toán/liên hệ admin.
4. Admin xác nhận bằng API admin.
5. Backend đổi tier qua admin path, ghi `billing_tier_audit` và `operation_logs`.

Chưa có payment provider/webhook tự động. Không tự động nâng tier nếu chưa verify chữ ký provider thật.

## Export Output Thật

Backend tạo và lưu output trong `output_files`:

- Clean Data -> XLSX thật.
- Reconcile -> XLSX thật, sheet `Summary` và `Details`.
- Document Builder -> DOCX thật.
- PDF -> PDF cơ bản.

Download output luôn check owner, không trả raw storage path.

## Health

```powershell
Invoke-RestMethod http://127.0.0.1:8002/api/health
Invoke-RestMethod http://127.0.0.1:8002/api/health/ai
Invoke-RestMethod http://127.0.0.1:8002/api/health/storage
```

## Smoke Test

```powershell
$env:EXCELAI_ADMIN_TEST_PASSWORD="mat-khau-admin"
python -B backend\security_runtime_tests.py
```

Script kiểm tra auth/RBAC, billing tier, manual checkout, file ownership, export XLSX/DOCX, upload hardening, entitlement, VBA safety, audit và log.

## Backup/Restore

PostgreSQL backup:

```powershell
pg_dump -h 127.0.0.1 -p 2005 -U postgres -d excelai -Fc -f excelai.backup
```

Restore test:

```powershell
createdb -h 127.0.0.1 -p 2005 -U postgres excelai_restore_test
pg_restore -h 127.0.0.1 -p 2005 -U postgres -d excelai_restore_test excelai.backup
```

File storage backup: copy toàn bộ `backend/storage/` sang vị trí backup định kỳ. Khi production, nên dùng object storage và kiểm thử restore cả DB lẫn file output.

## Production Notes

- Đổi `JWT_SECRET`.
- Cấu hình `CORS_ORIGINS` theo domain thật, không dùng `*`.
- Bật backup DB/storage.
- Không log password/token/API key/full prompt/file content.
- Workspace hiện là personal workspace, chưa phải team/member thật.
- Có thể thêm Alembic migration structure ở phase deployment chính thức.
