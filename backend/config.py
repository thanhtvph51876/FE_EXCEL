import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import List

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env", encoding="utf-8-sig")

DEFAULT_JWT_SECRET = "excelai-local-dev-secret-change-me"
PLACEHOLDER_JWT_SECRETS = {DEFAULT_JWT_SECRET, "change_this_to_a_long_random_secret", "changeme", "secret"}


@dataclass(frozen=True)
class Settings:
    database_provider: str = "postgres"
    database_url_env: str = os.getenv("DATABASE_URL", "")
    db_host: str = os.getenv("DB_HOST", "localhost")
    db_port: str = os.getenv("DB_PORT", "5432")
    db_name: str = os.getenv("DB_NAME", "excelai")
    db_user: str = os.getenv("DB_USER", "postgres")
    db_password: str = os.getenv("DB_PASSWORD", "")
    db_pool_min: int = int(os.getenv("DB_POOL_MIN", "5"))
    db_pool_max: int = int(os.getenv("DB_POOL_MAX", "100"))
    jwt_secret: str = os.getenv("JWT_SECRET", "")
    access_token_minutes: int = int(os.getenv("ACCESS_TOKEN_MINUTES", "60"))
    refresh_token_days: int = int(os.getenv("REFRESH_TOKEN_DAYS", "30"))
    local_storage_dir: str = os.getenv("LOCAL_STORAGE_DIR", str(BASE_DIR / "storage"))
    storage_backend: str = os.getenv("STORAGE_BACKEND", "local")
    storage_region: str = os.getenv("STORAGE_REGION", "")
    storage_access_key: str = os.getenv("STORAGE_ACCESS_KEY", "")
    storage_secret_key: str = os.getenv("STORAGE_SECRET_KEY", "")
    storage_endpoint_url: str = os.getenv("STORAGE_ENDPOINT_URL", "")
    signed_url_expires_seconds: int = int(os.getenv("SIGNED_URL_EXPIRES_SECONDS", "300"))
    enable_virus_scan: str = os.getenv("ENABLE_VIRUS_SCAN", "false")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    gemini_max_concurrency: int = int(os.getenv("GEMINI_MAX_CONCURRENCY", "24"))
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    cors_extra_origins: str = os.getenv("CORS_ORIGINS", os.getenv("CORS_EXTRA_ORIGINS", ""))
    trusted_proxy_ips: str = os.getenv("TRUSTED_PROXY_IPS", "")
    storage_bucket: str = os.getenv("STORAGE_BUCKET", "excel-files")
    environment: str = os.getenv("ENVIRONMENT", "development")
    payment_manual_enabled: str = os.getenv("PAYMENT_MANUAL_ENABLED", "true")
    payment_mode: str = os.getenv("PAYMENT_MODE", "manual")
    payment_provider: str = os.getenv("PAYMENT_PROVIDER", "none")
    payment_webhook_secret: str = os.getenv("PAYMENT_WEBHOOK_SECRET", "")
    payment_price_tier_map: str = os.getenv("PAYMENT_PRICE_TIER_MAP", "{}")
    app_base_url: str = os.getenv("APP_BASE_URL", os.getenv("FRONTEND_URL", "http://localhost:3000"))
    webhook_base_url: str = os.getenv("WEBHOOK_BASE_URL", "")
    payos_client_id: str = os.getenv("PAYOS_CLIENT_ID", "")
    payos_api_key: str = os.getenv("PAYOS_API_KEY", "")
    payos_checksum_key: str = os.getenv("PAYOS_CHECKSUM_KEY", "")
    vnpay_tmn_code: str = os.getenv("VNPAY_TMN_CODE", "")
    vnpay_hash_secret: str = os.getenv("VNPAY_HASH_SECRET", "")
    vnpay_payment_url: str = os.getenv("VNPAY_PAYMENT_URL", "")
    vnpay_return_url: str = os.getenv("VNPAY_RETURN_URL", "")
    vnpay_ipn_url: str = os.getenv("VNPAY_IPN_URL", "")
    momo_partner_code: str = os.getenv("MOMO_PARTNER_CODE", "")
    momo_access_key: str = os.getenv("MOMO_ACCESS_KEY", "")
    momo_secret_key: str = os.getenv("MOMO_SECRET_KEY", "")
    momo_endpoint: str = os.getenv("MOMO_ENDPOINT", "")
    momo_redirect_url: str = os.getenv("MOMO_REDIRECT_URL", "")
    momo_ipn_url: str = os.getenv("MOMO_IPN_URL", "")
    stripe_secret_key: str = os.getenv("STRIPE_SECRET_KEY", "")
    stripe_webhook_secret: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    stripe_success_url: str = os.getenv("STRIPE_SUCCESS_URL", "")
    stripe_cancel_url: str = os.getenv("STRIPE_CANCEL_URL", "")
    google_client_id: str = os.getenv("GOOGLE_CLIENT_ID", "")
    password_reset_minutes: int = int(os.getenv("PASSWORD_RESET_MINUTES", "30"))
    expose_dev_reset_token: bool = os.getenv("EXPOSE_DEV_RESET_TOKEN", "false").lower() == "true"
    account_lock_minutes: int = int(os.getenv("ACCOUNT_LOCK_MINUTES", "15"))
    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_username: str = os.getenv("SMTP_USERNAME", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    smtp_from_email: str = os.getenv("SMTP_FROM_EMAIL", os.getenv("SMTP_USERNAME", ""))
    smtp_from_name: str = os.getenv("SMTP_FROM_NAME", "ExcelAI")

    @property
    def smtp_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_username and self.smtp_password and self.smtp_from_email)

    @property
    def database_url(self) -> str:
        if self.database_url_env:
            return self.database_url_env
        if not self.db_password:
            return ""
        return f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

    @property
    def cors_origins(self) -> List[str]:
        defaults = {self.frontend_url}
        if self.environment.lower() != "production":
            defaults |= {
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:5500",
                "http://127.0.0.1:5500",
                "http://localhost:8000",
                "http://127.0.0.1:8000",
                "http://localhost:8001",
                "http://127.0.0.1:8001",
                "http://localhost:8002",
                "http://127.0.0.1:8002",
                "null",
            }
        extras = {item.strip() for item in self.cors_extra_origins.split(",") if item.strip()}
        return sorted(origin for origin in defaults | extras if origin)

    @property
    def cors_origin_regex(self) -> str | None:
        if self.environment.lower() == "production":
            return None
        return r"https?://(localhost|127\.0\.0\.1)(:\d+)?"

    @property
    def trusted_proxy_ip_set(self) -> set[str]:
        return {item.strip() for item in self.trusted_proxy_ips.split(",") if item.strip()}

    def validate(self) -> None:
        missing = []
        if not self.database_url:
            missing.append("DATABASE_URL")
        if not self.jwt_secret or self.jwt_secret.strip().lower() in PLACEHOLDER_JWT_SECRETS or len(self.jwt_secret) < 32:
            raise RuntimeError("JWT_SECRET must be set to a strong non-default value (32+ chars).")
        if self.environment.lower() == "production" and not self.cors_extra_origins:
            raise RuntimeError("CORS_ORIGINS must be explicitly set in production.")
        if not self.gemini_api_key:
            missing.append("GEMINI_API_KEY")
        elif not self.gemini_api_key.startswith("AIzaSy"):
            print("WARNING: GEMINI_API_KEY looks invalid. It should start with 'AIzaSy'.")
        if missing:
            print(f"WARNING: Missing configuration: {', '.join(missing)}")


@lru_cache
def get_settings() -> Settings:
    value = Settings()
    value.validate()
    return value


settings = get_settings()
