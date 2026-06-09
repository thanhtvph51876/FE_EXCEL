import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import List

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env", encoding="utf-8-sig")


@dataclass(frozen=True)
class Settings:
    database_provider: str = "postgres"
    database_url_env: str = os.getenv("DATABASE_URL", "")
    db_host: str = os.getenv("DB_HOST", "localhost")
    db_port: str = os.getenv("DB_PORT", "5432")
    db_name: str = os.getenv("DB_NAME", "excelai")
    db_user: str = os.getenv("DB_USER", "postgres")
    db_password: str = os.getenv("DB_PASSWORD", "")
    jwt_secret: str = os.getenv("JWT_SECRET", "excelai-local-dev-secret-change-me")
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
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    cors_extra_origins: str = os.getenv("CORS_ORIGINS", os.getenv("CORS_EXTRA_ORIGINS", ""))
    storage_bucket: str = os.getenv("STORAGE_BUCKET", "excel-files")
    environment: str = os.getenv("ENVIRONMENT", "development")
    payment_manual_enabled: str = os.getenv("PAYMENT_MANUAL_ENABLED", "true")
    payment_mode: str = os.getenv("PAYMENT_MODE", "manual")
    payment_provider: str = os.getenv("PAYMENT_PROVIDER", "none")
    payment_webhook_secret: str = os.getenv("PAYMENT_WEBHOOK_SECRET", "")
    payment_price_tier_map: str = os.getenv("PAYMENT_PRICE_TIER_MAP", "{}")

    @property
    def database_url(self) -> str:
        if self.database_url_env:
            return self.database_url_env
        if not self.db_password:
            return ""
        return f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

    @property
    def cors_origins(self) -> List[str]:
        defaults = {
            self.frontend_url,
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
        }
        extras = {item.strip() for item in self.cors_extra_origins.split(",") if item.strip()}
        return sorted(defaults | extras)

    def validate(self) -> None:
        missing = []
        if not self.database_url:
            missing.append("DATABASE_URL")
        if self.jwt_secret == "excelai-local-dev-secret-change-me":
            print("WARNING: JWT_SECRET đang dùng giá trị dev mặc định. Hãy đổi khi chạy production.")
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
