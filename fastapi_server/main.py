# main.py
from __future__ import annotations

import asyncio
import logging
import mimetypes
import os
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import exists,and_
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Query, Body, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.encoders import jsonable_encoder
from starlette.responses import FileResponse, JSONResponse
from starlette.types import Scope

from models.payloads.sendmessage_payload import SendMessagePayload
from helper import decrypt_uid

# import routers
from routes.sms_updates import router2 as sms_updates_router
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
    pass_filter,
    get_user,
    get_system_chat_rooms,
    get_user_by_email_pass,
    apply_user_filters,
    get_user_by_email,
    hash_password,
    block_user,
    is_user_blocked,
    is_user_liked,
    search_user,
    like_user
)

from sendgrid_test.send_mail import send_mail
from schemas.chat_room import ChatRoomOut2
from schemas.user import UserBase
from db import get_db
from models.user import User
from models.chat_message import ChatMessage

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
app.include_router(sms_updates_router)

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

@app.get("/home")
def serve_root():
    return FileResponse(ANGULAR_DIR / "index.html", media_type="text/html")

@app.get("/register")
def serve_root():
    return FileResponse(ANGULAR_DIR / "index.html", media_type="text/html")

@app.get("/about-us")
def serve_root():
    return FileResponse(ANGULAR_DIR / "index.html", media_type="text/html")

@app.get("/contact")
def serve_root():
    return FileResponse(ANGULAR_DIR / "index.html", media_type="text/html")

@app.get("/search")
def serve_root():
    return FileResponse(ANGULAR_DIR / "index.html", media_type="text/html")

@app.get("/users")
def serve_root():
    return FileResponse(ANGULAR_DIR / "index.html", media_type="text/html")

@app.get("/album")
def serve_root():
    return FileResponse(ANGULAR_DIR / "index.html", media_type="text/html")

@app.get("/help")
def serve_root():
    return FileResponse(ANGULAR_DIR / "index.html", media_type="text/html")


@app.get("/user/{userid}")
def serve_root():
    return FileResponse(ANGULAR_DIR / "index.html", media_type="text/html")


# ---------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------
@app.get("/health")
async def health() -> Dict[str, Any]:
    return {"ok": True, "status": "healthy", "version": app.version}


@app.get("/images/{user_id}")
async def get_user_image(user_id: int, db: Session = Depends(get_db)):
    '''
    path = await find_user_image_path(
        user_id=user_id,
        base_dir=BASE_DIR,
        images_dir=IMAGES_DIR,
        users_path=USERS_PATH,
    )
    '''
    path = get_user(db, user_id).image_path
    if not path:
        path = "data/images/default-avatar.jpg"
        #raise HTTPException(status_code=404, detail="Image not found")
    
    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return FileResponse(path, media_type=media_type)


@app.get("/images/{user_id}/extra/{filename}")
async def get_user_extra_image(user_id: int, filename: str, db: Session = Depends(get_db)):
    
    path =  f"data/images/{user_id}/extra/{filename}" 
    if not path:
        raise HTTPException(status_code=404, detail="Extra image not found")
    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return FileResponse(path, media_type=media_type)


@app.get("/images/{user_id}/extra")
async def list_user_extra_images(user_id: int, db: Session = Depends(get_db)):
    async with users_lock:
        extras = get_user(db, user_id).extra_images or []
        urls: List[str] = []
        for x in extras:
            fn = x.get("filename")
            if fn:
                urls.append(f"/images/{user_id}/extra/{fn}")

    return {"ok": True, "count": len(urls), "items": extras, "urls": urls}


@app.delete("/images/{user_id}/extra/{filename}")
async def delete_user_extra_image(user_id: int, filename: str, db: AsyncSession = Depends(get_db)):
    
  user = get_user(db, user_id)
  extras = user.extra_images or []
   
  # ensure exists in metadata
  if not any(x.get("filename") == filename for x in extras):
    raise HTTPException(status_code=404, detail="Extra image not found")
    
  # remove from metadata
  user.extra_images = [x for x in extras if x.get("filename") != filename]
  db.commit()

  path = Path("data") / "images" / str(user_id) / "extra" / filename
  if path and path.exists():
    try:
      path.unlink()
    except Exception as e:
      log.warning("Failed to unlink extra image: %s (%s)", path, e)


  log.info("Deleted extra image: userID=%s file=%s", user_id, filename)
  return {"ok": True, "deleted": filename, "remaining": len(user.extra_images)}


@app.post("/register")
async def register(
    db: Session = Depends(get_db),

    c_name: str = Form(...),
    c_gender: str = Form(...),
    c_birth_day: str = Form(...),
    c_birth_month: str = Form(...),
    c_birth_year: str = Form(...),
    c_country: str = Form(...),
    c_email: str = Form(...),
    c_ff: str = Form(...),

    password: Optional[str] = Form(None),
    password2: Optional[str] = Form(None),

    sessionID: str = Form(...),
    c_pcell: str = Form(""),
    c_details: str = Form(""),
    c_details1: str = Form(""),

    c_image: Optional[UploadFile] = File(None),
    c_extra_images: Optional[List[UploadFile]] = File(None),

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

    # (optional) convert numeric strings to int here if your DB columns are integers
    def to_int(v: Any) -> Optional[int]:
        try:
            if v is None or v == "":
                return None
            return int(v)
        except Exception:
            return None

    user_fields: Dict[str, Any] = {
        "name": c_name,
        "gender": to_int(c_gender),
        "birth_day": to_int(c_birth_day),
        "birth_month": to_int(c_birth_month),
        "birth_year": to_int(c_birth_year),
        "country": to_int(c_country),
        "phone": c_pcell,
        "email": c_email,
        "ff": to_int(c_ff),
        "details": c_details,
        "details1": c_details1,
        "sessionID": sessionID,

        # NOTE: upsert_user must NOT update password on update
        "password": password,
        "password2": password2,

        "height": to_int(c_height),
        "education": to_int(c_education),
        "work": to_int(c_work),
        "children": to_int(c_children),
        "smoking": to_int(c_smoking),
        "url": c_url,
        "fb": c_fb,

        "filter_height_min": to_int(filter_height_min),
        "filter_height_max": to_int(filter_height_max),
        "filter_age_min": to_int(filter_age_min),
        "filter_age_max": to_int(filter_age_max),
        "filter_family_status": filter_family_status,          # CSV like "1,2,3"
        "filter_smoking_status": str(filter_smoking_status),   # keep as string if column is string
    }

    stored_user, created = upsert_user(db, user_fields)
    user_id = stored_user.id

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

        # ✅ ORM attributes (NOT dict)
        stored_user.image_path = image_rel_path
        stored_user.image_content_type = c_image.content_type
        stored_user.image_size = image_size

        db.commit()
        db.refresh(stored_user)

        log.info("Upserted user (with profile image): email=%s userID=%s image=%s",
                 stored_user.email, user_id, image_rel_path)
    else:
        log.info("Upserted user (no profile image change): email=%s userID=%s",
                 stored_user.email, user_id)

    # -------------------------
    # optional extra images (APPEND, up to 5 total)
    # -------------------------
    if c_extra_images:
        real_files = [f for f in c_extra_images if f and getattr(f, "filename", None)]

        if real_files:
            existing: List[Dict[str, Any]] = list(stored_user.extra_images or [])

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

            # ✅ ORM attribute (JSONB column)
            stored_user.extra_images = existing + new_meta

            db.commit()
            db.refresh(stored_user)

            log.info("Appended %d extra images (total=%d): email=%s userID=%s",
                     len(new_meta), len(stored_user.extra_images or []),
                     stored_user.email, user_id)

    # -------------------------
    # response urls
    # -------------------------
    image_url = f"/images/{user_id}" if stored_user.image_path else None

    extra_urls: List[str] = []
    for x in (stored_user.extra_images or []):
        fn = x.get("filename")
        if fn:
            extra_urls.append(f"/images/{user_id}/extra/{fn}")

    # ✅ Make user JSON serializable
    return JSONResponse({
        "ok": True,
        "created": created,
        "message": "User saved.",
        "user": jsonable_encoder(stored_user),
        "image_url": image_url,
        "extra_image_urls": extra_urls,
    })


@app.post("/users", response_model=list[UserBase])
async def get_users(payload: dict = Body(...), db: Session = Depends(get_db)):
    # accept either userId or userid
    user_id = payload.get("userId")
    if not user_id:
        raise HTTPException(status_code=400, detail="Missing userId")

    me = db.query(User).filter(User.id == int(user_id)).first()
    if not me:
        raise HTTPException(status_code=404, detail="User not found")

    q = db.query(User)
    q = apply_user_filters(q, me)

    onlyUsersThatLikedMe = payload.get("onlyUsersThatLikedMe")
    
    if onlyUsersThatLikedMe: 
      q = q.filter(
        exists().where(
            and_(
                ChatMessage.from_user_id == User.id,
                ChatMessage.to_user_id == me.id,
                ChatMessage.content.like("%קבלת לייק מ%")
            )
        )
      )


    return q.all()
    '''
    ensure_data_file(DATA_DIR, USERS_PATH)
    async with users_lock:
        users = await load_users(USERS_PATH)
        user_id = payload["userId"]
        idx = find_user_index_by_userid(users, user_id)
        user = users[idx]
        filtered_users = [u for u in users if u.get("userID") != user.get("userID") and pass_filter(u, user)]
       
    return JSONResponse({"ok": True, "count": len(filtered_users), "users": filtered_users})
    '''

@app.post("/login", response_model=UserBase)
async def login(
    c_email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    
    c_email = (c_email or "").strip().lower()
    return get_user_by_email_pass(db, c_email, password)

    '''
    email = (c_email or "").strip().lower()
    async with users_lock:
        user, idx, users = await get_user_and_index_by_email(USERS_PATH, email)
    
    if not user or not verify_password(password, user):
        return JSONResponse({"ok": False, "message": "Invalid email or password."}, status_code=401)

    user["sessionID"] = uuid.uuid4().hex
    async with users_lock:
        users[idx] = user
        await save_users(USERS_PATH, users)

    filtered_users = [u for u in users if u.get("userID") != user.get("userID") and pass_filter(u, user)]
    
    user_sanitized = sanitize_user_for_response(user)
    user_id = user_sanitized.get("userID")
    image_url = f"/images/{user_id}" if user_id else None
    return JSONResponse({"ok": True, "message": "Login successful.", "user": user_sanitized, "image_url": image_url, "users": filtered_users})
    '''

@app.post("/forgotPass")
async def forgot_pass(
    c_email: str = Form(...),
    db: Session = Depends(get_db)
):

    email = (c_email or "").strip().lower()    
    user = get_user_by_email(db,email)

    uid = user.id
    status_code = send_mail(email, uid)
    if 200 <= status_code < 300:
        return JSONResponse({"ok": True})
    return JSONResponse({"ok": False, "message": "Mail Sending Failed."})

@app.post("/reset-password")
async def reet_pass(payload: dict = Body(...),db: Session = Depends(get_db)):
    password = payload["password"]
    uid = decrypt_uid(payload["uid"])
    user = get_user(db, uid)
    user.password_hash = hash_password(password)
    db.commit()

@app.post("/search", response_model=list[UserBase])
async def search_users(payload: Dict[str, Any], db: Session = Depends(get_db)):
    user_id = payload.get("userId")
    if not user_id:
        raise HTTPException(status_code=400, detail="Missing userId")

    me = db.query(User).filter(User.id == int(user_id)).first()
    if not me:
        raise HTTPException(status_code=404, detail="User not found")
    
    c_gender = payload.get("c_gender")
    c_ff = payload.get("c_ff")
    c_country = payload.get("c_country") 
    c_smoking = payload.get("c_smoking")
    c_tz = payload.get("c_tz")
    c_pic = payload.get("c_pic")
    c_ages1 = payload.get("c_ages1") 
    c_ages2 =  payload.get("c_ages2")
    c_name = payload.get("c_name")

    q=search_user(db, c_gender, c_ff, c_country, c_smoking, c_tz, c_pic, c_ages1, c_ages2, c_name)
    return apply_user_filters(q,me)    
       

@app.post("/isLiked")
async def is_liked(payload: dict = Body(...), db: Session = Depends(get_db)) :
    user_id = payload.get("from_user_id")
    peer_id = payload.get("to_user_id")
    is_liked = is_user_liked(db, user_id, peer_id)
    return is_liked



@app.patch("/block")
def toggle_block(payload: dict = Body(...), db: Session = Depends(get_db)):
    user_id = int(payload.get("userId", 0))
    blocked_user_id = int(payload.get("blocked_userid", 0))
    return block_user(db, user_id, blocked_user_id) 


@app.patch("/like")
async def toggle_like(payload: dict = Body(...), db: Session = Depends(get_db)):
    user_id = int(payload.get("userId", 0))
    liked_user_id = int(payload.get("liked_userid", 0))
    return like_user(db, user_id, liked_user_id) 


@app.post("/addMessage")
async def add_message(
    payload: SendMessagePayload,
    db: session = Depends(get_db),
):
    if payload.fromId == payload.toId:
        raise HTTPException(
            status_code=400,
            detail="fromId and toId must differ",
        )

    async with db.begin():  # 🔒 single transaction
        await get_or_create_room(db, payload.room_id)

        message = ChatMessage(
            id=uuid.uuid4().hex,
            room_id=payload.room_id,
            from_user_id=payload.fromId,
            to_user_id=payload.toId,
            content=payload.body,
            sent_at=payload.sentAt,
        )

        db.add(message)

    # no explicit commit needed — handled by `begin()`

    return {
        "ok": True,
        "message": {
            "id": message.id,
            "room_id": message.room_id,
            "fromId": message.from_user_id,
            "toId": message.to_user_id,
            "body": message.content,
            "sentAt": message.sent_at.isoformat(),
        },
    }



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
async def is_blocked(payload: dict = Body(...), db: Session = Depends(get_db)):
    user_id = payload["userId"]
    peer_id = payload["peerId"]
    is_blocked = is_user_blocked(db, user_id, peer_id)
    return is_blocked

@app.get("/chat_rooms", response_model=List[ChatRoomOut2])
async def list_chat_rooms(db: Session = Depends(get_db)):
    return get_system_chat_rooms(db)

@app.post("/user/{userid}", response_model=UserBase)
async def get_user_by_id(userid: int, db: Session = Depends(get_db)):
  return get_user(db,userid)

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


@app.get("/manifest.webmanifest")
def manifest():
    return FileResponse(ANGULAR_DIR / "manifest.webmanifest", media_type="application/manifest+json")

app.mount("/", SpaStaticFiles(directory=str(ANGULAR_DIR)), name="spa")



# ---------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
