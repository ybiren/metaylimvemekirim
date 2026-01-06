from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship, DeclarativeBase


class Base(DeclarativeBase):
    pass


class UserBlock(Base):
    __tablename__ = "user_blocks"
    __table_args__ = (
        UniqueConstraint("user_id", "blocked_user_id", name="uq_user_block_pair"),
        Index("ix_user_blocks_user_id", "user_id"),
        Index("ix_user_blocks_blocked_user_id", "blocked_user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    user_id: Mapped[int] = mapped_column(
        Integer,
        #ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    blocked_user_id: Mapped[int] = mapped_column(Integer, nullable=False)

    