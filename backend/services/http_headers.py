from __future__ import annotations

import re
from urllib.parse import quote


def safe_attachment_headers(filename: str, cache_control: str = "no-store") -> dict[str, str]:
    fallback = re.sub(r"[^A-Za-z0-9._-]+", "_", filename or "download").strip("._") or "download"
    fallback = fallback[:120]
    encoded = quote(filename or fallback, safe="")
    return {
        "Content-Disposition": f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{encoded}",
        "Cache-Control": cache_control,
        "Pragma": "no-cache",
        "X-Content-Type-Options": "nosniff",
    }
