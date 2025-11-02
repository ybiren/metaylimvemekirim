# main.py
from __future__ import annotations

import asyncio
import json
import logging
import mimetypes
import os
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import bcrypt
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse, JSONResponse
from starlette.types import Scope

# -----------------------------------------------------------------------------
# Config & Logging
# -----------------------------------------------------------------------------
MAX_IMAGE_BYTES = 256 * 1024  # 256KB

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("app")

app = FastAPI(title="Register API", version="1.0.0")

# -----------------------------------------------------------------------------
# Paths
# -----------------------------------------------------------------------------
# Folder where THIS file lives (…\metaylimvemekirim\fastapi_server)
BASE_DIR = Path(__file__).resolve().parent

# Angular build is one level up under dist\metaylimvemekirim\browser
ANGULAR_DIR = (BASE_DIR.parent / "dist" / "metaylimvemekirim" / "browser").resolve()
if not ANGULAR_DIR.exists():
    raise RuntimeError(
        f"Angular build not found at: {ANGULAR_DIR}\n"
        "Run `ng build` from your Angular project root."
    )
log.info("Serving Angular from: %s", ANGULAR_DIR)

# Data (stored under fastapi_server\data)
DATA_DIR = BASE_DIR / "data"
USERS_PATH = DATA_DIR / "users.json"
IMAGES_DIR = DATA_DIR / "images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# -----------------------------------------------------------------------------
# CORS (wildcard ok for local dev; pair with allow_credentials=False)
# -----------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# Helpers: image validation & saving
# -----------------------------------------------------------------------------
def ensure_image_content_type(upload: UploadFile) -> None:
    if not upload.content_type or not upload.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type (expecting an image).")

async def read_file_limited(upload: UploadFile, max_bytes: int) -> Tuple[bytes, int]:
    total = 0
    chunks: List[bytes] = []
    try:
        while True:
            chunk = await upload.read(64 * 1024)
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

def save_image_to_disk(image_bytes: bytes, user_id: int, mime_type: str) -> str:
    ext = mimetypes.guess_extension(mime_type) or ".bin"
    ext = _normalize_jpeg_ext(ext)
    filename = f"{user_id}{ext}"
    image_path = IMAGES_DIR / filename
    image_path.write_bytes(image_bytes)
    # Return path relative to BASE_DIR for stability
    return str(image_path.resolve().relative_to(BASE_DIR))

ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}

async def find_user_image_path(user_id: int) -> Optional[Path]:
    """
    Resolve the image path for user_id:
      1) Prefer users.json -> image_path
      2) Fallback to scanning data/images/<userID>.<ext>
    """
    try:
        users = await load_users()
        idx = user_id - 1
        if 0 <= idx < len(users):
            p = users[idx].get("image_path")
            if p:
                path = (BASE_DIR / p).resolve()
                if path.exists():
                    return path
    except Exception:
        pass

    for ext in ALLOWED_EXTS:
        cand = (IMAGES_DIR / f"{user_id}{ext}").resolve()
        if cand.exists():
            return cand
    return None

# -----------------------------------------------------------------------------
# Users.json helpers
# -----------------------------------------------------------------------------
users_lock = asyncio.Lock()

def _ensure_data_file() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not USERS_PATH.exists():
        USERS_PATH.write_text("[]", encoding="utf-8")

def _load_users_sync() -> List[Dict[str, Any]]:
    _ensure_data_file()
    try:
        return json.loads(USERS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []

def _atomic_write_json_sync(path: Path, payload: Any) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)

async def load_users() -> List[Dict[str, Any]]:
    return _load_users_sync()

async def save_users(users: List[Dict[str, Any]]) -> None:
    _atomic_write_json_sync(USERS_PATH, users)

def _find_user_index_by_email(users: List[Dict[str, Any]], email: str) -> Optional[int]:
    e = (email or "").strip().lower()
    for i, u in enumerate(users):
        if (u.get("c_email", "") or "").strip().lower() == e:
            return i
    return None

async def upsert_user(user_fields: Dict[str, Any]) -> Dict[str, Any]:
    """
    Add new user or update existing by c_email.
    New user -> userID = len(users) (1-based)
    Existing  -> update in place.
    """
    async with users_lock:
        users = await load_users()
        idx = _find_user_index_by_email(users, user_fields.get("c_email", ""))
        if idx is None:
            users.append({})
            user_id = len(users)
            new_user = {"userID": user_id, **user_fields}
            users[-1] = new_user
            await save_users(users)
            return new_user
        else:
            user_id = idx + 1
            merged = {"userID": user_id, **users[idx], **user_fields}
            users[idx] = merged
            await save_users(users)
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

async def get_user_and_index_by_email(email: str) -> Tuple[Optional[Dict[str, Any]], Optional[int], List[Dict[str, Any]]]:
    users = await load_users()
    idx = _find_user_index_by_email(users, email)
    if idx is None:
        return None, None, users
    return users[idx], idx, users

def _sanitize_user_for_response(u: Dict[str, Any]) -> Dict[str, Any]:
    redacted = dict(u)
    redacted.pop("password", None)
    redacted.pop("password_hash", None)
    return redacted

@app.get("/")
def serve_root():
    # Serve Angular index explicitly for "/"
    return FileResponse(ANGULAR_DIR / "index.html", media_type="text/html")


# -----------------------------------------------------------------------------
# API routes (define BEFORE static mount)
# -----------------------------------------------------------------------------
@app.get("/health")
async def health() -> Dict[str, Any]:
    return {"ok": True, "status": "healthy", "version": app.version}

@app.get("/images/{user_id}")
async def get_user_image(user_id: int):
    path = await find_user_image_path(user_id)
    if not path:
        raise HTTPException(status_code=404, detail="Image not found")
    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return FileResponse(path, media_type=media_type)

@app.post("/register")
async def register(
    c_name: str = Form(...),
    c_gender: str = Form(...),
    c_birth_day: str = Form(...),
    c_birth_month: str = Form(...),
    c_birth_year: str = Form(...),
    c_country: str = Form(...),
    c_email: str = Form(...),
    c_ff: str = Form(...),
    password: str = Form(...),
    password2: str = Form(...),
    sessionID: str = Form(...),
    c_pcell: str = Form(""),
    c_details: str = Form(""),
    c_details1: str = Form(""),
    c_image: Optional[UploadFile] = File(None),  # optional
):
    def _has_real_file(up: Optional[UploadFile]) -> bool:
        return bool(up and getattr(up, "filename", None))

    user_fields: Dict[str, Any] = {
        "c_name": c_name,
        "c_gender": c_gender,
        "c_birth_day": c_birth_day,
        "c_birth_month": c_birth_month,
        "c_birth_year": c_birth_year,
        "c_country": c_country,
        "c_pcell": c_pcell,
        "c_email": c_email,
        "c_ff": c_ff,
        "c_details": c_details,
        "c_details1": c_details1,
        "sessionID": sessionID,
        "password": password,
        "password2": password2,
    }

    stored_user = await upsert_user(user_fields)
    user_id = stored_user["userID"]

    if _has_real_file(c_image):
        ensure_image_content_type(c_image)
        image_bytes, image_size = await read_file_limited(c_image, MAX_IMAGE_BYTES)
        image_rel_path = save_image_to_disk(image_bytes, user_id, c_image.content_type)
        stored_user.update(
            {
                "image_path": image_rel_path,
                "image_content_type": c_image.content_type,
                "image_size": image_size,
            }
        )
        await upsert_user(stored_user)
        log.info("Upserted user (with image): email=%s userID=%s image=%s",
                 stored_user.get("c_email"), user_id, image_rel_path)
    else:
        log.info("Upserted user (no image change): email=%s userID=%s",
                 stored_user.get("c_email"), user_id)

    image_url = f"/images/{user_id}" if stored_user.get("image_path") else None
    return JSONResponse({"ok": True, "message": "User saved.", "user": stored_user, "image_url": image_url})

@app.get("/users")
async def get_users() -> JSONResponse:
    _ensure_data_file()
    async with users_lock:
        users = await load_users()
    return JSONResponse({"ok": True, "count": len(users), "users": users})

@app.post("/login")
async def login(
    c_email: str = Form(...),
    password: str = Form(...),
):
    user, idx, users = await get_user_and_index_by_email((c_email or "").strip().lower())
    if not user or not verify_password(password, user):
        return JSONResponse({"ok": False, "message": "Invalid email or password."}, status_code=401)

    user["sessionID"] = uuid.uuid4().hex
    async with users_lock:
        users[idx] = user
        await save_users(users)

    user_sanitized = _sanitize_user_for_response(user)
    user_id = user_sanitized.get("userID")
    image_url = f"/images/{user_id}" if user_id else None

    return JSONResponse({"ok": True, "message": "Login successful.", "user": user_sanitized, "image_url": image_url})

# -----------------------------------------------------------------------------
# SPA + static (mount LAST) — smart handler (no HTML fallback for assets)
# -----------------------------------------------------------------------------
class SpaStaticFiles(StaticFiles):
    """
    Serve Angular assets correctly:
    - Requests that include a dot (e.g. .js, .css, .png, .map, .webmanifest) are treated as files (200/404).
    - Requests without a dot are treated as SPA routes and fall back to index.html.
    This prevents returning text/html for JS bundles (strict MIME error).
    """
    async def get_response(self, path: str, scope: Scope):
        log.info("Static request: /%s", path)
        response = await super().get_response(path, scope)
        if response.status_code == 404 and "." not in path:
            index_file = os.path.join(self.directory, "index.html")
            if os.path.exists(index_file):
                return FileResponse(index_file, media_type="text/html")
        return response

# Mount the Angular build
app.mount("/", SpaStaticFiles(directory=str(ANGULAR_DIR)), name="spa")



# Optional: explicit manifest MIME (helps Chrome display)
@app.get("/manifest.webmanifest")
def manifest():
    return FileResponse(ANGULAR_DIR / "manifest.webmanifest", media_type="application/manifest+json")

# -----------------------------------------------------------------------------
# Entrypoint
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    # Run: uvicorn main:app --reload --port 8000
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
