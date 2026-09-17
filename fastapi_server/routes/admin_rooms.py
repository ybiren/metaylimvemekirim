"""Who looks after each system chat room.

The rooms themselves are still created by hand in SQL - see sql/chat_rooms.sql,
and the note there about a room being "system" purely by having a negative id.
This screen does one thing: it says which member is responsible for a room, so
that name can be shown to everyone who opens it.

Assigning somebody grants them nothing. It is a label, not a permission: the
value is read to display a name and is checked nowhere. If moderation powers
are ever attached to it, that decision belongs in the code that would enforce
them, not here.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from db import get_db
from models.chat_room import ChatRoom
from models.user import User

log = logging.getLogger("admin_rooms")

admin_rooms_router = APIRouter(prefix="/api/admin/rooms", tags=["admin-rooms"])


def _room_out(room: ChatRoom, admin_name: Optional[str]) -> Dict[str, Any]:
    return {
        "id": room.id,
        "room_id": room.room_id,
        "user_id": room.user_id,
        "admin_name": admin_name,
    }


@admin_rooms_router.get("")
def admin_list_rooms(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """Every system room, with the name of its admin where there is one."""
    rows = (
        db.query(ChatRoom, User.name)
        .outerjoin(User, User.id == ChatRoom.user_id)
        .filter(ChatRoom.id < 0)
        .order_by(ChatRoom.id)
        .all()
    )
    return [_room_out(room, admin_name) for room, admin_name in rows]


@admin_rooms_router.patch("/{room_id}")
def admin_set_room_admin(
    room_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Assign a member to a room, or clear the assignment with a null user_id."""
    room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    user_id = payload.get("user_id")

    if user_id is None:
        room.user_id = None
        db.commit()
        log.info("Room %s has no admin now", room_id)
        return _room_out(room, None)

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="user_id must be a number")

    # Checked rather than trusted: an id that matches nobody would leave the
    # room showing no name at all, which looks like the save failed.
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.isdeleted:
        raise HTTPException(status_code=404, detail="לא נמצא משתמש עם המזהה הזה.")

    room.user_id = user.id
    db.commit()

    log.info("Room %s is looked after by userID=%s", room_id, user.id)
    return _room_out(room, user.name)
