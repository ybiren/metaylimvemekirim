# fastapi_server/ws/chat.py
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, Depends
from db import get_db
from helper import get_user

router = APIRouter()

# =========================
# Storage (DM only)
# =========================
CHAT_PATH = Path("data/chat.json")
CHAT_PATH.parent.mkdir(parents=True, exist_ok=True)

chat_lock = asyncio.Lock()
ROOM_SOCKETS: Dict[str, Set[WebSocket]] = {}

# =========================
# GLOBAL chat (in-memory)
# =========================
GLOBAL_LOCK = asyncio.Lock()
GLOBAL_MESSAGES: List[dict] = []

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
            ROOM_SOCKETS[room_id].discard(s)

# =========================
# HTTP
# =========================

@router.get("/chat/history")
async def chat_history(
    user1: int = Query(...),
    user2: int = Query(...),
    limit: int = Query(200, ge=1, le=2000),
):
    if _is_global(user2):
        async with GLOBAL_LOCK:
            msgs = sorted(
                GLOBAL_MESSAGES,
                key=lambda m: m["sentAt"],
                reverse=True,
            )[:limit]
        return {"ok": True, "roomId": user2, "messages": msgs}

    rid = _room_id(user1, user2)
    async with chat_lock:
        data = await _load()
        t = _find_thread(data, rid)
        msgs = sorted(
            (t or {}).get("messages", []),
            key=lambda m: m["sentAt"],
            reverse=True,
        )[:limit]

    return {"ok": True, "roomId": rid, "messages": msgs}


@router.get("/chat/mark-read")
async def mark_read(
    userId: int = Query(...),
    peerId: int = Query(...),
):
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
         
            items.append({
                "roomId": rid,
                "peerId": peer,
                "lastAt": last["sentAt"] if last else "",
                "lastFromUserId": peer if last else None,
                "lastPreview": (last["content"][:120] if last else ""),
                "unread": sum(
                    1 for m in msgs
                    if m["toUserId"] == user and not m.get("readAt")
                ),
                "count": len(msgs),
            })

    
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
    db: Session = Depends(get_db)
):
    await ws.accept()
    rid = _resolve_room(userId, peerId)
    ROOM_SOCKETS.setdefault(rid, set()).add(ws)

    if not _is_global(peerId):
        delivered_ids = []
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
            await _broadcast(rid, {"type": "delivered", "ids": delivered_ids, "roomId": rid})

    try:
        while True:
            packet = await ws.receive_json()
            if packet.get("type") != "message":
                continue

            content = (packet.get("content") or "").strip()
            if not content:
                continue

            msg = {
                "id": str(uuid.uuid4()),
                "fromUserId": userId,
                "fromUserName": get_user(db,userId).name,
                "toUserId": peerId,
                "content": content,
                "sentAt": _now_iso(),
            }

            if _is_global(peerId):
                async with GLOBAL_LOCK:
                    GLOBAL_MESSAGES.append(msg)
                await _broadcast(str(peerId), {"type": "message", "roomId": peerId, "msg": msg})
                continue

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
        ROOM_SOCKETS.get(rid, set()).discard(ws)
        if not ROOM_SOCKETS.get(rid):
            ROOM_SOCKETS.pop(rid, None)
