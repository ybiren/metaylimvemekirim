# routes/admin_albums.py
#
# CRUD for site photo albums (/admin/albums) plus picture upload/delete inside
# an album.
#
# Album metadata is plain JSON (like admin_updates); pictures are uploaded as
# multipart and stored on disk under data/images/albums/<album_id>/, following
# the same approach as the user extra images used by the user/:userID album.

from __future__ import annotations

import logging
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
)
from sqlalchemy import asc, desc, func, or_
from sqlalchemy.orm import Session
from starlette.responses import FileResponse

from db import get_db, engine
from helper import ensure_image_content_type, read_file, save_album_image_to_disk
from models.album import Album, AlbumPhoto, Base as AlbumBase
from schemas.album import AlbumCreate, AlbumDetailOut, AlbumOut, AlbumPhotoOut, AlbumUpdate

log = logging.getLogger("app")

admin_albums_router = APIRouter(prefix="/api/admin/albums", tags=["admin_albums"])

# Read-only view of the same data for the public site (active albums only),
# mirroring how admin_pages.py pairs an admin router with a public one.
public_albums_router = APIRouter(prefix="/api/albums", tags=["albums"])

BASE_DIR = Path(__file__).resolve().parent.parent
IMAGES_DIR = BASE_DIR / "data" / "images"

MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5MB per picture

# The project has no migration tool: tables are created by hand in pgAdmin.
# create_all only adds missing tables, so this is a no-op once they exist.
try:
    AlbumBase.metadata.create_all(bind=engine)
except Exception as e:  # pragma: no cover - never block startup on this
    log.warning("Could not ensure album tables exist: %s", e)


# ---------- Helpers ----------

def _photo_out(p: AlbumPhoto, base: str = "/api/admin/albums") -> AlbumPhotoOut:
    return AlbumPhotoOut(
        id=p.id,
        album_id=p.album_id,
        filename=p.filename,
        content_type=p.content_type,
        size=p.size or 0,
        sort_order=p.sort_order or 0,
        image_url=f"{base}/{p.album_id}/photos/{p.filename}",
        created_at=p.created_at.isoformat() if p.created_at else None,
    )


PREVIEW_COUNT = 4


def _album_out(
    a: Album,
    photo_count: int,
    previews: List[AlbumPhoto],
    base: str = "/api/admin/albums",
) -> AlbumOut:
    urls = [f"{base}/{a.id}/photos/{p.filename}" for p in previews[:PREVIEW_COUNT]]
    return AlbumOut(
        id=a.id,
        title=a.title,
        description=a.description,
        is_active=bool(a.is_active),
        sort_order=a.sort_order or 0,
        photo_count=photo_count,
        cover_url=urls[0] if urls else "",
        preview_urls=urls,
        created_at=a.created_at.isoformat() if a.created_at else None,
        updated_at=a.updated_at.isoformat() if a.updated_at else None,
    )


def _get_album_or_404(db: Session, album_id: int) -> Album:
    a = db.query(Album).filter(Album.id == album_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Album not found")
    return a


def _abs_path(p: AlbumPhoto) -> Path:
    """
    Locate a picture on disk.

    The stored path is informational only: a row written on Windows holds
    backslashes, which do not resolve on the Linux server even though both talk
    to the same database. So the canonical location is rebuilt from
    album_id + filename, and the stored path is only a fallback.
    """
    guess = IMAGES_DIR / "albums" / str(p.album_id) / p.filename
    if guess.exists():
        return guess

    raw = Path((p.path or "").replace("\\", "/"))
    return raw if raw.is_absolute() else (BASE_DIR / raw)


def _unlink_photo_file(p: AlbumPhoto) -> None:
    path = _abs_path(p)
    if path.exists():
        try:
            path.unlink()
        except Exception as e:
            log.warning("Failed to unlink album image: %s (%s)", path, e)


# ---------- Albums: LIST ----------

def _list_albums(
    db: Session,
    page: int,
    page_size: int,
    q: Optional[str],
    active: Optional[bool],
    base: str,
    with_photos: bool = False,
) -> Dict[str, Any]:
    qry = db.query(Album)

    if q:
        s = f"%{q.strip()}%"
        qry = qry.filter(or_(Album.title.ilike(s), Album.description.ilike(s)))

    if active is not None:
        qry = qry.filter(Album.is_active == active)

    qry = qry.order_by(asc(Album.sort_order), desc(Album.id))

    total = qry.count()
    albums = qry.offset((page - 1) * page_size).limit(page_size).all()

    # counts + covers for the listed albums only
    ids = [a.id for a in albums]
    counts: Dict[int, int] = {}
    previews: Dict[int, List[AlbumPhoto]] = {}
    by_album: Dict[int, List[AlbumPhoto]] = {}

    if ids:
        rows = (
            db.query(AlbumPhoto.album_id, func.count(AlbumPhoto.id))
            .filter(AlbumPhoto.album_id.in_(ids))
            .group_by(AlbumPhoto.album_id)
            .all()
        )
        counts = {album_id: n for album_id, n in rows}

        photos = (
            db.query(AlbumPhoto)
            .filter(AlbumPhoto.album_id.in_(ids))
            .order_by(
                asc(AlbumPhoto.album_id),
                asc(AlbumPhoto.sort_order),
                asc(AlbumPhoto.id),
            )
            .all()
        )
        for p in photos:
            bucket = previews.setdefault(p.album_id, [])
            if len(bucket) < PREVIEW_COUNT:
                bucket.append(p)
            by_album.setdefault(p.album_id, []).append(p)

    def _item(a: Album) -> Dict[str, Any]:
        out = _album_out(a, counts.get(a.id, 0), previews.get(a.id, []), base)
        if not with_photos:
            return out.model_dump()
        return AlbumDetailOut(
            **out.model_dump(),
            photos=[_photo_out(p, base) for p in by_album.get(a.id, [])],
        ).model_dump()

    return {
        "items": [_item(a) for a in albums],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@admin_albums_router.get("", response_model=Dict[str, Any])
def list_albums(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    q: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
):
    return _list_albums(db, page, page_size, q, active, "/api/admin/albums")


# ---------- Albums: GET ONE (with photos) ----------

@admin_albums_router.get("/{album_id}", response_model=AlbumDetailOut)
def get_album(album_id: int, db: Session = Depends(get_db)):
    a = _get_album_or_404(db, album_id)
    photos = a.photos or []
    out = _album_out(a, len(photos), photos)
    return AlbumDetailOut(**out.model_dump(), photos=[_photo_out(p) for p in photos])


# ---------- Albums: CREATE ----------

@admin_albums_router.post("", response_model=AlbumOut)
def create_album(payload: AlbumCreate, db: Session = Depends(get_db)):
    title = (payload.title or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")

    album = Album(
        title=title,
        description=(payload.description or "").strip() or None,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )
    db.add(album)
    db.commit()
    db.refresh(album)

    return _album_out(album, 0, [])


# ---------- Albums: UPDATE ----------

@admin_albums_router.put("/{album_id}", response_model=AlbumOut)
def update_album(album_id: int, payload: AlbumUpdate, db: Session = Depends(get_db)):
    album = _get_album_or_404(db, album_id)

    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="title is required")
        album.title = title

    if payload.description is not None:
        album.description = payload.description.strip() or None

    if payload.is_active is not None:
        album.is_active = payload.is_active

    if payload.sort_order is not None:
        album.sort_order = payload.sort_order

    db.commit()
    db.refresh(album)

    photos = album.photos or []
    return _album_out(album, len(photos), photos)


# ---------- Albums: DELETE ----------

@admin_albums_router.delete("/{album_id}")
def delete_album(album_id: int, db: Session = Depends(get_db)):
    album = _get_album_or_404(db, album_id)

    for p in list(album.photos or []):
        _unlink_photo_file(p)

    db.delete(album)  # album_photos rows go with it (cascade)
    db.commit()

    album_dir = IMAGES_DIR / "albums" / str(album_id)
    if album_dir.exists():
        try:
            album_dir.rmdir()  # only removes it when empty
        except OSError:
            pass

    log.info("Deleted album %s", album_id)
    return {"ok": True, "deleted": album_id}


# ---------- Photos: LIST ----------

@admin_albums_router.get("/{album_id}/photos", response_model=Dict[str, Any])
def list_album_photos(album_id: int, db: Session = Depends(get_db)):
    album = _get_album_or_404(db, album_id)
    photos = album.photos or []
    return {
        "ok": True,
        "album_id": album_id,
        "count": len(photos),
        "items": [_photo_out(p).model_dump() for p in photos],
    }


# ---------- Photos: UPLOAD ----------

@admin_albums_router.post("/{album_id}/photos", response_model=Dict[str, Any])
async def upload_album_photos(
    album_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    album = _get_album_or_404(db, album_id)

    real_files = [f for f in files if f and getattr(f, "filename", None)]
    if not real_files:
        raise HTTPException(status_code=400, detail="No files provided")

    next_order = (
        db.query(func.coalesce(func.max(AlbumPhoto.sort_order), 0))
        .filter(AlbumPhoto.album_id == album_id)
        .scalar()
        or 0
    )

    added: List[AlbumPhoto] = []
    for up in real_files:
        ensure_image_content_type(up)
        bts, size = await read_file(up)
        if size > MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"'{up.filename}' is larger than {MAX_IMAGE_BYTES // (1024 * 1024)}MB",
            )

        guid = uuid.uuid4().hex
        rel_path = save_album_image_to_disk(
            image_bytes=bts,
            album_id=album_id,
            mime_type=up.content_type,
            images_dir=IMAGES_DIR,
            base_dir_for_rel=BASE_DIR,
            guid=guid,
        )

        next_order += 1
        photo = AlbumPhoto(
            album_id=album_id,
            filename=Path(rel_path).name,
            path=rel_path.replace("\\", "/"),  # keep rows OS-independent
            content_type=up.content_type,
            size=size,
            sort_order=next_order,
        )
        db.add(photo)
        added.append(photo)

    db.commit()
    for p in added:
        db.refresh(p)

    db.refresh(album)

    log.info("Uploaded %s picture(s) to album %s", len(added), album_id)
    return {
        "ok": True,
        "added": len(added),
        "total": len(album.photos or []),
        "items": [_photo_out(p).model_dump() for p in added],
    }


# ---------- Photos: SERVE ----------

@admin_albums_router.get("/{album_id}/photos/{filename}")
def get_album_photo(album_id: int, filename: str, db: Session = Depends(get_db)):
    photo = (
        db.query(AlbumPhoto)
        .filter(AlbumPhoto.album_id == album_id, AlbumPhoto.filename == filename)
        .first()
    )
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    path = _abs_path(photo)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Photo file missing")

    return FileResponse(path, media_type=photo.content_type or "application/octet-stream")


# ---------- Photos: DELETE ----------

@admin_albums_router.delete("/{album_id}/photos/{photo_id}")
def delete_album_photo(album_id: int, photo_id: int, db: Session = Depends(get_db)):
    photo = (
        db.query(AlbumPhoto)
        .filter(AlbumPhoto.album_id == album_id, AlbumPhoto.id == photo_id)
        .first()
    )
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    _unlink_photo_file(photo)
    db.delete(photo)
    db.commit()

    remaining = (
        db.query(func.count(AlbumPhoto.id))
        .filter(AlbumPhoto.album_id == album_id)
        .scalar()
        or 0
    )

    log.info("Deleted photo %s from album %s", photo_id, album_id)
    return {"ok": True, "deleted": photo_id, "remaining": remaining}


# =====================================================================
# Public (read-only) — what the site's אלבומים page uses.
# Hidden albums (is_active = false) are never returned here.
# =====================================================================

PUBLIC_BASE = "/api/albums"


def _get_public_album_or_404(db: Session, album_id: int) -> Album:
    a = (
        db.query(Album)
        .filter(Album.id == album_id, Album.is_active.is_(True))
        .first()
    )
    if not a:
        raise HTTPException(status_code=404, detail="Album not found")
    return a


@public_albums_router.get("", response_model=Dict[str, Any])
def public_list_albums(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
):
    # the site's אלבומים page shows every picture up front, not just a cover
    return _list_albums(db, page, page_size, None, True, PUBLIC_BASE, with_photos=True)


@public_albums_router.get("/{album_id}", response_model=AlbumDetailOut)
def public_get_album(album_id: int, db: Session = Depends(get_db)):
    a = _get_public_album_or_404(db, album_id)
    photos = a.photos or []
    out = _album_out(a, len(photos), photos, PUBLIC_BASE)
    return AlbumDetailOut(
        **out.model_dump(),
        photos=[_photo_out(p, PUBLIC_BASE) for p in photos],
    )


@public_albums_router.get("/{album_id}/photos/{filename}")
def public_get_album_photo(album_id: int, filename: str, db: Session = Depends(get_db)):
    _get_public_album_or_404(db, album_id)

    photo = (
        db.query(AlbumPhoto)
        .filter(AlbumPhoto.album_id == album_id, AlbumPhoto.filename == filename)
        .first()
    )
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    path = _abs_path(photo)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Photo file missing")

    return FileResponse(path, media_type=photo.content_type or "application/octet-stream")
