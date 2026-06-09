# ExcelAI & Office Autopilot SaaS Backend

FastAPI backend for the ExcelAI MVP. The current runtime uses PostgreSQL, JWT auth, bcrypt password hashing, local file storage, and Gemini as the AI provider.

## Stack

- FastAPI
- PostgreSQL / pgAdmin 4
- JWT with `sub` and `exp`
- bcrypt password hashing
- Gemini provider via `GEMINI_API_KEY`
- Local file storage via `LOCAL_STORAGE_DIR`

## Environment

Create `backend/.env`:

```env
FRONTEND_URL=http://localhost:5500
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
DB_HOST=localhost
DB_PORT=2005
DB_NAME=excelai
DB_USER=postgres
DB_PASSWORD=your-postgres-password
JWT_SECRET=change-this-secret
LOCAL_STORAGE_DIR=./storage
STORAGE_BUCKET=excel-files
```

`GEMINI_API_KEY` must start with `AIzaSy`. If it is missing or invalid, the backend still runs and `/api/health/ai` reports `degraded`.

## Run

```powershell
cd "H:\Trang web giao diện bot excel\backend"
..\backend\.venv\Scripts\Activate.ps1
python -m uvicorn main:app --host 127.0.0.1 --port 8002
```

On this Windows machine, avoid `--reload`.

## Database

Create database `excelai`, then run `backend/schema.sql` in pgAdmin Query Tool or with `psql`.

The runtime expects:

- `users.status`: `active`, `inactive`, `pending`, `suspended`, `deleted`
- `users.tier`: `free`, `pro`, `enterprise`
- one platform admin only: `admin150905@gmail.com`

## Health

```powershell
Invoke-RestMethod http://127.0.0.1:8002/api/health
Invoke-RestMethod http://127.0.0.1:8002/api/health/ai
```

## Auth And Roles

- Web registration always creates `role=user`, `tier=free`, `status=active`.
- `admin150905@gmail.com` cannot register from the public web form.
- Platform admin is only recognized when both are true:
  - `role=admin`
  - email is `admin150905@gmail.com`
- JWT is not the source of truth for role/tier/status; protected APIs always reload the user from PostgreSQL.

## Billing

User-facing billing is read/request only:

- `GET /api/billing/tier`
- `GET /api/billing/me`
- `POST /api/billing/checkout`
- `POST /api/billing/upgrade-request`

`PUT /api/billing/tier` intentionally returns `403`.

Admin tier changes use:

```text
PUT /api/admin/billing/users/{user_id}/tier
```

The backend validates tier and writes `billing_tier_audit` plus `operation_logs`.

Payment provider integration is not configured yet. Checkout requests do not update tier automatically.

## Workspace And Files

Workspace is currently personal workspace only, stored in `user_settings` by `user_id`; team/member roles are not implemented yet.

Files belong to `files.user_id`. User A accessing User B's file returns `404` for preview/delete/AI query.

Upload hardening:

- allowed extensions: `.csv`, `.xlsx`, `.xls`
- extension and basic magic-byte checks
- tier-based file size limits
- sanitized generated storage names
- parse failures are recorded as failed file metadata and return safe errors

## AI

All AI routes use shared quota logic and backend rate limits. Quota is stored in `ai_usage` by `user_id`, date, and feature.

Gemini errors return a safe client message:

```text
AI provider is temporarily unavailable.
```

Uploaded file content is treated as untrusted prompt data.

## Security Tests

Run the runtime smoke/security checks after the backend is running:

```powershell
$env:EXCELAI_ADMIN_TEST_PASSWORD="your-admin-password"
python -B backend\security_runtime_tests.py
```
