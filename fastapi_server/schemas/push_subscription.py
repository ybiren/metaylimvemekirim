# schemas/push_subscription.py
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field


class PushSubscribeIn(BaseModel):
    userId: int
    subscription: Dict[str, Any]
    userAgent: Optional[str] = None


class PushUnsubscribeIn(BaseModel):
    userId: int
    endpoint: str


class PushSubscriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    endpoint: str
    subscription: Dict[str, Any]
    user_agent: Optional[str] = None
    created_at: datetime
    updated_at: datetime
