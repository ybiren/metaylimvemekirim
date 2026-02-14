from sqlalchemy import Column, BigInteger, Text, Boolean, Integer, TIMESTAMP, func
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

class SiteLink(Base):
    __tablename__ = "site_links"

    id = Column(BigInteger, primary_key=True, index=True)

    title = Column(Text, nullable=False)
    href = Column(Text, nullable=False)

    is_promo = Column(Boolean, nullable=False, default=False)
    underline = Column(Boolean, nullable=False, default=False)
    bold = Column(Boolean, nullable=False, default=False)
    target_blank = Column(Boolean, nullable=False, default=True)

    sort_order = Column(Integer, nullable=False, default=0)

    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    updated_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
