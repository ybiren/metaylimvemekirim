# routes/admin_banners.py
#
# FastAPI + SQLAlchemy (sync Session) + PostgreSQL
# CRUD for admin_banners with:
# - page column (main/about/contact...)
# - list with pagination + search + page_key filter
# - create/update via multipart/form-data (Form + optional File)
# - stores image as BYTEA (BLOB) in DB
# - serves image via /{id}/image
#
# IMPORTANT:
# - This file assumes you have:
#   - models.admin_banner.AdminBanner (ORM)
#   - schemas.admin_banner.AdminBannerOut (Pydantic OUT schema) that DOES NOT include image_data bytes
#   - db.get_db dependency that yields a sync sqlalchemy.orm.Session
#
# If you want, I can also rewrite model + schema files to match this exactly.

from __future__ import annotations

from typing import Optional, Dict, Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    UploadFile,
    File,
    Response,
    Form,
)
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc

from db import get_db
from models.admin_banner import AdminBanner
from schemas.admin_banner import AdminBannerOut

admin_banners_router = APIRouter(prefix="/api/admin/banners", tags=["admin_banners"])

MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5MB


# ---------- Helper ----------

def _is_valid_http_url(v: str) -> bool:
    s = (v or "").strip().lower()
    return s.startswith("http://") or s.startswith("https://")


def to_out(b: AdminBanner) -> AdminBannerOut:
    # ✅ NEVER expose image_data (bytes) in JSON
    return AdminBannerOut(
        id=b.id,
        page=b.page or "main",
        title=b.title,
        link_url=b.link_url,
        is_active=bool(b.is_active),
        sort_order=b.sort_order or 0,
        image_url=f"/api/admin/banners/{b.id}/image" if b.image_data else "",
        created_at=b.created_at.isoformat() if b.created_at else None,
        updated_at=b.updated_at.isoformat() if b.updated_at else None,
    )


def _read_bool(v: str) -> bool:
    s = (v or "").strip().lower()
    return s in ("1", "true", "yes", "y", "on", "כן")


def _read_int(v: str, default: int = 0) -> int:
    try:
        return int(str(v).strip())
    except Exception:
        return default


# ---------- LIST ----------

@admin_banners_router.get("", response_model=Dict[str, Any])
def list_banners(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    q: Optional[str] = Query(None),
    page_key: Optional[str] = Query(None),
):
    qry = db.query(AdminBanner)

    if page_key:
        qry = qry.filter(AdminBanner.page == page_key)

    if q:
        s = f"%{q.strip()}%"
        qry = qry.filter(
            or_(
                AdminBanner.title.ilike(s),
                AdminBanner.link_url.ilike(s),
                AdminBanner.page.ilike(s),
            )
        )

    qry = qry.order_by(
        desc(AdminBanner.is_active),
        asc(AdminBanner.sort_order),
        desc(AdminBanner.id),
    )

    total = qry.count()
    items = qry.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [to_out(x).model_dump() for x in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ---------- GET ONE ----------

@admin_banners_router.get("/{banner_id}", response_model=AdminBannerOut)
def get_banner(banner_id: int, db: Session = Depends(get_db)):
    b = db.query(AdminBanner).filter(AdminBanner.id == banner_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Banner not found")
    return to_out(b)


# ---------- CREATE (multipart: Form + optional File) ----------

@admin_banners_router.post("", response_model=AdminBannerOut)
async def create_banner(
    db: Session = Depends(get_db),

    page: str = Form("main"),
    title: str = Form(""),
    link_url: str = Form(...),
    is_active: str = Form("true"),
    sort_order: str = Form("0"),

    file: UploadFile | None = File(None),  # optional; but you can enforce it for create
):
    link_url = (link_url or "").strip()
    if not link_url:
        raise HTTPException(status_code=400, detail="link_url is required")
    if not _is_valid_http_url(link_url):
        raise HTTPException(status_code=400, detail="link_url must start with http:// or https://")

    # If you want to force image on create:
    if not file:
        raise HTTPException(status_code=400, detail="file (image) is required for new banner")

    b = AdminBanner(
        page=(page or "main").strip() or "main",
        title=(title or "").strip() or None,
        link_url=link_url,
        is_active=_read_bool(is_active),
        sort_order=_read_int(sort_order, 0),
    )

    if file:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Only image uploads allowed")

        data = await file.read()
        if not data:
            raise HTTPException(status_code=400, detail="Empty file")
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=400, detail="File too large (max 5MB)")

        b.image_mime = file.content_type
        b.image_data = data

    db.add(b)
    db.commit()
    db.refresh(b)
    return to_out(b)


# ---------- UPDATE (multipart: Form + optional File) ----------

@admin_banners_router.put("/{banner_id}", response_model=AdminBannerOut)
async def update_banner(
    banner_id: int,
    db: Session = Depends(get_db),

    page: str = Form("main"),
    title: str = Form(""),
    link_url: str = Form(...),
    is_active: str = Form("true"),
    sort_order: str = Form("0"),

    file: UploadFile | None = File(None),  # optional: replace image if provided
):
    b = db.query(AdminBanner).filter(AdminBanner.id == banner_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Banner not found")

    link_url = (link_url or "").strip()
    if not link_url:
        raise HTTPException(status_code=400, detail="link_url is required")
    if not _is_valid_http_url(link_url):
        raise HTTPException(status_code=400, detail="link_url must start with http:// or https://")

    b.page = (page or "main").strip() or "main"
    b.title = (title or "").strip() or None
    b.link_url = link_url
    b.is_active = _read_bool(is_active)
    b.sort_order = _read_int(sort_order, 0)

    if file:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Only image uploads allowed")

        data = await file.read()
        if not data:
            raise HTTPException(status_code=400, detail="Empty file")
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=400, detail="File too large (max 5MB)")

        b.image_mime = file.content_type
        b.image_data = data

    db.commit()
    db.refresh(b)
    return to_out(b)


# ---------- DELETE ----------

@admin_banners_router.delete("/{banner_id}")
def delete_banner(banner_id: int, db: Session = Depends(get_db)):
    b = db.query(AdminBanner).filter(AdminBanner.id == banner_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Banner not found")

    db.delete(b)
    db.commit()
    return {"ok": True}


# ---------- IMAGE (BLOB) ----------

@admin_banners_router.get("/{banner_id}/image")
def get_banner_image(banner_id: int, db: Session = Depends(get_db)):
    b = db.query(AdminBanner).filter(AdminBanner.id == banner_id).first()
    if not b or not b.image_data:
        raise HTTPException(status_code=404, detail="Image not found")

    mime = b.image_mime or "application/octet-stream"
    return Response(content=bytes(b.image_data), media_type=mime)


@admin_banners_router.delete("/{banner_id}/image")
def delete_banner_image(banner_id: int, db: Session = Depends(get_db)):
    b = db.query(AdminBanner).filter(AdminBanner.id == banner_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Banner not found")

    b.image_mime = None
    b.image_data = None
    db.commit()
    db.refresh(b)
    return to_out(b)