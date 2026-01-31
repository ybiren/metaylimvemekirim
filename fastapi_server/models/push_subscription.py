# models/push_subscription.py
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import BigInteger, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)

    user_id: Mapped[int] = mapped_column(
        nullable=False,
        index=True,
    )

    endpoint: Mapped[str] = mapped_column(Text, nullable=False, unique=True)

    # The whole PushSubscription JSON from the browser:
    subscription: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)

    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

