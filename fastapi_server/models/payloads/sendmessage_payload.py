# fastapi_server/models/sendmessage_payload.py
from pydantic import BaseModel, Field
from datetime import datetime

class SendMessagePayload(BaseModel):
    fromId: int
    toId: int
    body: str = Field(min_length=1, max_length=2000)
    sentAt: datetime  # parses ISO-8601 automatically

__all__ = ["SendMessagePayload"]
