from sqlalchemy import (
    String,
    Boolean,
    Text,
    TIMESTAMP,
    func,
)
from sqlalchemy.dialects.postgresql import INET
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from typing import Optional


class Base(DeclarativeBase):
    pass


# Hebrew label (as sent by the Angular form) -> boolean column name on SmsUpdate.
# This is the single source of truth for the age-group columns.
AGE_GROUP_COLUMNS: dict[str, str] = {
    'קבוצת גיל 32-43': 'age_32_43',
    'קבוצת גיל עד 40': 'age_up_to_40',
    'קבוצת גיל עד 49': 'age_up_to_49',
    'קבוצת גיל 45-55': 'age_45_55',
    'קבוצת גיל עד 59': 'age_up_to_59',
    'קבוצת גיל עד 67': 'age_up_to_67',
    'קבוצת גיל 67 ומעלה': 'age_67_plus',
    'אירועים להורים וילדים גרושים\\יחידנים': 'divorced_singles_parents_events',
    'טיולים למטיבי לכת (12 ק"מ ומעלה,הרבה טיפוס)': 'advanced_hikers_events',
}


class SmsUpdate(Base):
    __tablename__ = "sms_updates"

    id: Mapped[int] = mapped_column(primary_key=True)

    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str] = mapped_column(Text, nullable=False)

    age_32_43: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    age_up_to_40: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    age_up_to_49: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    age_45_55: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    age_up_to_59: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    age_up_to_67: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    age_67_plus: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    divorced_singles_parents_events: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    advanced_hikers_events: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    personal_email_note: Mapped[str] = mapped_column(Text, nullable=False)

    consent_info: Mapped[bool] = mapped_column(Boolean, nullable=False)
    consent_signature: Mapped[bool] = mapped_column(Boolean, nullable=False)

    source: Mapped[str] = mapped_column(String(32), default="web")
    ip_address: Mapped[Optional[str]] = mapped_column(INET)
    user_agent: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[str] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
    )
