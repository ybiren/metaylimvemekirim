# models/album.py

from sqlalchemy import (
    Column,
    BigInteger,
    Integer,
    Text,
    Boolean,
    ForeignKey,
    TIMESTAMP,
    func,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Album(Base):
    """A site photo album managed from /admin/albums."""

    __tablename__ = "albums"

    id = Column(BigInteger, primary_key=True, index=True)

    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)

    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")

    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    photos = relationship(
        "AlbumPhoto",
        back_populates="album",
        cascade="all, delete-orphan",
        order_by="AlbumPhoto.sort_order, AlbumPhoto.id",
    )


class AlbumPhoto(Base):
    """
    One picture inside an album.

    The bytes live on disk (data/images/albums/<album_id>/<guid>.<ext>), the same
    way user extra images are stored; only the metadata is kept here.
    """

    __tablename__ = "album_photos"

    id = Column(BigInteger, primary_key=True, index=True)

    album_id = Column(
        BigInteger,
        ForeignKey("albums.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    filename = Column(Text, nullable=False)
    path = Column(Text, nullable=False)  # relative to fastapi_server/
    content_type = Column(Text, nullable=True)
    size = Column(Integer, nullable=False, default=0, server_default="0")

    sort_order = Column(Integer, nullable=False, default=0, server_default="0")

    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    album = relationship("Album", back_populates="photos")
