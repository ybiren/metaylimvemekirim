# helper.py
from __future__ import annotations

import json
import mimetypes
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, UploadFile, Depends, status
from datetime import date,datetime,timezone
import bcrypt
from models.user import User
from models.chat_room import ChatRoom
from models.user_blocks import UserBlock
from models.user_likes  import UserLike
from models.push_subscription import PushSubscription
from passlib.context import CryptContext
from sqlalchemy import and_, or_, select, exists, func
from sqlalchemy.exc import IntegrityError
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.orm import Session
from pywebpush import webpush, WebPushException
import os

def get_user(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db, c_email: str):
    user = db.query(User).filter(User.email == c_email).first()
    if not user:
      raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bad credentials")
    return user


pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto")

def get_user_by_email_pass(db, c_email: str, password: str):
    user = (
        db.query(User)
        .filter(User.email == c_email)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bad credentials"
        )

    if not pwd_context.verify(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bad credentials"
        )

    # ✅ Update last_seen_at
    user.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    return user

def get_system_chat_rooms(db: Session):
    return (
        db.query(ChatRoom)
        .filter(ChatRoom.id < 0)
        .order_by(ChatRoom.id)
        .all()
    )


def calc_age_py(day, month, year):
    if not (day and month and year):
        return None
    try:
        born = date(int(year), int(month), int(day))
    except ValueError:
        return None
    today = date.today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def apply_user_filters(q, me):
    q = q.filter(User.id != me.id)

    my_height = me.height
    if my_height is not None and my_height > 0:
        q = q.filter(
          or_(
                User.filter_height_min.is_(None),
                User.filter_height_max.is_(None),
            and_(
                User.filter_height_min <= my_height,
                User.filter_height_max >= my_height,
            ),
          )
        )
    else:
       pass
    

    my_age = calc_age_py(me.birth_day, me.birth_month, me.birth_year)
    if my_age is not None:
       q = q.filter(
         or_(
           User.filter_age_min.is_(None),
           User.filter_age_max.is_(None),
           and_(
             User.filter_age_min <= my_age,
             User.filter_age_max >= my_age,
           ),
         )
       )
    else:
       pass
    
    my_ff = me.ff
    if my_ff is not None:
        q = q.filter(
            or_(
                User.filter_family_status.is_(None),     # no filter
                User.filter_family_status == "",         # no filter (if you store empty string)
                User.filter_family_status == "0",        # no filter (if you use "0" meaning all)
                ("," + User.filter_family_status + ",").contains(f",{int(my_ff)},")
            )
        )
    else:
        pass
    
    my_smoking = me.smoking
    if my_smoking is not None:
        q = q.filter(
            or_(
                User.filter_smoking_status.is_(None),           # no filter
                User.filter_smoking_status == "0",              # no filter
                User.filter_smoking_status == str(int(my_smoking)),
            )
        )
    else:
        pass

    
    return q


def hash_password(raw: str) -> str:
    return pwd_context.hash(raw)

def upsert_user(db: Session, user_fields: Dict[str, Any]) -> Tuple[User, bool]:
    """
    Upsert by email (SYNC):
    - if email exists -> update (EXCEPT password/password2)
    - else -> insert (can include password/password2)
    Returns: (user, created: bool)
    """
    email = (user_fields.get("email") or "").strip().lower()
    if not email:
        raise ValueError("email is required for upsert")

    data = dict(user_fields)
    data["email"] = email

    # find existing user by email
    stmt = select(User).where(User.email == email)
    res = db.execute(stmt)
    user = res.scalar_one_or_none()

    if user is None:
        # INSERT
        raw_password = data.pop("password", None)
        data.pop("password2", None)
        if not raw_password:
            raise ValueError("password is required when creating a user")

        data["password_hash"] = hash_password(raw_password)
        
        user = User(**data)
        db.add(user)
        created = True
    else:
        # UPDATE (do NOT update password/password2)
        data.pop("password", None)
        data.pop("password2", None)

        for k, v in data.items():
            if k in {"id", "email"}:
                continue
            # choose policy: skip None updates
            if v is None:
                continue
            setattr(user, k, v)

        created = False

    db.commit()
    db.refresh(user)
    return user, created

####################################################################
def block_user(db: Session, user_id, blocked_user_id):

    if user_id <= 0 or blocked_user_id <= 0:
        raise HTTPException(status_code=400, detail="userId and blocked_userid are required")
    if user_id == blocked_user_id:
        raise HTTPException(status_code=400, detail="cannot block yourself")

    # check if block exists
    stmt = select(UserBlock).where(
        UserBlock.user_id == user_id,
        UserBlock.blocked_user_id == blocked_user_id,
    )
    existing = db.execute(stmt).scalar_one_or_none()

    if existing:
        # delete (toggle off)
        db.delete(existing)
        db.commit()
        return {"blocked": False}
    else:
        # insert (toggle on)
        db.add(UserBlock(user_id=user_id, blocked_user_id=blocked_user_id))
        try:
            db.commit()
        except IntegrityError:
            # In case of race condition (two requests at once)
            db.rollback()
            return {"blocked": True}

        return {"blocked": True}


####################################################################
def like_user(db: Session, user_id, liked_user_id):

    if user_id <= 0 or liked_user_id <= 0:
        raise HTTPException(status_code=400, detail="userId and liked_userid are required")
    if user_id == liked_user_id:
        raise HTTPException(status_code=400, detail="cannot like yourself")

    # check if block exists
    stmt = select(UserLike).where(
        UserLike.user_id == user_id,
        UserLike.liked_user_id == liked_user_id,
    )
    existing = db.execute(stmt).scalar_one_or_none()

    if existing:
        # delete (toggle off)
        db.delete(existing)
        db.commit()
        return {"liked": False}
    else:
        # insert (toggle on)
        db.add(UserLike(user_id=user_id, liked_user_id=liked_user_id))
        send_push(db,liked_user_id,"מישהו מחבב אותך","מישהו מחבב אותך")
        try:
            db.commit()
        except IntegrityError:
            # In case of race condition (two requests at once)
            db.rollback()
            return {"liked": True}

        return {"liked": True}
        
####################################################################
def is_user_blocked(
    db: Session,
    user_id: int,
    peer_id: int,
) -> bool:
    stmt = select(
        exists().where(
            (UserBlock.user_id == user_id) &
            (UserBlock.blocked_user_id == peer_id)
        )
    )

    return db.execute(stmt).scalar()

####################################################################
def is_user_liked(
    db: Session,
    user_id: int,
    peer_id: int,
) -> bool:
    stmt = select(
        exists().where(
            (UserLike.user_id == user_id) &
            (UserLike.liked_user_id == peer_id)
        )
    )

    return db.execute(stmt).scalar()

####################################################################
def search_user(
    db: Session,
    c_gender, c_ff, c_country, c_smoking,
    c_tz, c_pic, c_ages1, c_ages2, c_name
):
    query = db.query(User)

    if c_gender not in (None, 9, "9"):
        query = query.filter(User.gender == int(c_gender))

    if c_ff not in (None, 9, "9"):
        query = query.filter(User.ff == int(c_ff))

    if c_country not in (None, 0, "0"):
        query = query.filter(User.country == int(c_country))

    if c_smoking:
        query = query.filter(User.smoking == int(c_smoking))

    if c_tz not in (None, 0, "0"):
        query = query.filter(User.c_tz == int(c_tz))

    if c_pic:
        query = query.filter(
            User.image_path.is_not(None),
            User.image_path != ""
        )

    if c_ages1 or c_ages2:
        current_year = date.today().year
        min_age = int(c_ages1 or 0)
        max_age = int(c_ages2 or 0)

        query = query.filter(
            User.birth_year.is_not(None),
            User.birth_year > 0
        )

        if min_age:
            query = query.filter(
                User.birth_year <= current_year - min_age
            )
        if max_age:
            query = query.filter(
                User.birth_year >= current_year - max_age
            )

    if c_name not in (None, 0, "0"):
        name = str(c_name).strip()
        if name:
            query = query.filter(
                User.name.ilike(f"%{name}%")
            )

    return query

####################################################################
def freeze_user_db(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.isfreezed = not user.isfreezed

    db.commit()
    db.refresh(user)

    return user

####################################################################
def insert_push_subscription(
    db: Session,
    user_id: int,
    subscription: dict,
    user_agent: str | None = None,
) -> PushSubscription:
    endpoint = subscription.get("endpoint")
    if not endpoint:
        raise ValueError("subscription.endpoint is missing")

    # 1) אם כבר קיים endpoint → עדכון
    existing = db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    ).scalar_one_or_none()

    if existing:
        print("existing")
        existing.user_id = user_id
        existing.subscription = subscription
        existing.user_agent = user_agent
        existing.updated_at = func.now()
        try:
            db.commit()
        except IntegrityError:
            print("IntegrityError 1")
            db.rollback()
            raise
        db.refresh(existing)
        return existing

    # 2) אחרת → יצירה
    row = PushSubscription(
        user_id=user_id,
        endpoint=endpoint,
        subscription=subscription,
        user_agent=user_agent,
    )
    print("adding")
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        print("IntegrityError 2")
        # Race condition: מישהו אחר הכניס את אותו endpoint רגע לפני commit
        db.rollback()
        existing = db.execute(
            select(PushSubscription).where(PushSubscription.endpoint == endpoint)
        ).scalar_one()

        existing.user_id = user_id
        existing.subscription = subscription
        existing.user_agent = user_agent
        existing.updated_at = func.now()    
        db.commit()
        db.refresh(existing)
        return existing

    db.refresh(row)
    return row

####################################################################
fernet_generated_key = "Tugx8RapMBvTgNw1K0L8Q1MVLOgReBOXSv3hs-W-p3M="
# init Fernet with the key
fernet = Fernet(fernet_generated_key.encode())

####################################################################
def encrypt_uid(uid: str) -> str:
    """
    Encrypt uid and return URL-safe token
    """
    token: bytes = fernet.encrypt(str(uid).encode())
    return token.decode()


####################################################################
def decrypt_uid(token: str, ttl_seconds: int = 3600) -> str:
    """
    Decrypt token back to uid (with TTL validation)
    """
    try:
        uid_bytes: bytes = fernet.decrypt(
            token.encode(),
            ttl=ttl_seconds,
        )
        return uid_bytes.decode()
    except InvalidToken:
        raise ValueError("Invalid or expired token")

# -----------------------------
# Image helpers
# -----------------------------
def ensure_image_content_type(upload: UploadFile) -> None:
    if not upload.content_type or not upload.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type (expecting an image).")


async def read_file(upload: UploadFile) -> Tuple[bytes, int]:
    total = 0
    chunks: List[bytes] = []
    try:
        while True:
            chunk = await upload.read(64 * 1024)  # 64KB
            if not chunk:
                break
            total += len(chunk)
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
    """
    Save the *profile* image as:
      data/images/<user_id>.<ext>
    Returns relative path from base_dir_for_rel.
    """
    ext = mimetypes.guess_extension(mime_type) or ".bin"
    ext = _normalize_jpeg_ext(ext)
    filename = f"{user_id}{ext}"
    image_path = images_dir / filename
    image_path.write_bytes(image_bytes)
    return str(image_path.resolve().relative_to(base_dir_for_rel))


def save_extra_image_to_disk(
    image_bytes: bytes,
    user_id: int,
    mime_type: str,
    images_dir: Path,
    base_dir_for_rel: Path,
    guid: str,
) -> str:
    """
    Save an *extra* image as:
      data/images/<user_id>/extra/<guid>.<ext>
    Returns relative path from base_dir_for_rel.
    """
    ext = mimetypes.guess_extension(mime_type) or ".bin"
    ext = _normalize_jpeg_ext(ext)

    user_extra_dir = images_dir / str(user_id) / "extra"
    user_extra_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{guid}{ext}"
    path = user_extra_dir / filename
    path.write_bytes(image_bytes)
    return str(path.resolve().relative_to(base_dir_for_rel))


async def find_user_image_path(
    user_id: int,
    base_dir: Path,
    images_dir: Path,
    users_path: Path,
    allowed_exts: set[str] | None = None,
) -> Optional[Path]:
    allowed_exts = allowed_exts or {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
    
    for ext in allowed_exts:
        cand = (images_dir / f"{user_id}{ext}").resolve()
        if cand.exists():
            print(cand)
            return cand
    return None


def find_user_extra_image_path(
    user_id: int,
    filename: str,
    images_dir: Path,
) -> Optional[Path]:
    """
    Resolve:
      data/images/<user_id>/extra/<filename>

    Includes basic protection against path traversal.
    """
    if not filename or "/" in filename or "\\" in filename or ".." in filename:
        return None

    cand = (images_dir / str(user_id) / "extra" / filename).resolve()

    # Ensure it's inside images_dir
    try:
        cand.relative_to(images_dir.resolve())
    except Exception:
        return None

    return cand if cand.exists() else None


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
    for i, u in enumerate(users):
        if u.get("userID") == user_id:
            return i
    return None


'''
async def upsert_user(users_path: Path, user_fields: Dict[str, Any]) -> Dict[str, Any]:
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
'''

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


async def get_user_and_index_by_email(
    users_path: Path, email: str
) -> Tuple[Optional[Dict[str, Any]], Optional[int], List[Dict[str, Any]]]:
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


def calc_age(day, month, year, today: date | None = None) -> int | None:
    if today is None:
        today = date.today()

    try:
        if day is None or month is None or year is None:
            return None

        d = int(day)
        m = int(month)
        y = int(year)

        # אצלך ב-select יש "0" כברירת מחדל
        if d <= 0 or m <= 0 or y <= 0:
            return None

        born = date(y, m, d)
    except (ValueError, TypeError):
        return None

    age = today.year - born.year
    # אם עוד לא עבר יום הולדת השנה - מורידים 1
    if (today.month, today.day) < (born.month, born.day):
        age -= 1

    return age

def to_int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def pass_filter(loggedin_user: dict, checked_user: dict) -> bool:
    # --- Height filter ---
    h = to_int(checked_user.get("c_height"))
    hmin = to_int(loggedin_user.get("filter_height_min"))
    hmax = to_int(loggedin_user.get("filter_height_max"))
    if h is not None and hmin is not None and hmax is not None:
        if not (hmin <= h <= hmax):
            return False

    # --- Age filter ---
    amin = to_int(loggedin_user.get("filter_age_min"))
    amax = to_int(loggedin_user.get("filter_age_max"))
    if amin is not None and amax is not None:
        age = calc_age(
            checked_user.get("c_birth_day"),
            checked_user.get("c_birth_month"),
            checked_user.get("c_birth_year"),
        )
        # אם אין תאריך לידה תקין - לא עובר פילטר גיל
        if age is None or not (amin <= age <= amax):
            return False

    # --- Family status filter ---
    fam_filter = loggedin_user.get("filter_family_status")
    fam_value = checked_user.get("c_ff")
    if fam_filter is not None and fam_value is not None:
       if fam_value not in fam_filter:
         return False

    # --- Smoking filter ---
    smoke_filter = loggedin_user.get("filter_smoking_status")
    smoke_value = checked_user.get("c_smoking")
    if smoke_filter is not None and smoke_value is not None and smoke_filter!="0":
        if smoke_filter != smoke_value:
            return False

    return True
 

# -----------------------------
# Messages helpers
# -----------------------------
async def load_messages(path: Path) -> list[dict]:
    ensure_data_file(path.parent, path)
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


#-----------------------
# Send Push
#----------------------
def get_user_subscriptions(db: Session, user_id: int) -> list[PushSubscription]:
    return db.execute(
        select(PushSubscription).where(PushSubscription.user_id == user_id)
    ).scalars().all()


def delete_subscription_by_endpoint(db: Session, endpoint: str) -> None:
    db.query(PushSubscription).filter(
        PushSubscription.endpoint == endpoint
    ).delete()
    db.commit()

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "qgga9O0iJ4DwNhuhO5wUqdddUYnUtGUZbhOIyysWCV0")
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:admin@metaylimvemekirim.co.il")

def send_push(
    db: Session,
    user_id: int,
    title: str,
    body: str
) -> dict:
    """
    Send push notification to ALL subscriptions of a user.
    Automatically deletes dead subscriptions (404 / 410).
    """

    payload = {
        "title": title,
        "body": body,
         "data": {
           "url": f"/user/{user_id}"
        },
    }

    subs = get_user_subscriptions(db, user_id)

    if not subs:
        return {"sent": 0, "deleted": 0}

    sent = 0
    deleted = 0

    for sub in subs:
        try:
            webpush(
                subscription_info=sub.subscription,
                data=json.dumps(payload),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT},
            )
            sent += 1

        except WebPushException as e:
            status = getattr(e.response, "status_code", None)

            # 🔥 subscription is dead → delete it
            if status in (404, 410):
                delete_subscription_by_endpoint(db, sub.endpoint)
                deleted += 1
            else:
                # keep subscription, just log error
                print("Push failed:", repr(e))

    return {
        "sent": sent,
        "deleted": deleted,
        "total": len(subs),
    }