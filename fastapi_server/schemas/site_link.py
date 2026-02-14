from __future__ import annotations

from pydantic import BaseModel, Field, HttpUrl
from typing import Optional
from datetime import datetime


# -------------------------
# Shared / Base
# -------------------------
class SiteLinkBase(BaseModel):
    """
    Common fields used by multiple schemas.
    """

    title: str = Field(..., min_length=1)

    # If you want to allow internal Angular routes like /about
    # change HttpUrl -> str
    href: str = Field(..., description="External URL or internal Angular route")

    is_promo: bool = False
    underline: bool = False
    bold: bool = False
    target_blank: bool = True

    sort_order: int = 0
    is_active: bool = True


# -------------------------
# Admin: create
# -------------------------
class SiteLinkCreate(SiteLinkBase):
    """
    Used when admin creates a new link (POST).
    """
    pass


# -------------------------
# Admin: update (partial)
# -------------------------
class SiteLinkUpdate(BaseModel):
    """
    Used for PATCH / PUT.
    Everything optional.
    """

    title: Optional[str] = Field(None, min_length=1)
    href: Optional[str] = None

    is_promo: Optional[bool] = None
    underline: Optional[bool] = None
    bold: Optional[bool] = None
    target_blank: Optional[bool] = None

    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


# 🔥 VERY useful endpoint schema
class SiteLinkReorder(BaseModel):
    """
    Used by drag-and-drop admin UI.
    """
    id: int
    sort_order: int


# -------------------------
# Outputs
# -------------------------
class SiteLinkOut(SiteLinkBase):
    """
    Full DB record returned from admin endpoints.
    """

    id: int
    updated_at: datetime

    class Config:
        from_attributes = True


class SiteLinkListOut(BaseModel):
    """
    Lightweight row for admin tables.
    """

    id: int
    title: str
    href: str
    sort_order: int
    is_active: bool
    updated_at: datetime

    class Config:
        from_attributes = True


class SiteLinkPublicOut(BaseModel):
    """
    What the public site receives.
    Keep it minimal for performance.
    """

    title: str
    href: str
    is_promo: bool
    underline: bool
    bold: bool
    target_blank: bool

    class Config:
        from_attributes = True
