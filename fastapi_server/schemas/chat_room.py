# schemas/chat_room.py
from typing import Optional

from pydantic import BaseModel

class ChatRoomOut2(BaseModel):
    id: int
    room_id: str
    from_user_id: int
    to_user_id: int

    # Who looks after the room. The id is what the admin screen edits; the name
    # is resolved server-side so the rooms list and the chat header do not each
    # have to go and look a user up.
    user_id: Optional[int] = None
    admin_name: Optional[str] = None
