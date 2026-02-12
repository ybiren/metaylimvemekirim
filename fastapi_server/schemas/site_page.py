# schemas/site_page.py
from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# -------------------------
# Shared / Base
# -------------------------
class SitePageBase(BaseModel):
    """
    Common fields used by multiple schemas.
    """
    path: str = Field(..., description="Angular route path, e.g. /about-us")
    title: str = Field(..., min_length=1)
    html: str = Field("", description="HTML content saved from the editor")
    is_active: bool = True

    seo_title: Optional[str] = None
    seo_description: Optional[str] = None


# -------------------------
# Admin: create / upsert
# -------------------------
class SitePageCreate(SitePageBase):
    """
    Used when admin creates a new page (POST).
    """
    pass


class SitePageUpdate(BaseModel):
    """
    Used for partial updates (PATCH / PUT).
    All fields are optional.
    """
    title: Optional[str] = Field(None, min_length=1)
    html: Optional[str] = None
    is_active: Optional[bool] = None

class SitePageUpdateHtml(BaseModel):
    """
    Used for a 'update html only' endpoint.
    """
    html: str = ""


# -------------------------
# Outputs
# -------------------------
class SitePageOut(SitePageBase):
    """
    Full DB record returned from admin endpoints.
    """
    id: int
    updated_at: datetime

    class Config:
        from_attributes = True


class SitePageListOut(BaseModel):
    """
    Lightweight row for admin list/table views
    (does not include large html content).
    """
    id: int
    path: str
    title: str
    is_active: bool
    updated_at: datetime

    class Config:
        from_attributes = True


class SitePagePublicOut(BaseModel):
    """
    What regular site users should receive.
    Keep it minimal.
    """
    path: str
    title: str
    html: str

    class Config:
        from_attributes = True
