# API Contract - ExcelAI & Office Autopilot SaaS

Base URL local: `http://127.0.0.1:8002`

Protected APIs require:

```http
Authorization: Bearer <jwt>
```

Backend reloads user from PostgreSQL on every protected request. Client-sent role/tier/quota is never trusted.

## Response Codes

- `200`: success.
- `201`: created.
- `400`: invalid payload, sensitive field rejected, unsupported file.
- `401`: missing/invalid/expired token.
- `403`: no permission or feature unavailable on current plan.
- `404`: resource not found or resource belongs to another user.
- `413`: file size/row count exceeds plan.
- `422`: invalid state/tier or unsafe VBA blocked.
- `429`: usage/quota/rate limit reached.
- `500`: safe internal error message only.

## Auth

### `POST /api/auth/register`

Creates a normal user only:

- `role=user`
- `tier=free`
- `status=active`

Registering `admin150905@gmail.com` from web returns `403`.

### `POST /api/auth/login`

Returns JWT and user profile. Login is rate limited.

### `GET /api/auth/me`

Returns current user from DB.

### `POST /api/auth/logout`

Client clears token.

## Billing And Entitlements

### `GET /api/billing/pricing`

Returns pricing config and server-side entitlement config.

### `GET /api/billing/entitlements`

Returns `free/pro/business/enterprise` entitlement definitions.

### `GET /api/billing/tier`

Returns current tier, usage, usage limit, and entitlement for current user.

### `POST /api/billing/checkout`

Creates manual checkout request with `status=pending`. Does not update tier.

Request:

```json
{
  "tier": "pro",
  "billingCycle": "monthly",
  "couponCode": "OPTIONAL"
}
```

Sensitive fields like `role`, `status`, `owner_id`, `plan_id`, `ai_limit`, `usage_limit` are rejected.

### `GET /api/billing/checkout-requests`

Returns current user's manual checkout requests.

### `PUT /api/billing/tier`

Always `403` for users. Users cannot self-upgrade.

## Files

### `POST /api/files/upload`

Multipart field: `file`

Checks:

- owner is current user
- allowed extensions: `.csv`, `.xlsx`, `.xls`
- sanitized filename
- basic magic bytes
- max file count by plan
- max file size by plan
- max row count by plan
- parse failure stored as `status=failed`

### `GET /api/files`

Lists current user's files only.

### `GET /api/files/{file_id}/preview`

Returns preview if owner. User A reading User B's file returns `404`.

### `DELETE /api/files/{file_id}`

Deletes if owner. User A deleting User B's file returns `404`.

## AI

All AI routes go through backend entitlement/quota checks and `ai_usage_events`.

Routes:

- `POST /api/ai/chat`
- `POST /api/ai/chat/stream`
- `POST /api/ai/formula`
- `POST /api/ai/vba`
- `POST /api/ai/data-check`
- `POST /api/ai/clean`
- `POST /api/ai/reconcile`
- `POST /api/ai/autopilot`
- `POST /api/ai/table-builder`
- `POST /api/ai/doc-builder`

If feature unavailable:

```json
{
  "success": false,
  "message": "This feature is not available on your current plan."
}
```

If quota exceeded:

```json
{
  "success": false,
  "message": "Usage limit reached for your current plan."
}
```

Unsafe VBA returns `422`:

```json
{
  "success": false,
  "message": "Generated VBA contains potentially unsafe operations and was blocked."
}
```

## Exports

Output records are stored in `output_files`. Download checks ownership and never exposes raw storage path.

### `GET /api/exports`

Lists current user's generated outputs.

### `GET /api/exports/{output_id}/download`

Downloads output if owner. User A downloading User B's output returns `404`.

### `POST /api/exports/cleaned-xlsx`

Creates cleaned XLSX from a source file.

```json
{
  "fileId": "uuid",
  "rules": [{ "column": "email", "rule": "normalize_email" }],
  "fileName": "cleaned-data.xlsx"
}
```

### `POST /api/exports/reconciliation-xlsx`

Creates reconciliation report XLSX with `Summary` and `Details` sheets.

### `POST /api/exports/docx`

Creates real DOCX document.

### `POST /api/exports/table-xlsx`

Creates real XLSX from generated table.

### `POST /api/exports/pdf`

Creates basic PDF output. Requires `can_export_pdf`.

## Settings

### `GET /api/settings/workspace`

Current user's personal workspace settings.

### `PUT /api/settings/workspace`

Rejects sensitive fields such as `owner_id`, `workspace_id`, `workspace_role`, `role`, `tier`, `status`.

### `GET/PUT /api/settings/feature-flags`

Current user's feature flag settings. Sensitive fields rejected.

## Admin

Admin guard requires:

- `role=admin`
- `email=admin150905@gmail.com`

### `GET /api/admin/metrics`

Admin-only system metrics.

### `PUT /api/admin/billing/users/{user_id}/tier`

Admin-only tier update. Valid tiers:

- `free`
- `pro`
- `business`
- `enterprise`

Writes `billing_tier_audit` and `operation_logs`.

### `GET /api/admin/billing/checkout-requests`

Admin lists manual checkout requests.

### `PUT /api/admin/billing/checkout-requests/{id}/confirm`

Admin confirms manual payment, updates checkout to `confirmed`, changes tier through audit-safe admin path.

### `PUT /api/admin/billing/checkout-requests/{id}/reject`

Admin rejects manual checkout request.

### `GET /api/admin/dashboards/billing`

Revenue/billing dashboard.

### `GET /api/admin/dashboards/ai-cost`

AI cost/usage dashboard.

### `GET /api/admin/dashboards/files`

File processing dashboard.

### `GET /api/admin/dashboards/security`

Security/audit dashboard.

Other admin APIs include users, status, prompt config, security settings, pricing config, feature flags, logs, API keys, coupons, jobs, feedbacks, templates, broadcasts.

## Health

- `GET /api/health`
- `GET /api/health/ai`
- `GET /api/health/storage`

## Smoke Test

```powershell
$env:EXCELAI_ADMIN_TEST_PASSWORD="mat-khau-admin"
python -B backend\security_runtime_tests.py
```
