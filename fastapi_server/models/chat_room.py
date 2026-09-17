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

    # The member who looks after this room, chosen in /admin/rooms. Nullable:
    # a room without one is the normal state until somebody is assigned, and
    # the screens simply show no name.
    # Not a foreign key, to match the rest of this table - from_user_id and
    # to_user_id are plain integers too - so a deleted member leaves a dangling
    # id rather than blocking the delete. The join that reads it is an outer
    # one, so that shows up as no name rather than a missing room.
    user_id = Column(Integer, nullable=True)
