# fastapi_server/ws/chat.py
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import func, or_, select, and_
from sqlalchemy.orm import Session

from db import get_db
from helper import get_user
from models.chat_message import ChatMessage
from models.chat_room import ChatRoom  # kept import (safe), but unused now

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

# =========================
# Date separators for LIVE WS
# =========================
ROOM_LAST_DATE: Dict[str, str] = {}  # roomKey -> "YYYY-MM-DD"
ROOM_LAST_DATE_LOCK = asyncio.Lock()


# ---------- utils ----------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _room_id(u1: int, u2: int) -> str:
    a, b = sorted([u1, u2])
    return f"dm:{a}:{b}"


def _is_global(peer_id: int) -> bool:
    return peer_id < 0


def _resolve_room(user_id: int, peer_id: int) -> str:
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


# --------- date helpers ---------

def _iso_date_utc(iso_ts: str) -> str:
    dt = datetime.fromisoformat(iso_ts)
    return dt.astimezone(timezone.utc).date().isoformat()


async def _broadcast_date_if_needed(room_key: str, room_id_for_client, sent_at_iso: str) -> None:
    date_key = _iso_date_utc(sent_at_iso)

    async with ROOM_LAST_DATE_LOCK:
        last = ROOM_LAST_DATE.get(room_key)
        need = (last != date_key)
        if need:
            ROOM_LAST_DATE[room_key] = date_key

    if need:
        await _broadcast(
            room_key,
            {
                "type": "message",
                "roomId": room_id_for_client,
                "msg": {"type": "date", "date": date_key, "id": f"date:{date_key}"},
            },
        )


def _seed_last_date_from_dm(db: Session, user1: int, user2: int) -> Optional[str]:
    last_dt = db.execute(
        select(func.max(ChatMessage.sent_at)).where(
            or_(
                and_(ChatMessage.from_user_id == user1, ChatMessage.to_user_id == user2),
                and_(ChatMessage.from_user_id == user2, ChatMessage.to_user_id == user1),
            )
        )
    ).scalar_one_or_none()

    if not last_dt:
        return None
    return last_dt.astimezone(timezone.utc).date().isoformat()


async def _seed_last_date(room_key: str, date_key: Optional[str]) -> None:
    if not date_key:
        return
    async with ROOM_LAST_DATE_LOCK:
        ROOM_LAST_DATE[room_key] = date_key


# -------------------------
# DB helpers (DM)
# -------------------------

def _load_dm_messages(db: Session, user1: int, user2: int, limit: int) -> list[dict]:
    rows = db.execute(
        select(ChatMessage)
        .where(
            or_(
                and_(ChatMessage.from_user_id == user1, ChatMessage.to_user_id == user2),
                and_(ChatMessage.from_user_id == user2, ChatMessage.to_user_id == user1),
            )
        )
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
    # ✅ CHANGED: no chat_rooms insert anymore
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
    now = datetime.now(timezone.utc)

    ids = db.execute(
        select(ChatMessage.id).where(
            ChatMessage.from_user_id == peer_id,
            ChatMessage.to_user_id == user_id,
            ChatMessage.delivered_at.is_(None),
        )
    ).scalars().all()

    if not ids:
        return []

    db.execute(
        ChatMessage.__table__.update()
        .where(ChatMessage.id.in_(ids))
        .values(delivered_at=now)
    )
    return list(ids)


def _mark_dm_read_for_user(db: Session, user_id: int, peer_id: int) -> list[str]:
    now = datetime.now(timezone.utc)

    ids = db.execute(
        select(ChatMessage.id).where(
            ChatMessage.from_user_id == peer_id,
            ChatMessage.to_user_id == user_id,
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
    async with GLOBAL_ROOMS_LOCK:
        m = GLOBAL_ROOMS_USERS.get(room_key, {})
        users = [{"userId": uid, "name": name} for uid, name in m.items()]
    users.sort(key=lambda x: ((x.get("name") or "").strip().lower(), x["userId"]))

    await _broadcast(
        room_key,
        {"type": "presence", "roomId": room_key, "users": users, "count": len(users)},
    )


def _with_date_separators(messages: list[dict]) -> list[dict]:
    result = []
    last_date = None

    for m in reversed(messages):
        dt = datetime.fromisoformat(m["sentAt"]).astimezone(timezone.utc)
        cur_date = dt.date().isoformat()

        if cur_date != last_date:
            result.append({"type": "date", "date": cur_date})
            last_date = cur_date

        m2 = dict(m)
        m2["type"] = "message"
        result.append(m2)

    return list(reversed(result))


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
    if _is_global(user2):
        rid = str(user2)
        async with GLOBAL_LOCK:
            msgs = sorted(GLOBAL_MESSAGES.get(rid, []), key=lambda m: m["sentAt"], reverse=True)[:limit]
            msgs = _with_date_separators(msgs)
        return {"ok": True, "roomId": user2, "messages": msgs}

    msgs = _load_dm_messages(db, user1, user2, limit)
    msgs = _with_date_separators(msgs)
    return {"ok": True, "roomId": _room_id(user1, user2), "messages": msgs}


@router.get("/chat/mark-read")
async def mark_read(
    userId: int = Query(...),
    peerId: int = Query(...),
    db: Session = Depends(get_db),
):
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

    from_user_ids = db.execute(
        select(ChatMessage.from_user_id).where(ChatMessage.to_user_id == user).distinct()
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
            select(func.count()).select_from(ChatMessage).where(ChatMessage.from_user_id == from_user_id)
        ).scalar_one()

        items.append(
            {
                "roomId": _room_id(user, peer),
                "peerId": peer,
                "peerName": get_user(db, peer).name,
                "lastAt": _dt_to_iso_utc(last_msg.sent_at) or "",
                "lastFromUserId": last_msg.from_user_id,
                "lastPreview": (last_msg.content[:120] if last_msg.content else ""),
                "unread": int(unread),
                "count": int(count),
            }
        )

    if includeGlobal:
        async with GLOBAL_LOCK:
            for rid, msgs in GLOBAL_MESSAGES.items():
                if not msgs:
                    continue
                last = max(msgs, key=lambda m: m["sentAt"], default=None)
                items.append(
                    {
                        "roomId": rid,
                        "peerId": int(rid),
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

    rid = _resolve_room(userId, peerId)
    ROOM_SOCKETS.setdefault(rid, set()).add(ws)

    # seed date on join (prevents duplicate "היום")
    if _is_global(peerId):
        gr = str(peerId)
        async with GLOBAL_LOCK:
            msgs = GLOBAL_MESSAGES.get(gr, [])
            if msgs:
                last = max(msgs, key=lambda m: m["sentAt"])
                await _seed_last_date(gr, _iso_date_utc(last["sentAt"]))
    else:
        await _seed_last_date(rid, _seed_last_date_from_dm(db, userId, peerId))

    # GLOBAL presence JOIN
    prev_global: Optional[str] = None
    if _is_global(peerId):
        target = str(peerId)

        u = get_user(db, userId)
        user_name = (getattr(u, "name", None) if u else None) or f"User {userId}"

        async with GLOBAL_ROOMS_LOCK:
            prev_global = USER_CURRENT_GLOBAL_ROOM.get(userId)

            if prev_global and prev_global != target:
                old_map = GLOBAL_ROOMS_USERS.get(prev_global)
                if old_map:
                    old_map.pop(userId, None)
                    if not old_map:
                        GLOBAL_ROOMS_USERS.pop(prev_global, None)

            GLOBAL_ROOMS_USERS.setdefault(target, {})[userId] = user_name
            USER_CURRENT_GLOBAL_ROOM[userId] = target

        if prev_global and prev_global != target:
            await _broadcast_presence(prev_global)
        await _broadcast_presence(target)

        async with GLOBAL_ROOMS_LOCK:
            m = GLOBAL_ROOMS_USERS.get(target, {})
            users_snapshot = [{"userId": uid, "name": name} for uid, name in m.items()]
        users_snapshot.sort(key=lambda x: ((x.get("name") or "").strip().lower(), x["userId"]))
        try:
            await ws.send_json({"type": "presence", "roomId": target, "users": users_snapshot, "count": len(users_snapshot)})
        except Exception:
            pass

    # Mark delivered for DMs
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
            await _broadcast(rid, {"type": "delivered", "ids": delivered_ids, "roomId": rid})

    try:
        while True:
            packet = await ws.receive_json()
            if packet.get("type") != "message":
                continue

            content = (packet.get("content") or "").strip()
            if not content:
                continue

            u = get_user(db, userId)
            from_name = getattr(u, "name", None) if u else None

            # Global room
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

                await _broadcast_date_if_needed(gr, peerId, msg["sentAt"])
                await _broadcast(gr, {"type": "message", "roomId": peerId, "msg": msg})
                continue

            # DM message (DB)
            sent_dt = datetime.now(timezone.utc)
            msg_id = str(uuid.uuid4())

            try:
                saved = _insert_dm_message(db=db, user_id=userId, peer_id=peerId, content=content, sent_at=sent_dt, msg_id=msg_id)
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

            await _broadcast_date_if_needed(rid, rid, msg["sentAt"])
            await _broadcast(rid, {"type": "message", "roomId": rid, "msg": msg})

    except WebSocketDisconnect:
        pass
    finally:
        ROOM_SOCKETS.get(rid, set()).discard(ws)
        if not ROOM_SOCKETS.get(rid):
            ROOM_SOCKETS.pop(rid, None)

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
