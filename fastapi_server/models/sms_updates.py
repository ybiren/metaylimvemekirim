from sqlalchemy import (
    String,
    Boolean,
    Text,
    TIMESTAMP,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, INET
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class SmsUpdate(Base):
    __tablename__ = "sms_updates"

    id: Mapped[int] = mapped_column(primary_key=True)

    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str] = mapped_column(Text, nullable=False)

    age_groups: Mapped[list[str]] = mapped_column(
        ARRAY(Text),
        nullable=False,
        default=list,
    )

    personal_email_note: Mapped[str] = mapped_column(Text, nullable=False)

    consent_info: Mapped[bool] = mapped_column(Boolean, nullable=False)
    consent_signature: Mapped[bool] = mapped_column(Boolean, nullable=False)

    source: Mapped[str] = mapped_column(String(32), default="web")
    ip_address: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[str] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
    )
