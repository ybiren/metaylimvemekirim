# schemas/album.py

from typing import List, Optional
from pydantic import BaseModel, Field


class AlbumBase(BaseModel):
    title: str = Field(min_length=1)
    description: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0


class AlbumCreate(AlbumBase):
    pass


class AlbumUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class AlbumPhotoOut(BaseModel):
    id: int
    album_id: int
    filename: str
    content_type: Optional[str] = None
    size: int = 0
    sort_order: int = 0
    image_url: str = ""
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class AlbumOut(AlbumBase):
    id: int
    photo_count: int = 0
    cover_url: str = ""
    # first few pictures, so a listing can show the album is a set
    preview_urls: List[str] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


class AlbumDetailOut(AlbumOut):
    photos: List[AlbumPhotoOut] = []
