from fastapi import APIRouter, Body, HTTPException,Depends
from typing import List
from db import get_db
from sqlalchemy.orm import Session
from models.site_link import SiteLink


admin_updates_router = APIRouter(prefix="/api/admin", tags=["admin"])


@admin_updates_router.get("/updates", response_model=List[dict])
def list_updates(db: Session = Depends(get_db)):
    rows = db.query(SiteLink).order_by(SiteLink.id.asc()).all()
    return [
        {
          "id": r.id,
          "title": r.title,
          "href": r.href,
          "isPromo": r.is_promo,
          "underline": r.underline,
          "bold": r.bold,
          "targetBlank": r.target_blank,
          "sortOrder": r.sort_order,
          "isActive": r.is_active
        }
        for r in rows
    ]


@admin_updates_router.post("/updates")
def create_update(payload: dict, db: Session = Depends(get_db)):

    new_link = SiteLink(
        title=payload["title"],
        href=payload["href"],
        is_promo=payload.get("isPromo", False),
        underline=payload.get("underline", False),
        bold=payload.get("bold", False),
        target_blank=payload.get("targetBlank", True),
        sort_order=payload.get("sortOrder", 0),
        is_active=payload.get("isActive", True),
    )

    db.add(new_link)
    db.commit()
    db.refresh(new_link)

    return new_link

@admin_updates_router.put("/updates/{id}")
def update_link(id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    row = db.query(SiteLink).filter(SiteLink.id == id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    # update fields (support your Angular camelCase payload)
    if "title" in payload: row.title = payload["title"]
    if "href" in payload: row.href = payload["href"]
    if "isPromo" in payload: row.is_promo = payload["isPromo"]
    if "underline" in payload: row.underline = payload["underline"]
    if "bold" in payload: row.bold = payload["bold"]
    if "targetBlank" in payload: row.target_blank = payload["targetBlank"]
    if "sortOrder" in payload: row.sort_order = payload["sortOrder"]
    if "isActive" in payload: row.is_active = payload["isActive"]

    db.commit()
    db.refresh(row)
    return row

@admin_updates_router.delete("/updates/{id}")
def delete_link(id: int, db: Session = Depends(get_db)):
    row = db.query(SiteLink).filter(SiteLink.id == id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    db.delete(row)
    db.commit()
    return {"ok": True}
