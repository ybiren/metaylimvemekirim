from pydantic import BaseModel,  Field
from typing import List


class SmsUpdateCreate(BaseModel):
    fullName: str = Field(min_length=2)
    email: str = Field(min_length=3)
    phone: str = Field(min_length=9)

    ageGroups: List[str] = Field(min_length=1)

    personalEmailNote: str = Field(min_length=2)

    consentInfo: bool
    consentSignature: bool
