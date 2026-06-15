import json
import mimetypes
import re
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response, StreamingResponse

from config import BASE_DIR, settings
from dependencies import get_db
from services.http_headers import safe_attachment_headers
from services.storage_service import StorageService


router = APIRouter(prefix="/api/templates", tags=["templates"])

CATEGORY_META = {
    "admin": ("Hành chính", "🏢", "slate"),
    "analytics": ("Báo cáo", "📊", "indigo"),
    "education": ("Giáo dục", "🎓", "cyan"),
    "finance": ("Tài chính", "💰", "green"),
    "hr": ("Nhân sự", "👥", "purple"),
    "marketing": ("Marketing", "🎯", "pink"),
    "operations": ("Vận hành", "⚙️", "orange"),
    "personal": ("Cá nhân", "✅", "amber"),
    "project": ("Dự án", "📋", "teal"),
    "sales": ("Bán hàng", "📈", "blue"),
}

CONTENT_TYPES = {
    ".csv": "text/csv; charset=utf-8",
    ".svg": "image/svg+xml",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
}


def _template_payload(row: dict, metadata: dict | None = None) -> dict:
    metadata = metadata or {}
    template_id = row.get("id")
    preview_path = metadata.get("previewPath") or ""
    return {
        "id": template_id,
        "name": row.get("name"),
        "category": row.get("category") or "",
        "description": row.get("description") or "",
        "file": row.get("file") or "",
        "icon": row.get("icon") or "",
        "color": row.get("color") or "accent",
        "image": f"/api/templates/{template_id}/preview-image" if preview_path else "",
        "previewImage": f"/api/templates/{template_id}/preview-image" if preview_path else "",
    }


def _catalog_roots() -> list[Path]:
    roots = [
        Path(settings.local_storage_dir) / settings.storage_bucket / "templates" / "catalog",
        BASE_DIR / "storage" / settings.storage_bucket / "templates" / "catalog",
        BASE_DIR.parent / "storage" / settings.storage_bucket / "templates" / "catalog",
    ]
    unique = []
    seen = set()
    for root in roots:
        resolved = root.resolve()
        if resolved not in seen:
            unique.append(resolved)
            seen.add(resolved)
    return unique


def _catalog_dir(template_id: str) -> Path | None:
    safe_id = re.sub(r"[^A-Za-z0-9_-]+", "", template_id or "")
    if not safe_id:
        return None
    for root in _catalog_roots():
        candidate = (root / safe_id).resolve()
        if candidate.is_dir() and str(candidate).startswith(str(root)):
            return candidate
    return None


def _category_from_template_id(template_id: str) -> tuple[str, str, str, str]:
    match = re.match(r"tpl-([a-z]+)-\d+", template_id or "")
    category_id = match.group(1) if match else "templates"
    category, icon, color = CATEGORY_META.get(category_id, ("Biểu mẫu", "📊", "accent"))
    return category_id, category, icon, color


def _display_name_from_file(path: Path) -> str:
    name = path.stem.replace("-", " ").replace("_", " ").strip()
    return " ".join(part.capitalize() for part in name.split()) or path.stem


def _catalog_template_from_dir(path: Path) -> dict | None:
    files = sorted(
        item for item in path.iterdir()
        if item.is_file() and item.suffix.lower() in {".xlsx", ".xls", ".xlsm", ".csv"}
    )
    if not files:
        return None
    workbook = files[0]
    preview = path / "preview.svg"
    template_id = path.name
    category_id, category, icon, color = _category_from_template_id(template_id)
    name = _display_name_from_file(workbook)
    return {
        "id": template_id,
        "name": name,
        "category": category,
        "categoryId": category_id,
        "description": f"Template Excel thật cho tình huống {category.lower()}: có dữ liệu mẫu, sheet tổng hợp và hướng dẫn sử dụng.",
        "file": workbook.name,
        "icon": icon,
        "color": color,
        "image": f"/api/templates/{template_id}/preview-image" if preview.exists() else "",
        "previewImage": f"/api/templates/{template_id}/preview-image" if preview.exists() else "",
        "source": "catalog",
        "fileSize": workbook.stat().st_size,
    }


def _catalog_templates() -> list[dict]:
    by_id = {}
    for root in _catalog_roots():
        if not root.exists():
            continue
        for item in sorted(root.iterdir()):
            if not item.is_dir() or item.name in by_id:
                continue
            payload = _catalog_template_from_dir(item)
            if payload:
                by_id[item.name] = payload
    return list(by_id.values())


def _catalog_template(template_id: str) -> dict | None:
    folder = _catalog_dir(template_id)
    return _catalog_template_from_dir(folder) if folder else None


def _catalog_file(template_id: str, preview: bool = False) -> Path | None:
    folder = _catalog_dir(template_id)
    if not folder:
        return None
    if preview:
        preview_path = folder / "preview.svg"
        return preview_path if preview_path.exists() else None
    files = sorted(
        item for item in folder.iterdir()
        if item.is_file() and item.suffix.lower() in {".xlsx", ".xls", ".xlsm", ".csv"}
    )
    return files[0] if files else None


def _safe_filename(value: str) -> str:
    base = re.sub(r"[^A-Za-z0-9_.-]+", "-", value or "excelai-template").strip(".-")
    if not base:
        base = "excelai-template"
    if not base.lower().endswith((".xlsx", ".xls", ".xlsm", ".csv")):
        base += ".xlsx"
    return base[:120]


def _template_metadata(db) -> dict:
    response = db.table("settings").select("*").eq("key", "template_admin_metadata").limit(1).execute()
    raw = response.data[0].get("value") if response.data else ""
    try:
        parsed = json.loads(raw) if raw else {}
        return (parsed.get("templates") or {}) if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


@router.get("")
async def list_templates(db = Depends(get_db)):
    try:
        response = db.table("templates").select("*").order("created_at", desc=True).execute()
        metadata = _template_metadata(db)
        db_templates = [_template_payload(row, metadata.get(str(row.get("id")))) for row in (response.data or [])]
    except Exception:
        db_templates = []
    catalog = _catalog_templates()
    seen = {str(item.get("id")) for item in db_templates}
    templates = db_templates + [item for item in catalog if str(item.get("id")) not in seen]
    templates.sort(key=lambda item: (str(item.get("category") or ""), str(item.get("name") or "")))
    return {"templates": templates}


@router.get("/{template_id}")
async def get_template(template_id: str, db = Depends(get_db)):
    try:
        response = db.table("templates").select("*").eq("id", template_id).limit(1).execute()
        if response.data:
            metadata = _template_metadata(db)
            row = response.data[0]
            return {"template": _template_payload(row, metadata.get(str(row.get("id"))))}
    except Exception:
        pass
    catalog_template = _catalog_template(template_id)
    if catalog_template:
        return {"template": catalog_template}
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Biểu mẫu không tồn tại.")


@router.get("/{template_id}/download")
async def download_template(template_id: str, db = Depends(get_db)):
    try:
        response = db.table("templates").select("*").eq("id", template_id).limit(1).execute()
        if response.data:
            template = _template_payload(response.data[0])
            metadata = _template_metadata(db).get(template_id) or {}
            if metadata.get("storagePath"):
                content = StorageService(db).download_bytes(metadata["storagePath"])
                file_name = _safe_filename(metadata.get("fileName") or template.get("file") or template.get("name") or template_id)
                return StreamingResponse(
                    BytesIO(content),
                    media_type=metadata.get("contentType") or "application/octet-stream",
                    headers=safe_attachment_headers(file_name),
                )
    except Exception:
        pass
    catalog_file = _catalog_file(template_id)
    if catalog_file:
        media_type = CONTENT_TYPES.get(catalog_file.suffix.lower()) or mimetypes.guess_type(catalog_file.name)[0] or "application/octet-stream"
        return StreamingResponse(
            BytesIO(catalog_file.read_bytes()),
            media_type=media_type,
            headers=safe_attachment_headers(catalog_file.name),
        )
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Biểu mẫu chưa có file thật trong backend.")


@router.get("/{template_id}/preview-image")
async def preview_template_image(template_id: str, db = Depends(get_db)):
    try:
        metadata = _template_metadata(db).get(template_id) or {}
        preview_path = metadata.get("previewPath")
        if preview_path:
            content = StorageService(db).download_bytes(preview_path)
            return Response(
                content,
                media_type=metadata.get("previewContentType") or "image/svg+xml",
                headers={"Cache-Control": "public, max-age=3600"},
            )
    except Exception:
        pass
    catalog_preview = _catalog_file(template_id, preview=True)
    if not catalog_preview:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Biểu mẫu chưa có ảnh xem trước.")
    content = catalog_preview.read_bytes()
    return Response(
        content,
        media_type=CONTENT_TYPES.get(catalog_preview.suffix.lower()) or "image/svg+xml",
        headers={"Cache-Control": "public, max-age=3600"},
    )
