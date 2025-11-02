# helper.py
from __future__ import annotations

import json
import mimetypes
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, UploadFile
import bcrypt

# -----------------------------
# Image helpers
# -----------------------------
def ensure_image_content_type(upload: UploadFile) -> None:
    if not upload.content_type or not upload.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type (expecting an image).")

async def read_file_limited(upload: UploadFile, max_bytes: int) -> Tuple[bytes, int]:
    total = 0
    chunks: List[bytes] = []
    try:
        while True:
            chunk = await upload.read(64 * 1024)  # 64KB
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                raise HTTPException(status_code=400, detail=f"Image exceeds {max_bytes // 1024}KB.")
            chunks.append(chunk)
    finally:
        await upload.close()
    return b"".join(chunks), total

def _normalize_jpeg_ext(ext: str) -> str:
    return ".jpg" if ext.startswith(".jpe") else ext

def save_image_to_disk(
    image_bytes: bytes,
    user_id: int,
    mime_type: str,
    images_dir: Path,
    base_dir_for_rel: Path,
) -> str:
    ext = mimetypes.guess_extension(mime_type) or ".bin"
    ext = _normalize_jpeg_ext(ext)
    filename = f"{user_id}{ext}"
    image_path = images_dir / filename
    image_path.write_bytes(image_bytes)
    return str(image_path.resolve().relative_to(base_dir_for_rel))

async def find_user_image_path(
    user_id: int,
    base_dir: Path,
    images_dir: Path,
    users_path: Path,
    allowed_exts: set[str] | None = None,
) -> Optional[Path]:
    """
    Resolve the image path for user_id:
      1) Prefer users.json -> image_path
      2) Fallback to scanning images_dir/<userID>.<ext>
    """
    allowed_exts = allowed_exts or {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
    try:
        users = await load_users(users_path)
        idx = user_id - 1
        if 0 <= idx < len(users):
            p = users[idx].get("image_path")
            if p:
                path = (base_dir / p).resolve()
                if path.exists():
                    return path
    except Exception:
        pass

    for ext in allowed_exts:
        cand = (images_dir / f"{user_id}{ext}").resolve()
        if cand.exists():
            return cand
    return None

# -----------------------------
# Users.json helpers
# -----------------------------
def ensure_data_file(data_dir: Path, users_path: Path) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)
    if not users_path.exists():
        users_path.write_text("[]", encoding="utf-8")

def _load_users_sync(users_path: Path) -> List[Dict[str, Any]]:
    ensure_data_file(users_path.parent, users_path)
    try:
        return json.loads(users_path.read_text(encoding="utf-8"))
    except Exception:
        return []

def _atomic_write_json_sync(path: Path, payload: Any) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)

async def load_users(users_path: Path) -> List[Dict[str, Any]]:
    return _load_users_sync(users_path)

async def save_users(users_path: Path, users: List[Dict[str, Any]]) -> None:
    _atomic_write_json_sync(users_path, users)

def _find_user_index_by_email(users: List[Dict[str, Any]], email: str) -> Optional[int]:
    e = (email or "").strip().lower()
    for i, u in enumerate(users):
        if (u.get("c_email", "") or "").strip().lower() == e:
            return i
    return None

def find_user_index_by_userid(users: List[Dict[str, Any]], user_id: int) -> Optional[int]:
    """
    Find the index of the user in the users list by their userID field.
    Returns None if not found.
    """
    for i, u in enumerate(users):
        if u.get("userID") == user_id:
            return i
    return None


async def upsert_user(users_path: Path, user_fields: Dict[str, Any]) -> Dict[str, Any]:
    """
    Add new user or update existing by c_email.
    New user -> userID = len(users) (1-based)
    Existing  -> update in place.
    """
    users = await load_users(users_path)
    idx = _find_user_index_by_email(users, user_fields.get("c_email", ""))
    if idx is None:
        users.append({})
        user_id = len(users)
        new_user = {"userID": user_id, **user_fields}
        users[-1] = new_user
        await save_users(users_path, users)
        return new_user
    else:
        user_id = idx + 1
        merged = {"userID": user_id, **users[idx], **user_fields}
        users[idx] = merged
        await save_users(users_path, users)
        return merged

def verify_password(plain: str, stored_user: Dict[str, Any]) -> bool:
    """Support bcrypt-hash (preferred) and legacy plaintext."""
    pw_hash = stored_user.get("password_hash")
    if pw_hash:
        try:
            return bcrypt.checkpw(plain.encode("utf-8"), pw_hash.encode("utf-8"))
        except Exception:
            return False
    legacy = stored_user.get("password")
    return legacy is not None and legacy == plain

async def get_user_and_index_by_email(users_path: Path, email: str) -> Tuple[Optional[Dict[str, Any]], Optional[int], List[Dict[str, Any]]]:
    users = await load_users(users_path)
    idx = _find_user_index_by_email(users, email)
    if idx is None:
        return None, None, users
    return users[idx], idx, users

def sanitize_user_for_response(u: Dict[str, Any]) -> Dict[str, Any]:
    redacted = dict(u)
    redacted.pop("password", None)
    redacted.pop("password_hash", None)
    return redacted


async def load_messages(path: Path) -> list[dict]:
    ensure_data_file(path.parent, path)
    # tolerate empty / invalid file by resetting to []
    try:
        if path.exists() and path.stat().st_size > 0:
            with path.open("r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
    except Exception:
        pass
    return []

async def save_messages(path: Path, messages: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(messages, f, ensure_ascii=False, indent=2)
    tmp.replace(path)