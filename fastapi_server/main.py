# main.py
from __future__ import annotations

import asyncio
import logging
import mimetypes
import os
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse, JSONResponse
from starlette.types import Scope

from models import SendMessagePayload

# import routers
from ws.notify import router as notify_router
from ws.chat import router as chat_router

from helper import (
    ensure_image_content_type,
    read_file,
    save_image_to_disk,
    save_extra_image_to_disk,
    find_user_image_path,
    find_user_extra_image_path,
    ensure_data_file,
    load_users,
    save_users,
    upsert_user,
    get_user_and_index_by_email,
    verify_password,
    sanitize_user_for_response,
    find_user_index_by_userid,
    load_messages,
    save_messages,
)

from sendgrid_test.send_mail import send_mail

# ---------------------------------------------------------------------
# Config & Logging
# ---------------------------------------------------------------------
MAX_EXTRA_IMAGES = 5

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("app")

app = FastAPI(title="Register API", version="1.0.0")

# ---------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
ANGULAR_DIR = (BASE_DIR.parent / "dist" / "metaylimvemekirim" / "browser").resolve()
if not ANGULAR_DIR.exists():
    raise RuntimeError(
        f"Angular build not found at: {ANGULAR_DIR}\n"
        "Run `ng build` from your Angular project root."
    )
log.info("Serving Angular from: %s", ANGULAR_DIR)

DATA_DIR = BASE_DIR / "data"
USERS_PATH = DATA_DIR / "users.json"
IMAGES_DIR = DATA_DIR / "images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)
MESSAGES_PATH = DATA_DIR / "messages.json"

# ---------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(notify_router)
app.include_router(chat_router)

# ---------------------------------------------------------------------
# Locks
# ---------------------------------------------------------------------
users_lock = asyncio.Lock()
messages_lock = asyncio.Lock()

# ---------------------------------------------------------------------
# Root (serve app shell)
# ---------------------------------------------------------------------
@app.get("/")
def serve_root():
    return FileResponse(ANGULAR_DIR / "index.html", media_type="text/html")


# ---------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------
@app.get("/health")
async def health() -> Dict[str, Any]:
    return {"ok": True, "status": "healthy", "version": app.version}


@app.get("/images/{user_id}")
async def get_user_image(user_id: int):
    path = await find_user_image_path(
        user_id=user_id,
        base_dir=BASE_DIR,
        images_dir=IMAGES_DIR,
        users_path=USERS_PATH,
    )
    if not path:
        raise HTTPException(status_code=404, detail="Image not found")
    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return FileResponse(path, media_type=media_type)


@app.get("/images/{user_id}/extra/{filename}")
async def get_user_extra_image(user_id: int, filename: str):
    path = find_user_extra_image_path(
        user_id=user_id,
        filename=filename,
        images_dir=IMAGES_DIR,
    )
    if not path:
        raise HTTPException(status_code=404, detail="Extra image not found")
    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return FileResponse(path, media_type=media_type)


@app.get("/images/{user_id}/extra")
async def list_user_extra_images(user_id: int):
    async with users_lock:
        users = await load_users(USERS_PATH)
        idx = find_user_index_by_userid(users, user_id)
        if idx is None:
            raise HTTPException(status_code=404, detail="User not found")

        extras = users[idx].get("extra_images") or []
        urls: List[str] = []
        for x in extras:
            fn = x.get("filename")
            if fn:
                urls.append(f"/images/{user_id}/extra/{fn}")

    return {"ok": True, "count": len(urls), "items": extras, "urls": urls}


@app.delete("/images/{user_id}/extra/{filename}")
async def delete_user_extra_image(user_id: int, filename: str):
    async with users_lock:
        users = await load_users(USERS_PATH)
        idx = find_user_index_by_userid(users, user_id)
        if idx is None:
            raise HTTPException(status_code=404, detail="User not found")

        user = users[idx]
        extras = user.get("extra_images") or []

        # ensure exists in metadata
        if not any(x.get("filename") == filename for x in extras):
            raise HTTPException(status_code=404, detail="Extra image not found")

        # delete file from disk (best-effort)
        path = find_user_extra_image_path(
            user_id=user_id,
            filename=filename,
            images_dir=IMAGES_DIR,
        )
        if path and path.exists():
            try:
                path.unlink()
            except Exception as e:
                log.warning("Failed to unlink extra image: %s (%s)", path, e)

        # remove metadata
        user["extra_images"] = [x for x in extras if x.get("filename") != filename]
        users[idx] = user
        await save_users(USERS_PATH, users)

    log.info("Deleted extra image: userID=%s file=%s", user_id, filename)
    return {"ok": True, "deleted": filename, "remaining": len(user["extra_images"])}


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
    c_image: Optional[UploadFile] = File(None),
    c_extra_images: Optional[List[UploadFile]] = File(None),  # extras as repeated key
    c_height: str = Form(...),
    c_education: str = Form(...),
    c_work: str = Form(...),
    c_children: str = Form(...),
    c_smoking: str = Form(...),
    c_url: str = Form(...),
    c_fb: str = Form(...),
    filter_height_min: str = Form(...),
    filter_height_max: str = Form(...),
    filter_age_min: str = Form(...),
    filter_age_max: str = Form(...),
    filter_family_status: str = Form(...),
    filter_smoking_status: str = Form(...),
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
        "c_height": c_height,
        "c_education": c_education,
        "c_work": c_work,
        "c_children": c_children,
        "c_smoking": c_smoking,
        "c_url": c_url,
        "c_fb": c_fb,
        "filter_height_min": filter_height_min,
        "filter_height_max": filter_height_max,
        "filter_age_min": filter_age_min,
        "filter_age_max": filter_age_max,
        "filter_family_status": filter_family_status,
        "filter_smoking_status": filter_smoking_status,
    }

    # upsert guarded by lock
    async with users_lock:
        stored_user = await upsert_user(USERS_PATH, user_fields)
    user_id = stored_user["userID"]

    # -------------------------
    # optional profile image
    # -------------------------
    if _has_real_file(c_image):
        ensure_image_content_type(c_image)
        image_bytes, image_size = await read_file(c_image)
        
        image_rel_path = save_image_to_disk(
            image_bytes=image_bytes,
            user_id=user_id,
            mime_type=c_image.content_type,
            images_dir=IMAGES_DIR,
            base_dir_for_rel=BASE_DIR,
        )
        stored_user.update(
            {
                "image_path": image_rel_path,
                "image_content_type": c_image.content_type,
                "image_size": image_size,
            }
        )
        async with users_lock:
            await upsert_user(USERS_PATH, stored_user)

        log.info("Upserted user (with profile image): email=%s userID=%s image=%s",
                 stored_user.get("c_email"), user_id, image_rel_path)
    else:
        log.info("Upserted user (no profile image change): email=%s userID=%s",
                 stored_user.get("c_email"), user_id)

    # -------------------------
    # optional extra images (APPEND, up to 5 total)
    # -------------------------
    if c_extra_images is not None:
        real_files = [f for f in (c_extra_images or []) if f and getattr(f, "filename", None)]

        # אם המשתמש לא העלה extras חדשים - לא נוגעים ברשימה הקיימת
        if real_files:
            existing: List[Dict[str, Any]] = list(stored_user.get("extra_images") or [])

            if len(existing) + len(real_files) > MAX_EXTRA_IMAGES:
                raise HTTPException(
                    status_code=400,
                    detail=f"Max {MAX_EXTRA_IMAGES} extra images allowed (already have {len(existing)}).",
                )

            new_meta: List[Dict[str, Any]] = []
            for up in real_files:
                ensure_image_content_type(up)
                bts, size = await read_file(up)
                
                guid = uuid.uuid4().hex
                rel_path = save_extra_image_to_disk(
                    image_bytes=bts,
                    user_id=user_id,
                    mime_type=up.content_type,
                    images_dir=IMAGES_DIR,
                    base_dir_for_rel=BASE_DIR,
                    guid=guid,
                )
                fn = Path(rel_path).name
                new_meta.append({
                    "path": rel_path,
                    "content_type": up.content_type,
                    "size": size,
                    "filename": fn,
                })

            stored_user["extra_images"] = existing + new_meta
            async with users_lock:
                await upsert_user(USERS_PATH, stored_user)

            log.info("Appended %d extra images (total=%d): email=%s userID=%s",
                     len(new_meta), len(stored_user["extra_images"]),
                     stored_user.get("c_email"), user_id)

    # response urls
    image_url = f"/images/{user_id}" if stored_user.get("image_path") else None

    extra_urls: List[str] = []
    for x in (stored_user.get("extra_images") or []):
        fn = x.get("filename")
        if fn:
            extra_urls.append(f"/images/{user_id}/extra/{fn}")

    return JSONResponse({
        "ok": True,
        "message": "User saved.",
        "user": stored_user,
        "image_url": image_url,
        "extra_image_urls": extra_urls,
    })


@app.get("/users")
async def get_users() -> JSONResponse:
    ensure_data_file(DATA_DIR, USERS_PATH)
    async with users_lock:
        users = await load_users(USERS_PATH)
    return JSONResponse({"ok": True, "count": len(users), "users": users})


@app.post("/login")
async def login(
    c_email: str = Form(...),
    password: str = Form(...),
):
    email = (c_email or "").strip().lower()
    async with users_lock:
        user, idx, users = await get_user_and_index_by_email(USERS_PATH, email)

    if not user or not verify_password(password, user):
        return JSONResponse({"ok": False, "message": "Invalid email or password."}, status_code=401)

    user["sessionID"] = uuid.uuid4().hex
    async with users_lock:
        users[idx] = user
        await save_users(USERS_PATH, users)

    user_sanitized = sanitize_user_for_response(user)
    user_id = user_sanitized.get("userID")
    image_url = f"/images/{user_id}" if user_id else None
    return JSONResponse({"ok": True, "message": "Login successful.", "user": user_sanitized, "image_url": image_url})


@app.post("/forgotPass")
async def forgot_pass(
    c_email: str = Form(...),
):
    email = (c_email or "").strip().lower()
    async with users_lock:
        user, idx, users = await get_user_and_index_by_email(USERS_PATH, email)

    if not user:
        return JSONResponse({"ok": False, "message": "Invalid email."}, status_code=401)

    pswd = user.get("password")
    status_code = send_mail(email, pswd)
    if 200 <= status_code < 300:
        return JSONResponse({"ok": True})
    return JSONResponse({"ok": False, "message": "Mail Sending Failed."})


@app.post("/search")
async def search_users(payload: Dict[str, Any]):
    users = await load_users(USERS_PATH)
    results = []

    for u in users:
        ok = True

        if payload.get("c_gender") not in (None, 9, "9"):
            if str(u.get("c_gender")) != str(payload["c_gender"]):
                ok = False

        if ok and payload.get("c_ff") not in (None, 9, "9"):
            if str(u.get("c_ff")) != str(payload["c_ff"]):
                ok = False

        if ok and payload.get("c_country") not in (None, 0, "0"):
            if str(u.get("c_country")) != str(payload["c_country"]):
                ok = False

        if ok and payload.get("c_phome"):
            if u.get("c_phome") != payload["c_phome"]:
                ok = False

        if ok and payload.get("c_tz") not in (None, 0, "0"):
            if str(u.get("c_tz")) != str(payload["c_tz"]):
                ok = False

        if ok and payload.get("c_pic"):
            if not u.get("image_path"):
                ok = False

        if ok and (payload.get("c_ages1") or payload.get("c_ages2")):
            try:
                y = int(u.get("c_birth_year", 0))
                if y:
                    age = 2025 - y
                    min_age = int(payload.get("c_ages1") or 0)
                    max_age = int(payload.get("c_ages2") or 0)
                    if (min_age and age < min_age) or (max_age and age > max_age):
                        ok = False
            except Exception:
                pass

        if ok and payload.get("c_name") not in (None, 0, "0"):
            name_db = (str(u.get("c_name")) or "").strip().lower()
            name_payload = (str(payload.get("c_name")) or "").strip().lower()
            if name_payload not in name_db:
                ok = False

        if ok:
            results.append(u)

    return {"ok": True, "count": len(results), "users": results}


@app.patch("/block")
async def block_user(payload: dict = Body(...)):
    userId = payload["userId"]
    blocked_userid = payload["blocked_userid"]

    ensure_data_file(DATA_DIR, USERS_PATH)
    users = await load_users(USERS_PATH)

    idx = find_user_index_by_userid(users, userId)
    if idx is None:
        raise HTTPException(status_code=404, detail="User not found")

    user = users[idx]

    if "block" not in user or not isinstance(user["block"], list):
        user["block"] = []

    if blocked_userid in user["block"]:
        user["block"].remove(blocked_userid)
        action = "unblocked"
    else:
        user["block"].append(blocked_userid)
        action = "blocked"

    users[idx] = user
    await save_users(USERS_PATH, users)

    return {
        "ok": True,
        "action": action,
        "userID": userId,
        "blocked_userID": blocked_userid,
        "block_list": user["block"],
    }


@app.post("/addMessage")
async def add_message(payload: SendMessagePayload):
    if payload.fromId == payload.toId:
        raise HTTPException(status_code=400, detail="fromId and toId must differ")

    message = {
        "id": uuid.uuid4().hex,
        "fromId": payload.fromId,
        "toId": payload.toId,
        "body": payload.body,
        "sentAt": payload.sentAt.isoformat(),
    }

    async with messages_lock:
        msgs = await load_messages(MESSAGES_PATH)
        msgs.append(message)
        await save_messages(MESSAGES_PATH, msgs)

    return {"ok": True, "message": message, "count": len(msgs)}


@app.get("/messages")
async def get_messages(
    userId: int = Query(..., alias="userId"),
    since: Optional[str] = Query(None),
):
    async with messages_lock:
        msgs = await load_messages(MESSAGES_PATH)

    users = await load_users(USERS_PATH)
    users_by_id = {int(u["userID"]): u.get("c_name", f"User {u['userID']}") for u in users}

    res = [m for m in msgs if int(m.get("toId", -1)) == userId]

    if since:
        from datetime import datetime
        try:
            t0 = datetime.fromisoformat(since.replace("Z", "+00:00"))

            def _is_after(m):
                s = m.get("sentAt")
                if not s:
                    return False
                try:
                    return datetime.fromisoformat(str(s).replace("Z", "+00:00")) >= t0
                except Exception:
                    return False

            res = [m for m in res if _is_after(m)]
        except Exception:
            pass

    for m in res:
        m["fromName"] = users_by_id.get(int(m.get("fromId", -1)), "Unknown")
        m["toName"] = users_by_id.get(int(m.get("toId", -1)), "Unknown")

    return {"ok": True, "count": len(res), "messages": res}


@app.post("/is_blocked_by_peer")
async def is_blocked(payload: dict = Body(...)):
    userId = payload["userId"]
    peerId = payload["peerId"]

    ensure_data_file(DATA_DIR, USERS_PATH)
    users = await load_users(USERS_PATH)

    useridx = find_user_index_by_userid(users, userId)
    if useridx is None:
        raise HTTPException(status_code=404, detail="User not found")

    peeridx = find_user_index_by_userid(users, peerId)
    if peeridx is None:
        raise HTTPException(status_code=404, detail="Peer not found")

    peer = users[peeridx]
    is_blocked = peer.get("block") and userId in peer["block"]
    return {"is_blocked": bool(is_blocked)}


# ---------------------------------------------------------------------
# SPA + static (mount LAST)
# ---------------------------------------------------------------------
class SpaStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope: Scope):
        log.info("Static request: /%s", path)
        response = await super().get_response(path, scope)
        if response.status_code == 404 and "." not in path:
            index_file = os.path.join(self.directory, "index.html")
            if os.path.exists(index_file):
                return FileResponse(index_file, media_type="text/html")
        return response


app.mount("/", SpaStaticFiles(directory=str(ANGULAR_DIR)), name="spa")


@app.get("/manifest.webmanifest")
def manifest():
    return FileResponse(ANGULAR_DIR / "manifest.webmanifest", media_type="application/manifest+json")


# ---------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
