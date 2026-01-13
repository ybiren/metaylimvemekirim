# schemas/chat_message.py

from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Literal

from pydantic import BaseModel, Field, ConfigDict


# -------------------------
# Core / shared
# -------------------------

class ChatMessageBase(BaseModel):
    from_user_id: int
    to_user_id: int
    content: str = Field(..., min_length=1)


