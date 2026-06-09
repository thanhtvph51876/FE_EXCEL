from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from config import settings


@dataclass(frozen=True)
class StorageResult:
    path: str
    backend: str
    bucket: str


class StorageService:
    def __init__(self, db: Any):
        self.db = db
        self.bucket = settings.storage_bucket
        self.backend = settings.storage_backend

    def upload_bytes(self, path: str, content: bytes, content_type: str = "application/octet-stream") -> StorageResult:
        self.db.storage.from_(self.bucket).upload(
            path=path,
            file=content,
            file_options={"content-type": content_type, "x-upsert": "false"},
        )
        return StorageResult(path=path, backend=self.backend, bucket=self.bucket)

    def download_bytes(self, path: str) -> bytes:
        payload = self.db.storage.from_(self.bucket).download(path)
        if isinstance(payload, bytes):
            return payload
        if hasattr(payload, "content"):
            return payload.content
        if isinstance(payload, str):
            return payload.encode("utf-8")
        return bytes(payload)

    def remove(self, paths: list[str]) -> None:
        self.db.storage.from_(self.bucket).remove(paths)

    def health(self) -> dict:
        if self.backend == "local":
            root = Path(settings.local_storage_dir) / self.bucket
            root.mkdir(parents=True, exist_ok=True)
            probe = root / ".health"
            probe.write_text("ok", encoding="utf-8")
            return {"status": "ok" if probe.read_text(encoding="utf-8") == "ok" else "degraded", "backend": self.backend, "bucket": self.bucket}
        return {"status": "not_configured", "backend": self.backend, "bucket": self.bucket}
