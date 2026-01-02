from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class UserBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    name: Optional[str] = None
    gender: Optional[int] = None

    birth_day: Optional[int] = Field(default=None, ge=1, le=31)
    birth_month: Optional[int] = Field(default=None, ge=1, le=12)
    birth_year: Optional[int] = Field(default=None, ge=1900, le=2100)

    country: Optional[int] = None
    phone: Optional[str] = None
    email: Optional[str] = None   # ✅ plain string

    ff: Optional[int] = None

    details: Optional[str] = None
    details1: Optional[str] = None

    height: Optional[int] = None
    education: Optional[int] = None
    work: Optional[int] = None
    children: Optional[int] = None
    smoking: Optional[int] = None

    url: Optional[str] = None
    fb: Optional[str] = None

    filter_height_min: Optional[int] = None
    filter_height_max: Optional[int] = None
    filter_age_min: Optional[int] = None
    filter_age_max: Optional[int] = None

    filter_family_status: Optional[str] = None
    filter_smoking_status: Optional[str] = None


class UserCreate(UserBase):
    name: str
    email: str        # ✅ no EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: str        # ✅ no EmailStr
    password: str


class UserUpdate(UserBase):
    password: Optional[str] = Field(default=None, min_length=6, max_length=128)


class UserPublic(UserBase):
    id: int

    image_filename: Optional[str] = None
    image_content_type: Optional[str] = None
    image_size: Optional[int] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
