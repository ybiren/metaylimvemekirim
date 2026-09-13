"""Sign in with Google or Facebook.

The provider is the only thing that authenticates anyone here: the browser
hands us a token it received from Google/Facebook and the server asks the
provider who it belongs to. The email address is never taken from the request
body - only from the provider's answer, and only after the token has been
checked against our own client id. A token minted for some other site is worth
nothing.

A social login signs in an existing member; it does not create one. Registering
on this site means filling in a whole profile (gender, birth date, region, what
you are looking for) that neither provider can supply, so an unknown address
gets a 404 and the client walks the visitor to /register with their name and
address already typed in.
"""

import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Tuple

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db import get_db
from models.user import User
from schemas.user import UserBase

BASE_DIR = Path(__file__).resolve().parent.parent

# Same pattern as routes/bot.py: dev machines have no exported env vars, prod
# gets them from the shell that starts uvicorn, and load_dotenv does not
# overwrite what is already exported.
load_dotenv(BASE_DIR / ".env")

log = logging.getLogger("social_login")

social_login_router = APIRouter(tags=["social-login"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
FACEBOOK_APP_ID = os.getenv("FACEBOOK_APP_ID", "")
FACEBOOK_APP_SECRET = os.getenv("FACEBOOK_APP_SECRET", "")

GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
FACEBOOK_GRAPH = "https://graph.facebook.com/v19.0"

HTTP_TIMEOUT = 10.0

# Shown whenever a token does not check out. Deliberately vague: the visitor
# cannot fix a bad token by reading about it, and neither can an attacker.
_BAD_TOKEN = "ההתחברות נכשלה. נסה שוב."


@social_login_router.get("/auth/config")
def auth_config():
    """Which social logins this deployment can actually offer.

    The ids are public - they travel in every button the browser renders - but
    they live on the server so a provider is configured in one place: the
    client hides the button for anything that is not set up here.
    """
    return {
        "google": bool(GOOGLE_CLIENT_ID),
        "googleClientId": GOOGLE_CLIENT_ID,
        "facebook": bool(FACEBOOK_APP_ID and FACEBOOK_APP_SECRET),
        "facebookAppId": FACEBOOK_APP_ID,
    }


def _sign_in(db: Session, email: str, name: Optional[str], provider: str) -> User:
    """Turn a provider-verified email address into a logged-in member."""
    email = (email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=_BAD_TOKEN)

    user = db.query(User).filter(User.email == email).first()

    if not user or user.isdeleted:
        # 404, not 401: nothing is wrong with the token, this address simply has
        # no profile yet. The client reads this status to offer registration,
        # and the name and address ride along so the form opens half-filled.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": 'עדיין אין חשבון עם הדוא"ל הזה. מעבירים אותך להרשמה.',
                "email": email,
                "name": name or "",
            },
        )

    # Same order as the password login: a blocked account is revealed only once
    # the credentials check out, so nobody can probe the site for addresses.
    if user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="החשבון שלך נחסם על ידי הנהלת האתר.",
        )

    # The provider hands over an address only after verifying it itself, which
    # is what the emailed link is for - so a member who never clicked that link
    # is verified by signing in this way.
    if not user.is_email_verified:
        user.is_email_verified = True

    if name and not user.name:
        user.name = name

    user.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    log.info("Social login: provider=%s userID=%s", provider, user.id)
    return user


async def _google_identity(credential: str) -> Tuple[str, Optional[str]]:
    """Ask Google whose ID token this is. Returns (email, name)."""
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            res = await client.get(GOOGLE_TOKENINFO_URL, params={"id_token": credential})
    except httpx.HTTPError as e:
        log.warning("Google tokeninfo unreachable: %s", e)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_BAD_TOKEN)

    # Google answers 400 for anything expired, malformed, or not signed by it.
    if res.status_code != 200:
        log.warning("Google rejected the token: %s %s", res.status_code, res.text[:200])
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_BAD_TOKEN)

    data = res.json()

    # The check that makes the rest worth anything: a perfectly valid Google
    # token issued to somebody else's client id must not log anyone in here.
    if data.get("aud") != GOOGLE_CLIENT_ID:
        log.warning("Google token for a different client id: aud=%s", data.get("aud"))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_BAD_TOKEN)

    if data.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_BAD_TOKEN)

    # tokeninfo returns the booleans as the strings "true"/"false".
    if str(data.get("email_verified", "")).lower() != "true":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='כתובת הדוא"ל בחשבון Google אינה מאומתת.',
        )

    return data.get("email", ""), data.get("name")


async def _facebook_identity(access_token: str) -> Tuple[str, Optional[str]]:
    """Ask Facebook whose access token this is. Returns (email, name)."""
    app_token = f"{FACEBOOK_APP_ID}|{FACEBOOK_APP_SECRET}"

    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            debug = await client.get(
                f"{FACEBOOK_GRAPH}/debug_token",
                params={"input_token": access_token, "access_token": app_token},
            )
            if debug.status_code != 200:
                log.warning(
                    "Facebook debug_token failed: %s %s", debug.status_code, debug.text[:200]
                )
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_BAD_TOKEN)

            info = (debug.json() or {}).get("data") or {}

            # Without this, a token handed out by any Facebook app at all would
            # log its holder in here. It has to be a token our app issued.
            if not info.get("is_valid") or str(info.get("app_id")) != str(FACEBOOK_APP_ID):
                log.warning("Facebook token not ours or not valid: %s", info)
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_BAD_TOKEN)

            me = await client.get(
                f"{FACEBOOK_GRAPH}/me",
                params={"fields": "id,name,email", "access_token": access_token},
            )
    except httpx.HTTPError as e:
        log.warning("Facebook graph unreachable: %s", e)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_BAD_TOKEN)

    if me.status_code != 200:
        log.warning("Facebook /me failed: %s %s", me.status_code, me.text[:200])
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_BAD_TOKEN)

    profile = me.json()
    email = profile.get("email")

    # Facebook accounts opened with a phone number have no address to give, and
    # a member who unticked the email permission gives none either. Either way
    # there is nothing to match against a profile here.
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='חשבון הפייסבוק לא שיתף כתובת דוא"ל, ולכן אי אפשר להתחבר איתו.',
        )

    return email, profile.get("name")


async def social_identity(provider: str, credential: str) -> Tuple[str, Optional[str]]:
    """Whose account is this token for? Returns (email, name).

    The registration form calls this: a visitor sent here by a failed social
    login has no profile yet, so there is no password to ask for - the token
    they arrived with is what proves the address is theirs. The token is
    re-checked here rather than trusted from the earlier login attempt, because
    what reaches the form is a browser round-trip away and could say anything.

    Raises the same HTTPExceptions as the login routes, so a bad or expired
    token fails the registration the way it would fail a sign-in.
    """
    provider = (provider or "").strip().lower()

    if provider == "google":
        if not GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="כניסה עם Google אינה מוגדרת באתר.",
            )
        return await _google_identity(credential)

    if provider == "facebook":
        if not (FACEBOOK_APP_ID and FACEBOOK_APP_SECRET):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="כניסה עם פייסבוק אינה מוגדרת באתר.",
            )
        return await _facebook_identity(credential)

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=_BAD_TOKEN)


@social_login_router.post("/login/google", response_model=UserBase)
async def login_google(payload: dict = Body(...), db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="כניסה עם Google אינה מוגדרת באתר.",
        )

    credential = (payload.get("credential") or "").strip()
    if not credential:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=_BAD_TOKEN)

    email, name = await _google_identity(credential)
    return _sign_in(db, email, name, "google")


@social_login_router.post("/login/facebook", response_model=UserBase)
async def login_facebook(payload: dict = Body(...), db: Session = Depends(get_db)):
    if not (FACEBOOK_APP_ID and FACEBOOK_APP_SECRET):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="כניסה עם פייסבוק אינה מוגדרת באתר.",
        )

    access_token = (payload.get("accessToken") or "").strip()
    if not access_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=_BAD_TOKEN)

    email, name = await _facebook_identity(access_token)
    return _sign_in(db, email, name, "facebook")
