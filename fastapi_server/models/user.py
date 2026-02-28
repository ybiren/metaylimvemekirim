# models/user.py
from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    Integer,
    String,
    Text,
    func,
    Boolean
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.dialects.postgresql import JSONB


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "public"}  # important if you're using schemas

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(255))
    gender = Column(Integer)

    birth_day = Column(Integer)
    birth_month = Column(Integer)
    birth_year = Column(Integer)

    country = Column(Integer)
    phone = Column(String(50))

    email = Column(String(255), unique=True, index=True)  # matches unique index

    password_hash = Column(String(255), nullable=False)

    ff = Column(Integer)

    details = Column(Text)
    details1 = Column(Text)

    session_id = Column(String(128))

    image_filename = Column(String(255))
    image_content_type = Column(String(100))
    image_size = Column(BigInteger)
    image_path = Column(String(500))

    height = Column(Integer)
    education = Column(Integer)
    work = Column(Integer)
    children = Column(Integer)
    smoking = Column(Integer)

    url = Column(String(500))
    fb = Column(String(500))

    filter_height_min = Column(Integer)
    filter_height_max = Column(Integer)
    filter_age_min = Column(Integer)
    filter_age_max = Column(Integer)

    filter_family_status = Column(String(100))
    filter_smoking_status = Column(String(20))

    notify_push = Column(Boolean, nullable=False, server_default="false")
    notify_email = Column(Boolean, nullable=False, server_default="false")
    
    isfreezed = Column("isfreezed", Boolean)
    isdeleted = Column("isdeleted", Boolean)

    extra_images = Column(
        JSONB,
        nullable=True,
        default=list   
    )

    # timestamptz (timestamp with time zone)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_seen_at = Column(
        DateTime(timezone=True),
        nullable=True
    )
    