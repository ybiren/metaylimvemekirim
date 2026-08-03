from fastapi import APIRouter
from pydantic import BaseModel
import smtplib
from email.message import EmailMessage

mail_sender_router = APIRouter()

ADMIN_MAIL = "admin@metaylimvemekirim.co.il"

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
        server.login(ADMIN_MAIL, "bmyPk-v9")
        server.send_message(msg)

    return {"ok": True}


@mail_sender_router.post("/report")
def send_report(payload: ReportPayload):
    # shown as "(id)name"
    reported = f"({payload.reportedUserId}){payload.reportedUserName or ''}"
    reporter = (
        f"({payload.reporterUserId}){payload.reporterName or ''}"
        if payload.reporterUserId
        else "אנונימי"
    )

    msg = EmailMessage()
    msg["Subject"] = f"דיווח על תכנים פוגעניים - פרופיל {reported}"
    # the reporter stays anonymous, so the mail carries no address of theirs
    msg["From"] = ADMIN_MAIL
    msg["To"] = ADMIN_MAIL

    msg.set_content(f"""\
דיווח חדש על תכנים פוגעניים

פרופיל מדווח: {reported}
מדווח: {reporter}
קטגוריה: {payload.category or "-"}

תיאור:
{payload.reason}
""")

    with smtplib.SMTP("smtp.zoho.com", 587) as server:
        server.starttls()
        server.login(ADMIN_MAIL, "bmyPk-v9")
        server.send_message(msg)

    return {"ok": True}