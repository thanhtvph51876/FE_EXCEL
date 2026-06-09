# Security Commitment

ExcelAI enforces backend-side RBAC, file ownership checks, billing tier controls, AI quota controls, and upload validation.

User files are scoped to their owner. User A cannot preview, delete, download, export, or query AI on User B's files.

Admin APIs require the platform admin policy: `role=admin` and email `admin150905@gmail.com`.

Generated VBA with dangerous operations such as shell execution, file deletion, PowerShell, or auto-open macros is blocked.
