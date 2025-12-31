# models/chat_room.py
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass

class ChatRoom(Base):
    __tablename__ = "chat_rooms"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)

    room_id = Column(String(255), nullable=False)
    from_user_id = Column(Integer, nullable=False)
    to_user_id = Column(Integer, nullable=False)
