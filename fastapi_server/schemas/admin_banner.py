# schemas/admin_banner.py

from typing import Optional, Literal
from pydantic import BaseModel, Field

BannerPage = Literal["main", "about", "contact"]


class AdminBannerBase(BaseModel):
    page: BannerPage = "main"
    title: Optional[str] = None
    link_url: str = Field(min_length=1)
    is_active: bool = True
    sort_order: int = 0


class AdminBannerCreate(AdminBannerBase):
    pass


class AdminBannerUpdate(BaseModel):
    page: Optional[BannerPage] = None
    title: Optional[str] = None
    link_url: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class AdminBannerOut(AdminBannerBase):
    id: int
    image_url: str = ""
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True