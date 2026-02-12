from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from db import get_db
from models.site_page import SitePage

# -----------------------------
# PUBLIC (users) - read only
# -----------------------------
public_pages_router = APIRouter(prefix="/api/pages", tags=["pages"])

@public_pages_router.get("/content")
def get_page_content(
    path: str = Query(...),
    db: Session = Depends(get_db),
):
    row = db.query(SitePage).filter(
        SitePage.path == path,
        SitePage.is_active == True
    ).first()

    if not row:
        raise HTTPException(status_code=404, detail="Page not found")

    return {"path": row.path, "title": row.title, "html": row.html}


# -----------------------------
# ADMIN - CRUD
# -----------------------------
admin_pages_router = APIRouter(prefix="/api/admin/pages", tags=["admin-pages"])

def _get_by_path(db: Session, path: str) -> SitePage:
    row = db.query(SitePage).filter(SitePage.path == path).first()
    if not row:
        raise HTTPException(status_code=404, detail="Page not found")
    return row


@admin_pages_router.get("", response_model=List[dict])
def admin_list_pages(db: Session = Depends(get_db)):
    rows = db.query(SitePage).order_by(SitePage.path.asc()).all()
    return [
        {
            "path": r.path,
            "title": r.title,
            "is_active": r.is_active,
            "updated_at": getattr(r, "updated_at", None),
        }
        for r in rows
    ]


@admin_pages_router.get("/one")
def admin_get_page(
    path: str = Query(...),
    db: Session = Depends(get_db),
):
    row = _get_by_path(db, path)
    return {
        "path": row.path,
        "title": row.title,
        "html": row.html,
        "is_active": row.is_active,
        "updated_at": getattr(row, "updated_at", None),
    }


@admin_pages_router.post("")
def admin_create_page(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    """
    Create a new page.
    Body example:
    {
      "path": "/about-us",
      "title": "About Us",
      "html": "<p>...</p>",
      "is_active": true
    }
    """
    path = (payload.get("path") or "").strip()
    if not path.startswith("/"):
        raise HTTPException(status_code=400, detail="path must start with '/' (e.g. /about-us)")

    # avoid duplicates
    exists = db.query(SitePage).filter(SitePage.path == path).first()
    if exists:
        raise HTTPException(status_code=409, detail="Page with this path already exists")

    title = (payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")

    row = SitePage(
        path=path,
        title=title,
        html=payload.get("html") or "",
        is_active=bool(payload.get("is_active", True)),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return {
        "path": row.path,
        "title": row.title,
        "html": row.html,
        "is_active": row.is_active,
        "updated_at": getattr(row, "updated_at", None),
    }


@admin_pages_router.put("")
def admin_upsert_page(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    """
    Upsert by path.
    Body example:
    {
      "path": "/about-us",
      "title": "About Us",
      "html": "<p>...</p>",
      "is_active": true
    }
    """
    path = (payload.get("path") or "").strip()
    #if not path.startswith("/"):
        #raise HTTPException(status_code=400, detail="path must start with '/' (e.g. /about-us)")

    title = (payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")

    row = db.query(SitePage).filter(SitePage.path == path).first()
    if not row:
        row = SitePage(path=path, title=title, html=payload.get("html") or "", is_active=bool(payload.get("is_active", True)))
        db.add(row)
    else:
        row.title = title
        row.html = payload.get("html") or ""
        row.is_active = bool(payload.get("is_active", True))

    db.commit()
    db.refresh(row)

    return {
        "path": row.path,
        "title": row.title,
        "html": row.html,
        "is_active": row.is_active,
        "updated_at": getattr(row, "updated_at", None),
    }


@admin_pages_router.patch("/html")
def admin_update_html(
    path: str = Query(...),
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    """
    Update ONLY html by path.
    PATCH /api/admin/pages/html?path=/about-us
    Body: { "html": "<p>new</p>" }
    """
    row = _get_by_path(db, path)
    row.html = payload.get("html") or ""
    db.commit()
    db.refresh(row)

    return {
        "path": row.path,
        "title": row.title,
        "html": row.html,
        "is_active": row.is_active,
        "updated_at": getattr(row, "updated_at", None),
    }


@admin_pages_router.patch("/meta")
def admin_update_meta(
    path: str = Query(...),
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    """
    Update title/is_active (optional) by path.
    PATCH /api/admin/pages/meta?path=/about-us
    Body: { "title": "New title", "is_active": false }
    """
    row = _get_by_path(db, path)

    if "title" in payload:
        title = (payload.get("title") or "").strip()
        if not title:
            raise HTTPException(status_code=400, detail="title cannot be empty")
        row.title = title

    if "is_active" in payload:
        row.is_active = bool(payload.get("is_active"))

    db.commit()
    db.refresh(row)

    return {
        "path": row.path,
        "title": row.title,
        "html": row.html,
        "is_active": row.is_active,
        "updated_at": getattr(row, "updated_at", None),
    }


@admin_pages_router.delete("")
def admin_delete_page(
    path: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    DELETE /api/admin/pages?path=/about-us
    """
    row = _get_by_path(db, path)
    db.delete(row)
    db.commit()
    return {"ok": True, "deleted": path}
