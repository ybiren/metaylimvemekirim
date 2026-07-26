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


class ReportPayload(BaseModel):
    reportedUserId: int
    reportedUserName: str | None = None
    reporterUserId: int | None = None
    reporterName: str | None = None
    category: str | None = None
    reason: str

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


@mail_sender_router.post("/report")
def send_report(payload: ReportPayload):
    reported = payload.reportedUserName or f"#{payload.reportedUserId}"
    reporter = payload.reporterName or (
        f"#{payload.reporterUserId}" if payload.reporterUserId else "אנונימי"
    )

    msg = EmailMessage()
    msg["Subject"] = f"דיווח על תכנים פוגעניים - פרופיל {reported} (#{payload.reportedUserId})"
    # From must be the authenticated Zoho address; report is delivered to sar888.
    msg["From"] = "admin@metaylimvemekirim.co.il"
    msg["To"] =  "sar888@gmail.com"

    msg.set_content(f"""\
דיווח חדש על תכנים פוגעניים

פרופיל מדווח: {reported} (userId={payload.reportedUserId})
מדווח: {reporter} (userId={payload.reporterUserId})
קטגוריה: {payload.category or "-"}

תיאור:
{payload.reason}
""")

    with smtplib.SMTP("smtp.zoho.com", 587) as server:
        server.starttls()
        server.login("admin@metaylimvemekirim.co.il", "bmyPk-v9")
        server.send_message(msg)

    return {"ok": True}