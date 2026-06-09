import os
import sys
import time
import zipfile
from io import BytesIO
from pathlib import Path

import bcrypt
import httpx
import openpyxl
import psycopg2

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import settings  # noqa: E402
from routers.ai import _unsafe_vba_matches  # noqa: E402
from services.excel_service import escape_formula_injection  # noqa: E402


BASE_URL = os.getenv("EXCELAI_TEST_BASE_URL", "http://127.0.0.1:8002")
ADMIN_EMAIL = os.getenv("EXCELAI_ADMIN_EMAIL", "admin150905@gmail.com")
ADMIN_PASSWORD = os.getenv("EXCELAI_ADMIN_TEST_PASSWORD")


def fail(message: str) -> None:
    raise AssertionError(message)


def check(name: str, condition: bool, detail: str = "") -> None:
    print(("PASS" if condition else "FAIL"), name, detail)
    if not condition:
        fail(f"{name}: {detail}")


def make_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_user(cur, email: str, password: str, name: str = "Security Test User") -> str:
    cur.execute("DELETE FROM users WHERE email = %s", (email,))
    cur.execute(
        """
        INSERT INTO users (name, email, password_hash, tier, usage_count, usage_limit, status, role)
        VALUES (%s, %s, %s, 'free', 0, 20, 'active', 'user')
        RETURNING id
        """,
        (name, email, make_password_hash(password)),
    )
    return str(cur.fetchone()[0])


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def main() -> None:
    if not ADMIN_PASSWORD:
        fail("Set EXCELAI_ADMIN_TEST_PASSWORD before running this script.")

    suffix = str(int(time.time()))
    user_a_email = f"security-user-a-{suffix}@example.com"
    user_b_email = f"security-user-b-{suffix}@example.com"
    user_password = "Test123456"

    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    with conn.cursor() as cur:
        user_a_id = create_user(cur, user_a_email, user_password, "Security User A")
        user_b_id = create_user(cur, user_b_email, user_password, "Security User B")
        cur.execute(
            """
            INSERT INTO user_settings (user_id, key, value)
            VALUES (%s, 'workspace', %s)
            ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value
            """,
            (user_b_id, '{"workspaceName":"Workspace B Secret","retention":"30"}'),
        )
        cur.execute(
            """
            INSERT INTO files (user_id, name, path, size, row_count, col_count)
            VALUES (%s, 'b-secret.csv', 'security-test/missing-b-secret.csv', '1 KB', 1, 1)
            RETURNING id
            """,
            (user_b_id,),
        )
        user_b_file_id = str(cur.fetchone()[0])

    try:
        with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
            admin_login = client.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
            check("admin login", admin_login.status_code == 200, str(admin_login.status_code))
            admin_token = admin_login.json().get("token", "")

            user_a_login = client.post("/api/auth/login", json={"email": user_a_email, "password": user_password})
            check("user A login", user_a_login.status_code == 200, str(user_a_login.status_code))
            user_a_token = user_a_login.json().get("token", "")

            user_b_login = client.post("/api/auth/login", json={"email": user_b_email, "password": user_password})
            check("user B login", user_b_login.status_code == 200, str(user_b_login.status_code))
            user_b_token = user_b_login.json().get("token", "")
            user_b_refresh = user_b_login.json().get("refreshToken", "")

            admin_h = auth_headers(admin_token)
            user_a_h = auth_headers(user_a_token)
            user_b_h = auth_headers(user_b_token)

            res = client.post("/api/auth/refresh", json={"refreshToken": user_b_refresh})
            check("refresh token rotates session", res.status_code == 200 and res.json().get("token") and res.json().get("refreshToken") != user_b_refresh, res.text)
            old_user_b_h = user_b_h
            user_b_token = res.json().get("token", "")
            user_b_h = auth_headers(user_b_token)
            res = client.get("/api/auth/me", headers=old_user_b_h)
            check("old access token revoked after refresh rotation", res.status_code == 401, str(res.status_code))

            res = client.get("/api/health/ai")
            check("AI health endpoint is safe", res.status_code == 200 and res.json().get("provider") == "gemini", res.text)

            res = client.get("/metrics")
            check("prometheus metrics endpoint works", res.status_code == 200 and "excelai_http_requests_total" in res.text, res.text[:120])

            res = client.put("/api/billing/tier", headers=user_a_h, json={"tier": "enterprise"})
            check("user cannot self-update tier", res.status_code == 403, str(res.status_code))

            res = client.get("/api/billing/tier", headers=user_a_h)
            check("user can read own tier", res.status_code == 200 and res.json().get("tier") == "free", res.text)

            res = client.post("/api/billing/checkout", headers=user_a_h, json={"tier": "enterprise", "billingCycle": "monthly"})
            pending_checkout_id = res.json().get("checkoutRequest", {}).get("id") if res.status_code == 200 else ""
            check("checkout does not change tier", res.status_code == 200 and res.json().get("currentTier") == "free" and res.json().get("status") == "pending", res.text)

            res = client.post("/api/billing/checkout", headers=user_a_h, json={"tier": "pro", "owner_id": user_b_id})
            check("checkout rejects sensitive payload fields", res.status_code == 400, str(res.status_code))

            res = client.get("/api/admin/billing/checkout-requests", headers=admin_h)
            check("admin can list checkout requests", res.status_code == 200 and "checkoutRequests" in res.json(), res.text)

            res = client.put(f"/api/admin/billing/checkout-requests/{pending_checkout_id}/confirm", headers=user_a_h, json={"adminNote": "bad"})
            check("user cannot confirm checkout request", res.status_code == 403, str(res.status_code))

            res = client.put(
                "/api/settings/workspace",
                headers=user_a_h,
                json={"workspaceName": "Attempt", "retention": "30", "owner_id": user_b_id},
            )
            check("workspace rejects owner_id payload", res.status_code == 400, str(res.status_code))

            res = client.post("/api/workspaces", headers=user_b_h, json={"name": "Workspace B Runtime"})
            check("user B can create workspace", res.status_code == 201 and res.json().get("workspace", {}).get("id"), res.text)
            workspace_b_id = res.json()["workspace"]["id"]

            res = client.post(
                "/api/files/upload",
                headers=user_b_h,
                data={"workspace_id": workspace_b_id},
                files={"file": ("workspace-b.csv", b"name,amount\nAlpha,10\nBeta,20\n", "text/csv")},
            )
            check("workspace owner can upload workspace file", res.status_code == 201 and res.json().get("id"), res.text)
            workspace_b_file_id = res.json()["id"]

            res = client.post("/api/workspaces", headers=user_a_h, json={"name": "Bad Workspace", "owner_id": user_b_id})
            check("workspace create rejects owner_id payload", res.status_code == 400, str(res.status_code))

            res = client.get(f"/api/workspaces/{workspace_b_id}", headers=user_a_h)
            check("user A cannot read user B workspace", res.status_code == 404, str(res.status_code))

            res = client.get(f"/api/files/{workspace_b_file_id}/preview", headers=user_a_h)
            check("workspace non-member cannot read workspace file", res.status_code == 404, str(res.status_code))

            res = client.put(f"/api/workspaces/{workspace_b_id}", headers=user_a_h, json={"name": "Bad Edit"})
            check("user A cannot edit user B workspace", res.status_code == 404, str(res.status_code))

            res = client.delete(f"/api/workspaces/{workspace_b_id}", headers=user_a_h)
            check("user A cannot delete user B workspace", res.status_code == 404, str(res.status_code))

            res = client.post(f"/api/workspaces/{workspace_b_id}/members", headers=user_a_h, json={"email": user_a_email, "role": "viewer"})
            check("user cannot self-add to another workspace", res.status_code == 404, str(res.status_code))

            res = client.post(f"/api/workspaces/{workspace_b_id}/members", headers=user_b_h, json={"email": user_a_email, "role": "viewer"})
            check("owner can add viewer member", res.status_code == 201, res.text)

            res = client.get(f"/api/files/{workspace_b_file_id}/preview", headers=user_a_h)
            check("workspace viewer can read workspace file preview", res.status_code == 200 and res.json().get("id") == workspace_b_file_id, res.text)

            res = client.delete(f"/api/files/{workspace_b_file_id}", headers=user_a_h)
            check("workspace viewer cannot delete workspace file", res.status_code == 404, str(res.status_code))

            res = client.post(f"/api/workspaces/{workspace_b_id}/members", headers=user_a_h, json={"email": user_b_email, "role": "viewer"})
            check("viewer cannot add member", res.status_code == 403, str(res.status_code))

            res = client.put(f"/api/workspaces/{workspace_b_id}/members/{user_a_id}", headers=user_b_h, json={"role": "staff"})
            check("owner can change member to staff", res.status_code == 200, res.text)

            res = client.post(
                "/api/files/upload",
                headers=user_a_h,
                data={"workspace_id": workspace_b_id},
                files={"file": ("workspace-a-staff.csv", b"name,amount\nGamma,30\n", "text/csv")},
            )
            check("workspace staff can upload workspace file", res.status_code == 201 and res.json().get("id"), res.text)
            workspace_a_file_id = res.json()["id"]

            res = client.put(f"/api/workspaces/{workspace_b_id}/members/{user_a_id}", headers=user_a_h, json={"role": "admin"})
            check("staff cannot promote role to admin", res.status_code == 403, str(res.status_code))

            res = client.put(f"/api/workspaces/{workspace_b_id}/members/{user_a_id}", headers=user_b_h, json={"role": "manager"})
            check("owner can change member to manager", res.status_code == 200, res.text)

            res = client.delete(f"/api/files/{workspace_b_file_id}", headers=user_a_h)
            check("workspace manager can delete workspace file", res.status_code == 200, res.text)

            res = client.post(
                "/api/exports/cleaned-xlsx",
                headers=user_b_h,
                json={"fileId": workspace_a_file_id, "rules": [], "fileName": "workspace-output.xlsx"},
            )
            check("workspace owner can export from workspace file", res.status_code == 200 and res.json().get("output", {}).get("id"), res.text)
            workspace_output_id = res.json()["output"]["id"]

            res = client.get(f"/api/exports/{workspace_output_id}/download", headers=user_a_h)
            check("workspace member can download workspace output", res.status_code == 200, str(res.status_code))

            res = client.post("/api/jobs", headers=user_b_h, json={"type": "AI_CLEAN_DATA", "fileId": user_b_file_id, "payload": {"rule": "trim"}})
            check("user B can create personal job", res.status_code == 202 and res.json().get("job", {}).get("id"), res.text)
            user_b_job_id = res.json()["job"]["id"]

            res = client.get(f"/api/jobs/{user_b_job_id}", headers=user_a_h)
            check("user cannot read another user's personal job", res.status_code == 404, str(res.status_code))

            res = client.post("/api/jobs", headers=user_b_h, json={"type": "EXPORT_XLSX", "fileId": workspace_a_file_id, "payload": {}, "idempotencyKey": f"workspace-job-{suffix}"})
            check("workspace member owner can create workspace job", res.status_code == 202 and res.json().get("job", {}).get("id"), res.text)
            workspace_job_id = res.json()["job"]["id"]

            res = client.get(f"/api/jobs/{workspace_job_id}", headers=user_a_h)
            check("workspace member can read workspace job", res.status_code == 200, res.text)

            res = client.post(f"/api/jobs/{workspace_job_id}/cancel", headers=user_a_h)
            check("workspace manager can cancel workspace job", res.status_code == 200 and res.json().get("job", {}).get("status") == "cancelled", res.text)

            res = client.get("/api/settings/workspace", headers=user_a_h)
            check("user reads only own workspace", res.status_code == 200 and res.json().get("workspaceName") != "Workspace B Secret", res.text)

            res = client.get(f"/api/files/{user_b_file_id}/preview", headers=user_a_h)
            check("user cannot read another user's file", res.status_code == 404, str(res.status_code))

            res = client.delete(f"/api/files/{user_b_file_id}", headers=user_a_h)
            check("user cannot delete another user's file", res.status_code == 404, str(res.status_code))

            res = client.post("/api/ai/data-check", headers=user_a_h, json={"fileId": user_b_file_id})
            check("user cannot query AI on another user's file", res.status_code == 404, str(res.status_code))

            res = client.post("/api/ai/vba", headers=user_a_h, json={"prompt": "format header"})
            check("free user cannot use locked VBA feature", res.status_code == 403, str(res.status_code))

            res = client.post(
                "/api/files/upload",
                headers=user_a_h,
                files={"file": ("bad.txt", b"a,b\n1,2\n", "text/plain")},
            )
            check("upload rejects unsupported extension", res.status_code == 400, str(res.status_code))

            res = client.post(
                "/api/files/upload",
                headers=user_a_h,
                files={"file": ("fake.xlsx", b"not an xlsx file", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            )
            check("upload rejects bad xlsx magic bytes", res.status_code == 400, str(res.status_code))

            res = client.get("/api/admin/metrics", headers=user_a_h)
            check("user cannot access admin metrics", res.status_code == 403, str(res.status_code))

            res = client.get("/api/admin/metrics", headers=admin_h)
            check("admin can access admin metrics", res.status_code == 200, str(res.status_code))

            for dashboard_path in ("/api/admin/dashboards/billing", "/api/admin/dashboards/ai-cost", "/api/admin/dashboards/files", "/api/admin/dashboards/security"):
                res = client.get(dashboard_path, headers=admin_h)
                check(f"admin dashboard {dashboard_path}", res.status_code == 200, res.text)

            res = client.get("/api/admin/dashboards/ai-quality", headers=admin_h)
            check("admin AI quality dashboard works", res.status_code == 200, res.text)

            res = client.get("/api/admin/dashboards/business-metrics", headers=user_a_h)
            check("non-admin cannot access business metrics", res.status_code == 403, str(res.status_code))

            res = client.get("/api/admin/dashboards/business-metrics", headers=admin_h)
            check("admin can access persistent business metrics", res.status_code == 200 and "metrics" in res.json(), res.text)

            res = client.post("/api/billing/webhook/none", json={"id": f"evt_bad_{suffix}", "type": "payment_success", "data": {"user_id": user_a_id, "price_id": "price_enterprise"}})
            check("invalid/unconfigured webhook does not update tier", res.status_code == 403, str(res.status_code))

            res = client.post("/api/auth/register", json={"name": "Bad Admin", "email": ADMIN_EMAIL, "password": "Test123456"})
            check("admin email cannot register from web", res.status_code == 403, str(res.status_code))

            res = client.put(
                f"/api/admin/billing/users/{user_a_id}/tier",
                headers=admin_h,
                json={"tier": "pro", "reason": "security_runtime_test"},
            )
            check("admin can update tier", res.status_code == 200 and res.json().get("user", {}).get("tier") == "pro", res.text)

            res = client.post(
                "/api/files/upload",
                headers=user_a_h,
                files={"file": ("clean-source.csv", b"email,amount\n A@EXAMPLE.COM ,10\n=cmd,20\n", "text/csv")},
            )
            check("user can upload valid csv after upgrade", res.status_code == 201, res.text)
            user_a_file_id = res.json().get("id")

            res = client.post(
                "/api/exports/cleaned-xlsx",
                headers=user_a_h,
                json={"fileId": user_a_file_id, "rules": [{"column": "email", "rule": "normalize_email"}], "fileName": "cleaned-test.xlsx"},
            )
            check("export cleaned xlsx creates output", res.status_code == 200 and res.json().get("output", {}).get("id"), res.text)
            xlsx_output_id = res.json()["output"]["id"]

            res = client.get(f"/api/exports/{xlsx_output_id}/download", headers=user_a_h)
            check("download xlsx output owner", res.status_code == 200 and res.headers.get("content-type", "").startswith("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), str(res.status_code))
            workbook = openpyxl.load_workbook(BytesIO(res.content))
            check("xlsx output opens and has sheets", "Cleaned Data" in workbook.sheetnames)

            res = client.get(f"/api/exports/{xlsx_output_id}/download", headers=user_b_h)
            check("user cannot download another user's output", res.status_code == 404, str(res.status_code))

            res = client.post(
                "/api/exports/docx",
                headers=user_a_h,
                json={"title": "Security Test Report", "content": "Report body", "fileName": "security-test.docx"},
            )
            check("export docx creates output", res.status_code == 200 and res.json().get("output", {}).get("id"), res.text)
            docx_output_id = res.json()["output"]["id"]

            res = client.get(f"/api/exports/{docx_output_id}/download", headers=user_a_h)
            check("download docx output owner", res.status_code == 200 and res.headers.get("content-type", "").startswith("application/vnd.openxmlformats-officedocument.wordprocessingml.document"), str(res.status_code))
            with zipfile.ZipFile(BytesIO(res.content)) as docx_zip:
                check("docx output opens as office zip", "word/document.xml" in docx_zip.namelist())

            res = client.put(
                f"/api/admin/billing/users/{user_b_id}/tier",
                headers=admin_h,
                json={"tier": "business", "reason": "security_runtime_pdf_test"},
            )
            check("admin can update user B to business", res.status_code == 200 and res.json().get("user", {}).get("tier") == "business", res.text)

            res = client.post(
                "/api/exports/pdf",
                headers=user_b_h,
                json={"title": "Security PDF", "lines": ["Line one", "Line two"], "fileName": "security-test.pdf"},
            )
            check("business user can export pdf", res.status_code == 200 and res.json().get("output", {}).get("id"), res.text)
            pdf_output_id = res.json()["output"]["id"]

            res = client.get(f"/api/exports/{pdf_output_id}/download", headers=user_b_h)
            check("download pdf output owner", res.status_code == 200 and res.content.startswith(b"%PDF"), str(res.status_code))

            check("formula injection is escaped", escape_formula_injection("=IMPORTXML(\"http://x\")").startswith("'="))
            check("VBA unsafe operations are detected", "Shell" in _unsafe_vba_matches('Sub X()\nShell "cmd.exe"\nEnd Sub'))

            rate_statuses = [
                client.post("/api/auth/login", json={"email": f"rate-limit-{suffix}@example.com", "password": "bad"}).status_code
                for _ in range(4)
            ]
            check("login rate limit blocks repeated attempts", 429 in rate_statuses, str(rate_statuses))

        with psycopg2.connect(settings.database_url) as verify_conn:
            with verify_conn.cursor() as cur:
                cur.execute("SELECT tier FROM users WHERE id = %s", (user_a_id,))
                check("DB tier updated by admin", cur.fetchone()[0] == "pro")

                cur.execute(
                    """
                    SELECT target_user_email_snapshot, actor_email_snapshot, old_tier, new_tier, reason
                    FROM billing_tier_audit
                    WHERE target_user_id = %s
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    (user_a_id,),
                )
                audit = cur.fetchone()
                check(
                    "audit captures email snapshots",
                    bool(audit and audit[0] == user_a_email and audit[1] == ADMIN_EMAIL and audit[2] == "free" and audit[3] == "pro"),
                    str(audit),
                )

        conn = psycopg2.connect(settings.database_url)
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE id = %s", (user_a_id,))
            cur.execute(
                """
                SELECT target_user_id, target_user_email_snapshot
                FROM billing_tier_audit
                WHERE target_user_email_snapshot = %s
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (user_a_email,),
            )
            row = cur.fetchone()
            check("deleting user preserves billing audit", bool(row and row[0] is None and row[1] == user_a_email), str(row))

            cur.execute("SELECT COUNT(*) FROM users WHERE role <> 'admin' AND tier = 'enterprise'")
            check("no non-admin enterprise users", cur.fetchone()[0] == 0)
        conn.close()

        print("ALL_SECURITY_RUNTIME_TESTS_PASS")
    finally:
        cleanup = psycopg2.connect(settings.database_url)
        cleanup.autocommit = True
        with cleanup.cursor() as cur:
            cur.execute("DELETE FROM users WHERE email IN (%s, %s)", (user_a_email, user_b_email))
        cleanup.close()


if __name__ == "__main__":
    main()
