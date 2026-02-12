from sqlalchemy import Column, BigInteger, Text, Boolean, TIMESTAMP, func
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass


class SitePage(Base):
    __tablename__ = "site_pages"

    id = Column(BigInteger, primary_key=True, index=True)

    # matches Angular route
    path = Column(Text, unique=True, nullable=False)

    title = Column(Text, nullable=False)

    html = Column(Text, nullable=False, default="")

    is_active = Column(Boolean, nullable=False, default=True)

    

    updated_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        nullable=False
    )
