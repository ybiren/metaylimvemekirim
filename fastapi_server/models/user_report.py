# models/user_report.py

from sqlalchemy import (
    BigInteger,
    Column,
    Index,
    Integer,
    Text,
    TIMESTAMP,
    func,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class UserReport(Base):
    """
    One "דווח על תוכן פוגעני" report, kept so the admin section can show the
    same thing that goes out by mail from routes/mail_sender.py.

    user_id is the reported profile - the one the report is about - so the
    admin list can be grouped and filtered by it.

    subject and content are the two fields of the report form as filled in:
    subject is "סוג הדיווח" (one of the fixed categories), content is the free
    text "תיאור".
    """

    __tablename__ = "user_reports"
    __table_args__ = (
        Index("ix_user_reports_user_id", "user_id"),
    )

    # no index=True: the primary key already carries its own unique index
    id = Column(BigInteger, primary_key=True)

    # plain integer, like user_likes.user_id and user_blocks.user_id: this
    # project keeps no foreign key across to public.users
    user_id = Column(Integer, nullable=False)

    subject = Column(Text, nullable=False)
    content = Column(Text, nullable=False)

    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
