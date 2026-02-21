from fastapi import APIRouter
from pydantic import BaseModel
import smtplib
from email.message import EmailMessage

mail_sender_router = APIRouter()

class ContactPayload(BaseModel):
    name: str
    email: str
    subject: str
    message: str

@mail_sender_router.post("/contact")
def send_contact(payload: ContactPayload):
    msg = EmailMessage()
    msg["Subject"] = f"Contact Form: {payload.subject}"
    msg["From"] = "admin@metaylimvemekirim.co.il"
    msg["To"] = "admin@metaylimvemekirim.co.il"
    msg["Reply-To"] = payload.email
    
    msg.set_content(f"""
    Name: {payload.name}
    Email: {payload.email}

    Message:
    {payload.message}
    """)

    with smtplib.SMTP("smtp.zoho.com", 587) as server:
        server.starttls()
        server.login("admin@metaylimvemekirim.co.il", "bmyPk-v9")
        server.send_message(msg)

    return {"ok": True}