from pydantic import BaseModel, ConfigDict, Field


class UserBlockBase(BaseModel):
    user_id: int = Field(..., ge=1)
    blocked_user_id: int = Field(..., ge=1)


class UserBlockCreate(UserBlockBase):
    pass


class UserBlockRead(UserBlockBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
