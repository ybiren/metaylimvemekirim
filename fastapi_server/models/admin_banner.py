# models/admin_banner.py

from sqlalchemy import Column, Integer, Text, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import BYTEA
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

class AdminBanner(Base):
    __tablename__ = "admin_banners"

    id = Column(Integer, primary_key=True, index=True)

    page = Column(Text, nullable=False, server_default="main")
    title = Column(Text, nullable=True)
    link_url = Column(Text, nullable=False)

    # BLOB storage
    image_mime = Column(Text, nullable=True)
    image_data = Column(BYTEA, nullable=True)

    is_active = Column(Boolean, nullable=False, server_default="true")
    sort_order = Column(Integer, nullable=False, server_default="0")

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )