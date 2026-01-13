# models/chat_message.py

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Index,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String(36), primary_key=True)
    from_user_id = Column(Integer, nullable=False, index=True)
    to_user_id = Column(Integer, nullable=False, index=True)

    content = Column(Text, nullable=False)

    sent_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)


    __table_args__ = (
        Index(
            "ix_chat_messages_room_sent",
            "from_user_id",
            "to_user_id",
            "sent_at",
        ),
    )
