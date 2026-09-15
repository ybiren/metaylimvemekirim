"""Who is allowed to use /admin, and the check every admin request goes through.

The rest of this app authenticates nothing: endpoints take a userId from the
request and believe it. That is a tolerable trade for a profile page, and not
one for endpoints that block accounts and rewrite the site's pages - a browser
is not the thing being trusted here, so a route guard in Angular would only
hide the screens while leaving the API open to anyone with curl.

So the admin surface gets a real credential. Signing in returns a random token,
the browser sends it back on every admin request, and require_admin resolves it
to a row that still has is_admin set. Nothing about the caller is taken from
the request itself.

The flag is granted in the database and nowhere else (sql/admin_login.sql).
There is deliberately no screen for it: an endpoint that grants admin is an
endpoint that can be tricked into granting admin.
"""

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Form, Header, HTTPException, status
from sqlalchemy.orm import Session

from db import get_db
from helper import pwd_context
from models.user import User
from schemas.user import UserBase

log = logging.getLogger("admin_auth")

admin_auth_router = APIRouter(prefix="/api/admin", tags=["admin-auth"])

# How long a signed-in admin stays signed in. Short enough that a laptop left
# open in a cafe stops being a way in by the next morning, long enough to get a
# day's work done without signing in twice.
TOKEN_TTL = timedelta(hours=12)

# One message for every way of failing to sign in: wrong address, wrong
# password, right password on an account without the flag. Telling them apart
# would turn this form into a way of discovering which address is the admin.
_BAD = "פרטי הכניסה אינם נכונים."


def _now() -> datetime:
    return datetime.now(timezone.utc)


@admin_auth_router.post("/login")
def admin_login(
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    """Exchange an admin's ordinary site password for an admin token."""
    address = (email or "").strip().lower()
    user = db.query(User).filter(User.email == address).first()

    # Every branch answers the same thing; they are separate only so the log
    # says which one it was.
    if not user:
        log.info("Admin login refused: no such address")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_BAD)

    if not user.password_hash or not pwd_context.verify(password, user.password_hash):
        log.info("Admin login refused: bad password for userID=%s", user.id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_BAD)

    if not user.is_admin or user.is_blocked or user.isdeleted:
        log.warning("Admin login refused: userID=%s is not an admin", user.id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_BAD)

    # A fresh token per sign-in, so signing in again anywhere ends the previous
    # session rather than leaving two live credentials on one account.
    user.admin_token = secrets.token_urlsafe(48)
    user.admin_token_at = _now()
    # Same as any other sign-in: this is one, so it counts as being seen.
    user.last_seen_at = _now()
    db.commit()
    db.refresh(user)

    # Signing in here also signs them into the site as themselves: an admin is a
    # member with a flag, not a separate kind of account, and logging in twice to
    # be both would be a chore with nothing to recommend it.
    #
    # Through UserBase, the schema the ordinary login answers with, so the
    # browser stores exactly what a normal sign-in would have given it - and so
    # that is_admin, which the schema does not carry, stays off the wire. That
    # schema also serves the public user lists, and a field there would tell
    # every visitor which accounts are admins.
    log.info("Admin signed in: userID=%s", user.id)
    return {
        "token": user.admin_token,
        "name": user.name,
        "id": user.id,
        "user": UserBase.model_validate(user),
    }


def require_admin(
    x_admin_token: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the token on an admin request to the admin it belongs to.

    Attached to the admin routers in main.py, so it covers every endpoint they
    carry - including ones added later, which is the point of putting it there
    rather than on each route.
    """
    token = (x_admin_token or "").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="נדרשת כניסת מנהל."
        )

    user = db.query(User).filter(User.admin_token == token).first()

    # Re-checked on every request, not just at sign-in: revoking is_admin in the
    # database has to take effect now, not in twelve hours.
    if not user or not user.is_admin or user.is_blocked or user.isdeleted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="נדרשת כניסת מנהל."
        )

    issued = user.admin_token_at
    if not issued:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="נדרשת כניסת מנהל."
        )

    # Rows written before this column existed come back naive; treat them as UTC
    # rather than throwing a TypeError on the comparison.
    if issued.tzinfo is None:
        issued = issued.replace(tzinfo=timezone.utc)

    if _now() - issued > TOKEN_TTL:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="תוקף הכניסה פג. יש להתחבר מחדש."
        )

    return user


@admin_auth_router.post("/logout")
def admin_logout(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Drop the token, so the copy in the browser stops being worth anything."""
    admin.admin_token = None
    admin.admin_token_at = None
    db.commit()
    log.info("Admin signed out: userID=%s", admin.id)
    return {"ok": True}


@admin_auth_router.get("/me")
def admin_me(admin: User = Depends(require_admin)):
    """Is this token still good?

    The Angular guard asks on every entry to /admin, so a token that was revoked
    or has expired sends them to the login screen instead of into a set of
    screens where every request is about to fail.
    """
    return {"ok": True, "id": admin.id, "name": admin.name, "email": admin.email}
