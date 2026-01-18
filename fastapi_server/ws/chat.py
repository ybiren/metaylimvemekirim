# fastapi_server/ws/chat.py
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db import get_db
from helper import get_user

# ✅ Adjust these imports to your project structure if needed
from models.chat_message import ChatMessage
from models.chat_room import ChatRoom

router = APIRouter()

# =========================
# WebSocket room sockets
# =========================
ROOM_SOCKETS: Dict[str, Set[WebSocket]] = {}  # roomKey -> sockets

# =========================
# GLOBAL rooms (in-memory) - MULTI global rooms
# =========================
GLOBAL_LOCK = asyncio.Lock()
GLOBAL_MESSAGES: Dict[str, List[dict]] = {}  # globalRoomId(str) -> messages list
GLOBAL_MAX_PER_ROOM = 2000  # cap RAM per global room

# =========================
# GLOBAL rooms presence (in-memory)
# User can be in ONLY ONE global room at a time
# =========================
GLOBAL_ROOMS_LOCK = asyncio.Lock()
GLOBAL_ROOMS_USERS: Dict[str, Dict[int, str]] = {}  # roomId(str) -> {userId: userName}
USER_CURRENT_GLOBAL_ROOM: Dict[int, str] = {}  # userId -> roomId(str)


# ---------- utils ----------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _room_id(u1: int, u2: int) -> str:
    """Your client-visible DM room string"""
    a, b = sorted([u1, u2])
    return f"dm:{a}:{b}"


def _is_global(peer_id: int) -> bool:
    return peer_id < 0


def _resolve_room(user_id: int, peer_id: int) -> str:
    """Room key used by websockets dict. Globals use str(peerId)."""
    if _is_global(peer_id):
        return str(peer_id)
    return _room_id(user_id, peer_id)


def _dt_to_iso_utc(dt: datetime | None) -> str | None:
    if not dt:
        return None
    return dt.astimezone(timezone.utc).isoformat()


def _serialize_dm_message(m: ChatMessage) -> dict:
    return {
        "id": m.id,
        "fromUserId": m.from_user_id,
        "toUserId": m.to_user_id,
        "content": m.content,
        "sentAt": _dt_to_iso_utc(m.sent_at),
        "deliveredAt": _dt_to_iso_utc(m.delivered_at),
        "readAt": _dt_to_iso_utc(m.read_at),
    }


def _room_int_id(u1: int, u2: int) -> int:
    """
    DB room_id is INTEGER.
    This creates a deterministic int for a DM pair.

    ⚠️ If your user IDs can exceed 999,999 or you already have a different chat_rooms schema,
    change this function (or better: store user1_id/user2_id in chat_rooms with UNIQUE).
    """
    a, b = sorted([u1, u2])
    return (a * 1_000_000) + b


def _get_or_create_dm_room(db: Session, user_id: int, peer_id: int) -> int:
    room_id = _room_int_id(user_id, peer_id)

    room = db.get(ChatRoom, room_id)
    if room:
        return room_id

    db.add(ChatRoom(id=room_id))
    try:
        db.flush()  # ensure FK exists before inserting message
    except IntegrityError:
        db.rollback()
        room = db.get(ChatRoom, room_id)
        if room:
            return room_id
        raise

    return room_id


def _load_dm_messages(db: Session, user1: int, user2: int, limit: int) -> list[dict]:
    
    room_id = _room_int_id(user1, user2)

    rows = db.execute(
        select(ChatMessage)
        .where(ChatMessage.from_user_id == user1, ChatMessage.to_user_id == user2)
        .order_by(ChatMessage.sent_at.desc())
        .limit(limit)
    ).scalars().all()

    return [_serialize_dm_message(m) for m in rows]


def _insert_dm_message(
    db: Session,
    user_id: int,
    peer_id: int,
    content: str,
    sent_at: datetime,
    msg_id: str | None = None,
) -> dict:

    m = ChatMessage(
        id=msg_id or str(uuid.uuid4()),
        from_user_id=user_id,
        to_user_id=peer_id,
        content=content,
        sent_at=sent_at,
        delivered_at=None,
        read_at=None,
    )
    db.add(m)
    db.flush()
    db.refresh(m)
    return _serialize_dm_message(m)


def _mark_dm_delivered_for_user(db: Session, user_id: int, peer_id: int) -> list[str]:
    room_id = _room_int_id(user_id, peer_id)
    print(room_id)
    now = datetime.now(timezone.utc)

    ids = db.execute(
        select(ChatMessage.id).where(
            ChatMessage.to_user_id == user_id,
            ChatMessage.delivered_at.is_(None),
        )
    ).scalars().all()

    if not ids:
        return []

    print("before db execute")
    db.execute(
        ChatMessage.__table__.update()
        .where(ChatMessage.id.in_(ids))
        .values(delivered_at=now)
    )
    print("after db execute")
    return list(ids)


def _mark_dm_read_for_user(db: Session, user_id: int, peer_id: int) -> list[str]:
    now = datetime.now(timezone.utc)

    ids = db.execute(
        select(ChatMessage.id).where(
            ChatMessage.from_user_id == user_id,
            ChatMessage.to_user_id == peer_id,
            ChatMessage.read_at.is_(None),
        )
    ).scalars().all()

    if not ids:
        return []

    db.execute(
        ChatMessage.__table__.update()
        .where(ChatMessage.id.in_(ids))
        .values(read_at=now)
    )
    return list(ids)


async def _broadcast(room_key: str, payload: dict) -> None:
    for s in list(ROOM_SOCKETS.get(room_key, ())):
        try:
            await s.send_json(payload)
        except Exception:
            ROOM_SOCKETS.get(room_key, set()).discard(s)


def _global_append(room_key: str, msg: dict) -> None:
    lst = GLOBAL_MESSAGES.setdefault(room_key, [])
    lst.append(msg)
    if len(lst) > GLOBAL_MAX_PER_ROOM:
        del lst[: len(lst) - GLOBAL_MAX_PER_ROOM]


async def _broadcast_presence(room_key: str) -> None:
    """
    Presence snapshot for a global room.
    Sends:
      {"type":"presence","roomId":"-1000","users":[{"userId":1,"name":"Yossi"}],"count":N}
    """
    async with GLOBAL_ROOMS_LOCK:
        m = GLOBAL_ROOMS_USERS.get(room_key, {})
        users = [{"userId": uid, "name": name} for uid, name in m.items()]
    users.sort(key=lambda x: ((x.get("name") or "").strip().lower(), x["userId"]))

    await _broadcast(
        room_key,
        {"type": "presence", "roomId": room_key, "users": users, "count": len(users)},
    )


def _with_date_separators(messages: list[dict]) -> list[dict]:
    """
    messages must be sorted DESC by sentAt (ISO string)
    """
    result = []
    last_date = None

    for m in reversed(messages):  # oldest → newest
        dt = datetime.fromisoformat(m["sentAt"]).astimezone(timezone.utc)
        cur_date = dt.date().isoformat()

        if cur_date != last_date:
            result.append({"type": "date", "date": cur_date})
            last_date = cur_date

        m2 = dict(m)
        m2["type"] = "message"
        result.append(m2)

    return list(reversed(result))  # keep DESC for UI


# =========================
# HTTP
# =========================

@router.get("/chat/history")
async def chat_history(
    user1: int = Query(...),
    user2: int = Query(...),
    limit: int = Query(200, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    # Global room history (in-memory)
    if _is_global(user2):
        rid = str(user2)
        async with GLOBAL_LOCK:
            msgs = sorted(
                GLOBAL_MESSAGES.get(rid, []),
                key=lambda m: m["sentAt"],
                reverse=True,
            )[:limit]
            msgs = _with_date_separators(msgs)
        return {"ok": True, "roomId": user2, "messages": msgs}

    # DM history (DB)
    msgs = _load_dm_messages(db, user1, user2, limit)
    msgs = _with_date_separators(msgs)
    return {"ok": True, "roomId": _room_id(user1, user2), "messages": msgs}


@router.get("/chat/mark-read")
async def mark_read(
    userId: int = Query(...),
    peerId: int = Query(...),
    db: Session = Depends(get_db),
):
    # Globals: no read tracking
    if _is_global(peerId):
        return {"ok": True, "updated": []}

    rid = _room_id(userId, peerId)

    try:
        updated = _mark_dm_read_for_user(db, userId, peerId)
        if updated:
            db.commit()
        else:
            db.rollback()
    except Exception:
        db.rollback()
        raise

    if updated:
        await _broadcast(rid, {"type": "read", "ids": updated, "roomId": rid})

    return {"ok": True, "updated": updated}


@router.get("/chat/threads")
async def chat_threads(
    userId: int = Query(...),
    limit: int = Query(50, ge=1, le=500),
    includeGlobal: bool = Query(False),
    db: Session = Depends(get_db),
):
    user = userId
    items: List[Dict] = []

    # ---- DM threads (DB) ----
    # With your current schema (chat_rooms has only id),
    # we infer room list from messages.
    from_user_ids = db.execute(
        select(ChatMessage.from_user_id)
        .where(ChatMessage.to_user_id == user)
        .distinct()
    ).scalars().all()

    for from_user_id in from_user_ids:
        last_msg = db.execute(
            select(ChatMessage)
            .where(ChatMessage.from_user_id == from_user_id, ChatMessage.to_user_id == user)
            .order_by(ChatMessage.sent_at.desc())
            .limit(1)
        ).scalars().first()

        if not last_msg:
            continue

        peer = last_msg.to_user_id if last_msg.from_user_id == user else last_msg.from_user_id

        unread = db.execute(
            select(func.count())
            .select_from(ChatMessage)
            .where(
                ChatMessage.from_user_id == from_user_id,
                ChatMessage.to_user_id == user,
                ChatMessage.read_at.is_(None),
            )
        ).scalar_one()

        count = db.execute(
            select(func.count())
            .select_from(ChatMessage)
            .where(ChatMessage.from_user_id == from_user_id)
        ).scalar_one()

        items.append(
            {
                "roomId": _room_id(user, peer),
                "peerId": peer,
                "peerName": get_user(db,peer).name,
                "lastAt": _dt_to_iso_utc(last_msg.sent_at) or "",
                "lastFromUserId": last_msg.from_user_id,
                "lastPreview": (last_msg.content[:120] if last_msg.content else ""),
                "unread": int(unread),
                "count": int(count),
            }
        )

    # ---- Global threads (in-memory) ----
    if includeGlobal:
        async with GLOBAL_LOCK:
            for rid, msgs in GLOBAL_MESSAGES.items():
                if not msgs:
                    continue
                last = max(msgs, key=lambda m: m["sentAt"], default=None)
                items.append(
                    {
                        "roomId": rid,        # "-1000" etc.
                        "peerId": int(rid),   # compatibility with your client
                        "lastAt": last["sentAt"] if last else "",
                        "lastFromUserId": last.get("fromUserId") if last else None,
                        "lastPreview": (last["content"][:120] if last else ""),
                        "unread": 0,
                        "count": len(msgs),
                        "isGlobal": True,
                    }
                )

    items.sort(key=lambda x: x["lastAt"], reverse=True)
    return {"ok": True, "threads": items[:limit]}


# =========================
# WebSocket
# =========================

@router.websocket("/ws/chat")
async def ws_chat(
    ws: WebSocket,
    userId: int = Query(...),
    peerId: int = Query(...),
    db: Session = Depends(get_db),
):
    await ws.accept()

    print(userId)
    print(peerId)
    rid = _resolve_room(userId, peerId)
    ROOM_SOCKETS.setdefault(rid, set()).add(ws)

    # ---- GLOBAL presence JOIN (single global room per user) ----
    prev_global: Optional[str] = None
    if _is_global(peerId):
        target = str(peerId)

        u = get_user(db, userId)
        user_name = (getattr(u, "name", None) if u else None) or f"User {userId}"

        async with GLOBAL_ROOMS_LOCK:
            prev_global = USER_CURRENT_GLOBAL_ROOM.get(userId)

            # remove from previous room if different
            if prev_global and prev_global != target:
                old_map = GLOBAL_ROOMS_USERS.get(prev_global)
                if old_map:
                    old_map.pop(userId, None)
                    if not old_map:
                        GLOBAL_ROOMS_USERS.pop(prev_global, None)

            # add/update in target
            GLOBAL_ROOMS_USERS.setdefault(target, {})[userId] = user_name
            USER_CURRENT_GLOBAL_ROOM[userId] = target

        # broadcast presence updates
        if prev_global and prev_global != target:
            await _broadcast_presence(prev_global)
        await _broadcast_presence(target)

        # Send immediate snapshot to the newly joined socket
        async with GLOBAL_ROOMS_LOCK:
            m = GLOBAL_ROOMS_USERS.get(target, {})
            users_snapshot = [{"userId": uid, "name": name} for uid, name in m.items()]
        users_snapshot.sort(key=lambda x: ((x.get("name") or "").strip().lower(), x["userId"]))
        try:
            await ws.send_json(
                {"type": "presence", "roomId": target, "users": users_snapshot, "count": len(users_snapshot)}
            )
        except Exception:
            pass

    # Mark as delivered for DMs (DB)
    if not _is_global(peerId):
        try:
            delivered_ids = _mark_dm_delivered_for_user(db, userId, peerId)
            if delivered_ids:
                db.commit()
            else:
                db.rollback()
        except Exception:
            db.rollback()
            raise

        if delivered_ids:
            await _broadcast(
                rid,
                {"type": "delivered", "ids": delivered_ids, "roomId": rid},
            )

    try:
        while True:
            packet = await ws.receive_json()
            ptype = packet.get("type")

            if ptype != "message":
                continue

            content = (packet.get("content") or "").strip()
            if not content:
                continue

            u = get_user(db, userId)
            from_name = getattr(u, "name", None) if u else None

            # Global room message (in-memory)
            if _is_global(peerId):
                msg = {
                    "id": str(uuid.uuid4()),
                    "fromUserId": userId,
                    "fromUserName": from_name,
                    "toUserId": peerId,
                    "content": content,
                    "sentAt": _now_iso(),
                }
                gr = str(peerId)
                async with GLOBAL_LOCK:
                    _global_append(gr, msg)

                await _broadcast(gr, {"type": "message", "roomId": peerId, "msg": msg})
                continue

            # DM message (DB)
            sent_dt = datetime.now(timezone.utc)
            msg_id = str(uuid.uuid4())

            try:
                saved = _insert_dm_message(
                    db=db,
                    user_id=userId,
                    peer_id=peerId,
                    content=content,
                    sent_at=sent_dt,
                    msg_id=msg_id,
                )
                db.commit()
            except Exception:
                db.rollback()
                raise

            msg = {
                "id": saved["id"],
                "fromUserId": saved["fromUserId"],
                "fromUserName": from_name,
                "toUserId": saved["toUserId"],
                "content": saved["content"],
                "sentAt": saved["sentAt"],
                "deliveredAt": saved["deliveredAt"],
                "readAt": saved["readAt"],
            }

            await _broadcast(rid, {"type": "message", "roomId": rid, "msg": msg})

    except WebSocketDisconnect:
        pass
    finally:
        # socket cleanup
        ROOM_SOCKETS.get(rid, set()).discard(ws)
        if not ROOM_SOCKETS.get(rid):
            ROOM_SOCKETS.pop(rid, None)

        # ---- GLOBAL presence LEAVE ----
        if _is_global(peerId):
            room_key = str(peerId)
            async with GLOBAL_ROOMS_LOCK:
                if USER_CURRENT_GLOBAL_ROOM.get(userId) == room_key:
                    USER_CURRENT_GLOBAL_ROOM.pop(userId, None)
                    m = GLOBAL_ROOMS_USERS.get(room_key)
                    if m:
                        m.pop(userId, None)
                        if not m:
                            GLOBAL_ROOMS_USERS.pop(room_key, None)

            await _broadcast_presence(room_key)
