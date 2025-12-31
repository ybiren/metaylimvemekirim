# schemas/chat_room.py
from pydantic import BaseModel

class ChatRoomOut2(BaseModel):
    id: int
    room_id: str
    from_user_id: int
    to_user_id: int

    class Config:
        orm_mode = True
