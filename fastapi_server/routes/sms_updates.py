from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session

from db import get_db
from models.sms_updates import SmsUpdate
from schemas.sms_updates import SmsUpdateCreate

router2 = APIRouter()


@router2.post("/sms_updates", status_code=201)
def create_sms_update(
    payload: SmsUpdateCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    if not payload.consentInfo or not payload.consentSignature:
        raise HTTPException(status_code=400, detail="Consents are required")

    record = SmsUpdate(
        full_name=payload.fullName,
        email=payload.email.lower(),
        phone=payload.phone,
        age_groups=payload.ageGroups,
        personal_email_note=payload.personalEmailNote,
        consent_info=payload.consentInfo,
        consent_signature=payload.consentSignature,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "ok": True,
        "id": record.id,
        "message": "SMS update registration saved",
    }
