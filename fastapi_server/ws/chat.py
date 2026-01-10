# fastapi_server/ws/chat.py
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Set

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from db import get_db
from helper import get_user

router = APIRouter()

# =========================
# Storage (DM only) - persisted to JSON
# =========================
CHAT_PATH = Path("data/chat.json")
CHAT_PATH.parent.mkdir(parents=True, exist_ok=True)

chat_lock = asyncio.Lock()
ROOM_SOCKETS: Dict[str, Set[WebSocket]] = {}  # roomId -> sockets

# =========================
# GLOBAL rooms (in-memory) - MULTI global rooms
# =========================
GLOBAL_LOCK = asyncio.Lock()
GLOBAL_MESSAGES: Dict[str, List[dict]] = {}  # globalRoomId(str) -> messages list
GLOBAL_MAX_PER_ROOM = 2000  # cap RAM per global room

# =========================
# GLOBAL rooms presence (in-memory)
# User can be in ONLY ONE global room at a time
#
# IMPORTANT CHANGE:
# - store userId -> userName per room so presence broadcast can include names
# =========================
GLOBAL_ROOMS_LOCK = asyncio.Lock()
GLOBAL_ROOMS_USERS: Dict[str, Dict[int, str]] = {}  # roomId(str) -> {userId: userName}
USER_CURRENT_GLOBAL_ROOM: Dict[int, str] = {}  # userId -> roomId(str)

# ---------- utils ----------


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _room_id(u1: int, u2: int) -> str:
    a, b = sorted([u1, u2])
    return f"dm:{a}:{b}"


def _is_global(peer_id: int) -> bool:
    return peer_id < 0


def _resolve_room(user_id: int, peer_id: int) -> str:
    # For global rooms, we use the negative peer id as the room key
    if _is_global(peer_id):
        return str(peer_id)
    return _room_id(user_id, peer_id)


async def _load() -> List[dict]:
    if not CHAT_PATH.exists():
        return []
    try:
        return json.loads(CHAT_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []


async def _save(data: List[dict]) -> None:
    CHAT_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _find_thread(data: List[dict], room_id: str) -> Optional[dict]:
    return next((t for t in data if t.get("roomId") == room_id), None)


def _ensure_thread(data: List[dict], u1: int, u2: int) -> dict:
    rid = _room_id(u1, u2)
    t = _find_thread(data, rid)
    if not t:
        a, b = sorted([u1, u2])
        t = {
            "roomId": rid,
            "fromUserId": a,
            "toUserId": b,
            "messages": [],
        }
        data.append(t)
    return t


async def _broadcast(room_id: str, payload: dict) -> None:
    for s in list(ROOM_SOCKETS.get(room_id, ())):
        try:
            await s.send_json(payload)
        except Exception:
            ROOM_SOCKETS.get(room_id, set()).discard(s)


def _global_append(room_key: str, msg: dict) -> None:
    lst = GLOBAL_MESSAGES.setdefault(room_key, [])
    lst.append(msg)
    if len(lst) > GLOBAL_MAX_PER_ROOM:
        del lst[: len(lst) - GLOBAL_MAX_PER_ROOM]


async def _broadcast_presence(room_key: str) -> None:
    """
    Presence snapshot for a global room.
    Sends both ids and names, as list of objects:
      {"type":"presence","roomId":"-1000","users":[{"userId":1,"name":"Yossi"},...],"count":N}
    """
    async with GLOBAL_ROOMS_LOCK:
        m = GLOBAL_ROOMS_USERS.get(room_key, {})
        users = [{"userId": uid, "name": name} for uid, name in m.items()]
    users.sort(key=lambda x: ((x.get("name") or "").strip().lower(), x["userId"]))

    await _broadcast(
        room_key,
        {"type": "presence", "roomId": room_key, "users": users, "count": len(users)},
    )

def _with_date_separators(messages):
    """
    messages must be sorted DESC by sentAt
    """
    result = []
    last_date = None

    for m in reversed(messages):  # process oldest → newest
        dt = datetime.fromisoformat(m["sentAt"]).astimezone(timezone.utc)
        cur_date = dt.date().isoformat()

        if cur_date != last_date:
            result.append({
                "type": "date",
                "date": cur_date,
            })
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
):
    # Global room history (in-memory per global room id)
    if _is_global(user2):
        rid = str(user2)
        async with GLOBAL_LOCK:
            msgs = sorted(
                GLOBAL_MESSAGES.get(rid, []),
                key=lambda m: m["sentAt"],
                reverse=True,
            )[:limit]
        return {"ok": True, "roomId": user2, "messages": msgs}

    # DM history (persisted)
    rid = _room_id(user1, user2)
    async with chat_lock:
        data = await _load()
        t = _find_thread(data, rid)
        msgs = sorted(
            (t or {}).get("messages", []),
            key=lambda m: m["sentAt"],
            reverse=True,
        )[:limit]

    msgs = _with_date_separators(msgs)
    return {"ok": True, "roomId": rid, "messages": msgs}


@router.get("/chat/mark-read")
async def mark_read(
    userId: int = Query(...),
    peerId: int = Query(...),
):
    # For global rooms, you currently don't track read state
    if _is_global(peerId):
        return {"ok": True, "updated": []}

    rid = _room_id(userId, peerId)
    updated: List[str] = []

    async with chat_lock:
        data = await _load()
        t = _find_thread(data, rid)
        if not t:
            return {"ok": True, "updated": []}

        for m in t["messages"]:
            if m["toUserId"] == userId and not m.get("readAt"):
                m["readAt"] = _now_iso()
                updated.append(m["id"])

        await _save(data)

    if updated:
        await _broadcast(rid, {"type": "read", "ids": updated, "roomId": rid})

    return {"ok": True, "updated": updated}


@router.get("/chat/threads")
async def chat_threads(
    userId: int = Query(...),
    limit: int = Query(50, ge=1, le=500),
    includeGlobal: bool = Query(False),
):
    user = userId
    items: List[Dict] = []

    # DM threads (persisted)
    async with chat_lock:
        data = await _load()
        for t in data:
            rid = t.get("roomId", "")
            if not rid.startswith("dm:"):
                continue

            a, b = map(int, rid.split(":")[1:3])
            if user not in (a, b):
                continue

            peer = b if user == a else a
            msgs = t.get("messages", [])
            peer_msgs = [m for m in msgs if m["fromUserId"] == peer]
            last = max(peer_msgs, key=lambda m: m["sentAt"], default=None)

            items.append(
                {
                    "roomId": rid,
                    "peerId": peer,
                    "lastAt": last["sentAt"] if last else "",
                    "lastFromUserId": peer if last else None,
                    "lastPreview": (last["content"][:120] if last else ""),
                    "unread": sum(
                        1 for m in msgs if m["toUserId"] == user and not m.get("readAt")
                    ),
                    "count": len(msgs),
                }
            )

    # Optional global threads list (in-memory)
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
                        "unread": 0,          # not tracked for globals
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

        # Send immediate snapshot to the newly joined socket (nice UX)
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

    # Mark as delivered for DMs (persisted)
    if not _is_global(peerId):
        delivered_ids: List[str] = []
        async with chat_lock:
            data = await _load()
            t = _ensure_thread(data, userId, peerId)
            for m in t["messages"]:
                if m["toUserId"] == userId and not m.get("deliveredAt"):
                    m["deliveredAt"] = _now_iso()
                    delivered_ids.append(m["id"])

            if delivered_ids:
                await _save(data)

        if delivered_ids:
            await _broadcast(
                rid,
                {"type": "delivered", "ids": delivered_ids, "roomId": rid},
            )

    try:
        while True:
            packet = await ws.receive_json()
            ptype = packet.get("type")

            # you can add more ws commands later; for now ignore non-message
            if ptype != "message":
                continue

            content = (packet.get("content") or "").strip()
            if not content:
                continue

            u = get_user(db, userId)
            from_name = getattr(u, "name", None) if u else None

            msg = {
                "id": str(uuid.uuid4()),
                "fromUserId": userId,
                "fromUserName": from_name,
                "toUserId": peerId,
                "content": content,
                "sentAt": _now_iso(),
            }

            # Global room message (in-memory per global room id)
            if _is_global(peerId):
                gr = str(peerId)
                async with GLOBAL_LOCK:
                    _global_append(gr, msg)

                await _broadcast(gr, {"type": "message", "roomId": peerId, "msg": msg})
                continue

            # DM message (persisted)
            msg.update({"deliveredAt": None, "readAt": None})

            async with chat_lock:
                data = await _load()
                t = _ensure_thread(data, userId, peerId)
                t["messages"].append(msg)
                await _save(data)

            await _broadcast(rid, {"type": "message", "roomId": rid, "msg": msg})

    except WebSocketDisconnect:
        pass
    finally:
        # socket cleanup
        ROOM_SOCKETS.get(rid, set()).discard(ws)
        if not ROOM_SOCKETS.get(rid):
            ROOM_SOCKETS.pop(rid, None)

        # ---- GLOBAL presence LEAVE (remove only if still in this room) ----
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
