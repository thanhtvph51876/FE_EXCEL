from __future__ import annotations

from copy import deepcopy

from fastapi import HTTPException, status


ENTITLEMENTS: dict[str, dict] = {
    "free": {
        "max_files": 3,
        "max_file_size_mb": 5,
        "max_rows_per_file": 5000,
        "ai_requests_per_day": 20,
        "ai_requests_per_month": 100,
        "max_exports_per_month": 3,
        "can_use_chat": True,
        "can_use_formula": True,
        "can_use_vba": False,
        "can_use_data_check": True,
        "can_use_clean": True,
        "can_use_reconcile": False,
        "can_use_report_builder": False,
        "can_use_doc_builder": False,
        "can_export_docx": False,
        "can_export_xlsx": True,
        "can_export_pdf": False,
        "support_level": "community",
    },
    "pro": {
        "max_files": 50,
        "max_file_size_mb": 50,
        "max_rows_per_file": 50000,
        "ai_requests_per_day": 300,
        "ai_requests_per_month": 3000,
        "max_exports_per_month": 100,
        "can_use_chat": True,
        "can_use_formula": True,
        "can_use_vba": True,
        "can_use_data_check": True,
        "can_use_clean": True,
        "can_use_reconcile": True,
        "can_use_report_builder": True,
        "can_use_doc_builder": True,
        "can_export_docx": True,
        "can_export_xlsx": True,
        "can_export_pdf": False,
        "support_level": "email",
    },
    "business": {
        "max_files": 250,
        "max_file_size_mb": 100,
        "max_rows_per_file": 200000,
        "ai_requests_per_day": 1200,
        "ai_requests_per_month": 20000,
        "max_exports_per_month": 1000,
        "can_use_chat": True,
        "can_use_formula": True,
        "can_use_vba": True,
        "can_use_data_check": True,
        "can_use_clean": True,
        "can_use_reconcile": True,
        "can_use_report_builder": True,
        "can_use_doc_builder": True,
        "can_export_docx": True,
        "can_export_xlsx": True,
        "can_export_pdf": True,
        "support_level": "priority",
    },
    "enterprise": {
        "max_files": 99999,
        "max_file_size_mb": 200,
        "max_rows_per_file": 1000000,
        "ai_requests_per_day": 99999,
        "ai_requests_per_month": 999999,
        "max_exports_per_month": 99999,
        "can_use_chat": True,
        "can_use_formula": True,
        "can_use_vba": True,
        "can_use_data_check": True,
        "can_use_clean": True,
        "can_use_reconcile": True,
        "can_use_report_builder": True,
        "can_use_doc_builder": True,
        "can_export_docx": True,
        "can_export_xlsx": True,
        "can_export_pdf": True,
        "support_level": "dedicated",
    },
}


def tier_entitlement(tier: str | None) -> dict:
    return deepcopy(ENTITLEMENTS.get((tier or "free").strip().lower(), ENTITLEMENTS["free"]))


def require_entitlement(user: dict, capability: str) -> dict:
    entitlement = tier_entitlement(user.get("tier"))
    if not entitlement.get(capability):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This feature is not available on your current plan.",
        )
    return entitlement


def require_numeric_limit(user: dict, key: str, current_value: int) -> dict:
    entitlement = tier_entitlement(user.get("tier"))
    limit = int(entitlement.get(key) or 0)
    if current_value > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Usage limit reached for your current plan.",
        )
    return entitlement
