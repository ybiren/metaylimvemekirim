from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Any, Optional, Dict
from helper import insert_push_subscription
from db import get_db
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session



router3 = APIRouter(prefix="/push", tags=["push"])

class SubscribeBody(BaseModel):
  userId: Optional[int] = None
  subscription: Dict[str, Any]  # PushSubscription JSON
  userAgent: Optional[str] = None

class UnsubscribeBody(BaseModel):
  userId: Optional[int] = None
  endpoint: str

@router3.post("/subscribe")
def subscribe(body: SubscribeBody, db: Session = Depends(get_db)):
  sub = body.subscription
  endpoint = sub.get("endpoint")
  keys = (sub.get("keys") or {})
  p256dh = keys.get("p256dh")
  auth = keys.get("auth")
  
  if not endpoint or not p256dh or not auth:
    raise HTTPException(status_code=400, detail="Invalid subscription payload")

  insert_push_subscription(db, body.userId, sub, body.userAgent)


  return {"ok": True}

@router3.post("/unsubscribe")
def unsubscribe(body: UnsubscribeBody):
  # TODO: delete from DB by endpoint (and/or userId)
  return {"ok": True}
