from pydantic import BaseModel, ConfigDict, Field


class UserLikekBase(BaseModel):
    user_id: int = Field(..., ge=1)
    liked_user_id: int = Field(..., ge=1)



class UserLikeCreate(UserLikekBase):
    pass


class UserLIkekRead(UserLikekBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
