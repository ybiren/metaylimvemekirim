from __future__ import annotations

import json
import time
from typing import Dict, Set, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Body

router = APIRouter()

# =========================
# In-memory state (single process)
# =========================
# All open sockets per user (supports multiple tabs/devices).
USER_SOCKETS: Dict[int, Set[WebSocket]] = {}

# Presence bookkeeping (epoch seconds).
LAST_TOUCH: Dict[int, float] = {}  # last heartbeat we received
LAST_SEEN:  Dict[int, float] = {}  # last time we knew user was online

# Heartbeat/presence tuning (seconds).
HEARTBEAT_SEC = 25   # client sends a tiny ping this often
TTL_SEC       = 90   # user is "online" if we were touched within this window


# =========================
# Helpers
# =========================
def _now() -> float:
    return time.time()

def is_online(user_id: int, now: Optional[float] = None) -> bool:
    if now is None:
        now = _now()
    ts = LAST_TOUCH.get(user_id, 0.0)
    return (now - ts) <= TTL_SEC

def _touch(user_id: int) -> None:
    now = _now()
    LAST_TOUCH[user_id] = now
    LAST_SEEN[user_id]  = now

async def push_notify(user_id: int, payload: dict) -> None:
    """
    Fan out a notification payload to all open tabs of a specific user.
    Usage example (after you persist a message):
        await push_notify(recipient_id, {
            "type": "message",
            "roomId": room_id,
            "fromUser": sender_id,
            "preview": body[:80],
        })
    """
    wire = json.dumps(payload, ensure_ascii=False)
    sockets = list(USER_SOCKETS.get(user_id, ()))
    if not sockets:
        return
    for s in sockets:
        try:
            await s.send_text(wire)
        except Exception:
            # Drop broken sockets quietly
            USER_SOCKETS[user_id].discard(s)


# =========================
# WebSocket endpoint
# =========================
@router.websocket("/ws/notify")
async def ws_notify(ws: WebSocket, userId: int = Query(...)):
    """
    Lightweight in-app notifications channel.
    Client connects with:
      new WebSocket(`ws://HOST/ws/notify?userId=${userId}`)
    The client should send a tiny heartbeat (e.g. {"type":"ping"}) every ~25s.
    """
    await ws.accept()

    # Register this socket
    USER_SOCKETS.setdefault(userId, set()).add(ws)
    _touch(userId)

    try:
        # Simple receive loop; any message counts as a heartbeat.
        while True:
            msg = await ws.receive_text()
            # (Optional) parse and react to pings; not strictly required:
            #   data = json.loads(msg) if msg and msg[0] in "[{" else None
            _touch(userId)
            # You can echo a pong if you want:
            # await ws.send_text('{"type":"pong"}')
    except WebSocketDisconnect:
        pass
    finally:
        # Remove this socket. Presence naturally fades via TTL if other tabs remain.
        bucket = USER_SOCKETS.get(userId)
        if bucket:
            bucket.discard(ws)
            if not bucket:
                USER_SOCKETS.pop(userId, None)
        # Update last seen when this connection ends
        LAST_SEEN[userId] = _now()


# =========================
# Presence HTTP endpoints
# =========================
@router.get("/presence/online")
async def presence_online(exclude: Optional[int] = None):
    """
    Return the list of userIDs considered 'online' (heartbeat within TTL).
    Optional: ?exclude=<userId> to drop your own id from the list.
    """
    now = _now()
    online = [uid for uid in LAST_TOUCH.keys() if is_online(uid, now)]
    if exclude is not None:
        online = [u for u in online if u != exclude]
    online.sort()
    return {"ok": True, "online": online}

@router.get("/presence/{userId}")
async def presence_of(userId: int):
    """
    Return presence info for a single user: { online, lastSeen }.
    lastSeen is epoch seconds (int) or null if unknown.
    """
    now = _now()
    ls = LAST_SEEN.get(userId)
    return {
        "ok": True,
        "userId": userId,
        "online": is_online(userId, now),
        "lastSeen": int(ls) if ls else None
    }


@router.post("/presence/ping")
async def presence_ping(userId: int = Query(...), _: dict = Body(default_factory=dict)):
    """
    Heartbeat from client every ~HEARTBEAT_SEC.
    Example client call: POST /presence/ping?userId=123
    """
    _touch(userId)
    return {"ok": True, "ttl": TTL_SEC}