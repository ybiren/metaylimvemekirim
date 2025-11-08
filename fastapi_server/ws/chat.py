# fastapi_server/ws/chat.py
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Set

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect

router = APIRouter()

# Storage
CHAT_PATH = Path("data/chat.json")
CHAT_PATH.parent.mkdir(parents=True, exist_ok=True)

# In-memory process state
chat_lock = asyncio.Lock()
ROOM_SOCKETS: Dict[str, Set[WebSocket]] = {}  # roomId -> sockets

# ---------- utils ----------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _room_id(u1: int, u2: int) -> str:
    a, b = sorted([int(u1), int(u2)])
    return f"dm:{a}:{b}"

async def _load() -> List[dict]:
    if not CHAT_PATH.exists():
        return []
    try:
        return json.loads(CHAT_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []

async def _save(data: List[dict]) -> None:
    CHAT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

def _find_thread(data: List[dict], room_id: str) -> Optional[dict]:
    for t in data:
        if t.get("roomId") == room_id:
            return t
    return None

def _ensure_thread(data: List[dict], u1: int, u2: int) -> dict:
    rid = _room_id(u1, u2)
    t = _find_thread(data, rid)
    if t is None:
        a, b = sorted([int(u1), int(u2)])
        t = {
            "roomId": rid,
            "fromUserId": a,     # kept for your original shape
            "toUserId": b,
            "messages": [],      # [{id, fromUserId, toUserId, content, sentAt, deliveredAt, readAt}]
        }
        data.append(t)
    return t

async def _broadcast(room_id: str, payload: dict) -> None:
    print(f"\n[BROADCAST] room={room_id} payload={payload}\n")  # <--- ADD LOG
    for s in list(ROOM_SOCKETS.get(room_id, ())):
        try:
            await s.send_json(payload)
        except Exception:
            ROOM_SOCKETS[room_id].discard(s)

# ---------- HTTP: history & read ----------

@router.get("/chat/history")
async def chat_history(
    user1: int = Query(..., description="first userID"),
    user2: int = Query(..., description="second userID"),
    limit: int = Query(200, ge=1, le=2000),
):
    """Unified thread for the pair, messages sorted by sentAt DESC, limited."""
    rid = _room_id(user1, user2)
    async with chat_lock:
        data = await _load()
        t = _find_thread(data, rid)
        msgs = (t or {}).get("messages", [])
        msgs_sorted = sorted(msgs, key=lambda m: m.get("sentAt", ""), reverse=True)
        if limit:
            msgs_sorted = msgs_sorted[:limit]
    return {"ok": True, "roomId": rid, "messages": msgs_sorted}

@router.post("/chat/mark-read")
async def mark_read(
    userId: int = Query(..., description="reader userID"),
    peerId: int = Query(..., description="peer userID"),
    upToIso: str = Query(..., description="ISO timestamp inclusive"),
):
    """Mark as read all messages TO userId in this DM up to timestamp (inclusive)."""
    rid = _room_id(userId, peerId)
    try:
        cutoff = datetime.fromisoformat(upToIso.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail="bad upToIso")

    now_iso = _now_iso()
    changed_ids: List[str] = []

    async with chat_lock:
        data = await _load()
        t = _find_thread(data, rid)
        if not t:
            return {"ok": True, "updated": []}
        for m in t["messages"]:
            if m.get("toUserId") == int(userId) and not m.get("readAt"):
                try:
                    sent = datetime.fromisoformat(str(m.get("sentAt")).replace("Z", "+00:00"))
                except Exception:
                    continue
                if sent <= cutoff:
                    m["readAt"] = now_iso
                    changed_ids.append(m["id"])
        await _save(data)

    if changed_ids:
        await _broadcast(rid, {"type": "read", "ids": changed_ids, "reader": int(userId), "roomId": rid})
    return {"ok": True, "updated": changed_ids}

def _thread_stats_for(user_id: int, t: Dict) -> Optional[Tuple[int, Dict]]:
    """
    Given a unified DM thread doc, return (peerId, stats) for user_id, or None if not part of it.
    Thread shape (as we store):
      {
        "roomId": "dm:<a>:<b>",
        "fromUserId": <a>,   # kept for back-compat
        "toUserId":   <b>,
        "messages": [ { id, fromUserId, toUserId, content, sentAt, deliveredAt, readAt }, ... ]
      }
    """
    rid = t.get("roomId", "")
    if not isinstance(rid, str) or not rid.startswith("dm:"):
        return None

    try:
        a, b = map(int, rid.split(":")[1:3])
    except Exception:
        return None

    if user_id not in (a, b):
        return None

    peer = b if user_id == a else a
    msgs: List[Dict] = t.get("messages", [])

    # last message by sentAt (ISO string)
    last = max(msgs, key=lambda m: m.get("sentAt", ""), default=None)
    last_at = last.get("sentAt", "") if last else ""
    last_from = int(last.get("fromUserId")) if last and last.get("fromUserId") is not None else None
    last_preview = (last.get("content", "") if last else "")[:120]

    # unread for this user (messages addressed to me, not yet read)
    unread = sum(
        1 for m in msgs
        if int(m.get("toUserId", -1)) == user_id and not m.get("readAt")
    )

    stats = {
        "roomId": rid,
        "peerId": peer,
        "lastAt": last_at,
        "lastFromUserId": last_from,
        "lastPreview": last_preview,
        "unread": unread,
        "count": len(msgs),
    }
    return peer, stats


@router.get("/chat/threads")
async def chat_threads(
    userId: int = Query(..., description="current userID"),
    limit: int = Query(50, ge=1, le=500, description="max threads to return")
):
    """
    Returns threads for userId, each:
      { roomId, peerId, lastAt, lastFromUserId, lastPreview, unread, count }
    Sorted by lastAt DESC. Limited by ?limit=.
    """
    user = int(userId)
    async with chat_lock:
        data = await _load()  # uses your existing JSON storage
        items: List[Dict] = []
        for t in data:
            res = _thread_stats_for(user, t)
            if res:
                _, stats = res
                items.append(stats)

        # sort most recent first (DESC by lastAt ISO)
        items.sort(key=lambda s: s.get("lastAt", ""), reverse=True)
        if limit:
            items = items[:limit]

    return {"ok": True, "threads": items}

# ---------- WebSocket: /ws/chat ----------

@router.websocket("/ws/chat")
async def ws_chat(
    ws: WebSocket,
    userId: int = Query(..., description="sender userID (uses your userID field)"),
    peerId: int = Query(..., description="recipient userID"),
):
    """
    Connect with: ws://host/ws/chat?userId=3&peerId=7
    - Room is dm:<min>:<max>, so both sides land in the same room.
    - On connect: mark undelivered inbound messages as delivered.
    - On message: persist, echo to sender, push to peer; set delivered/read accordingly.
    """
    await ws.accept()
    rid = _room_id(userId, peerId)
    ROOM_SOCKETS.setdefault(rid, set()).add(ws)

    # On connect, mark any inbound (to userId) undelivered as delivered
    delivered_ids: List[str] = []
    now_iso = _now_iso()
    async with chat_lock:
        data = await _load()
        t = _ensure_thread(data, userId, peerId)
        for m in t["messages"]:
            if m.get("toUserId") == int(userId) and not m.get("deliveredAt"):
                m["deliveredAt"] = now_iso
                delivered_ids.append(m["id"])
        if delivered_ids:
            await _save(data)

    if delivered_ids:
        await _broadcast(rid, {"type": "delivered", "ids": delivered_ids, "roomId": rid})

    try:
        while True:
            packet = await ws.receive_json()
            print("WS IN:", packet)
            typ = (packet.get("type") or "message").strip()

            if typ == "message":
                content = (packet.get("content") or "").strip()
                if not content:
                    continue

                msg_id = str(uuid.uuid4())
                sent_iso = _now_iso()
                payload = {
                    "id": msg_id,
                    "fromUserId": int(userId),
                    "toUserId": int(peerId),
                    "content": content,
                    "sentAt": sent_iso,
                    "deliveredAt": None,
                    "readAt": None,
                }

                # persist
                async with chat_lock:
                    data = await _load()
                    t = _ensure_thread(data, userId, peerId)
                    t["messages"].append(payload)
                    await _save(data)

                # deliver to everyone in room
                delivered = False
                for sock in list(ROOM_SOCKETS.get(rid, ())):
                    try:
                        await sock.send_json({"type": "message", "roomId": rid, "msg": payload})
                        # If peer is connected (any socket that's not 'ws' AND belongs to peer),
                        # we consider it delivered; since we don't track owners per socket here,
                        # we mark delivered optimistically once any other socket received it.
                        if sock is not ws:
                            delivered = True
                    except Exception:
                        ROOM_SOCKETS[rid].discard(sock)

                if delivered:
                    # mark delivered in store
                    async with chat_lock:
                        data = await _load()
                        t = _ensure_thread(data, userId, peerId)
                        for m in t["messages"]:
                            if m["id"] == msg_id:
                                m["deliveredAt"] = _now_iso()
                                break
                        await _save(data)
                    await _broadcast(rid, {"type": "delivered", "ids": [msg_id], "roomId": rid})

            elif typ == "readUpTo":
                up_to = packet.get("upToIso")
                if up_to:
                    # Mark read for messages to userId up to timestamp
                    await mark_read(userId=int(userId), peerId=int(peerId), upToIso=up_to)

            elif typ == "typing":
                await _broadcast(rid, {"type": "typing", "fromUserId": int(userId), "roomId": rid})

            else:
                # ignore unknown types
                pass

    except WebSocketDisconnect:
        pass
    finally:
        ROOM_SOCKETS.get(rid, set()).discard(ws)
        if not ROOM_SOCKETS.get(rid):
            ROOM_SOCKETS.pop(rid, None)
