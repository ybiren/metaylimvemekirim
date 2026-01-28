from sqlalchemy import Column, DateTime, Integer, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class UserLike(Base):
    __tablename__ = "user_likes"
    __table_args__ = (
        UniqueConstraint("user_id", "liked_user_id", name="uq_user_like_pair"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)  # needs SERIAL/IDENTITY in DB
    user_id = Column(Integer, nullable=False, index=True)
    liked_user_id = Column(Integer, nullable=False, index=True)
    sent_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
