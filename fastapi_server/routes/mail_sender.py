from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import logging
import smtplib
from email.message import EmailMessage

from db import engine, get_db
from models.user_report import Base as UserReportBase, UserReport

log = logging.getLogger("app")

mail_sender_router = APIRouter()

ADMIN_MAIL = "admin@metaylimvemekirim.co.il"

# The project has no migration tool: tables are created by hand in pgAdmin.
# create_all only adds missing tables, so this is a no-op once it exists.
try:
    UserReportBase.metadata.create_all(bind=engine)
except Exception as e:  # pragma: no cover - never block startup on this
    log.warning("Could not ensure user_reports table exists: %s", e)

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
def send_report(payload: ReportPayload, db: Session = Depends(get_db)):
    # shown as "(id)name"
    reported = f"({payload.reportedUserId}){payload.reportedUserName or ''}"
    reporter = (
        f"({payload.reporterUserId}){payload.reporterName or ''}"
        if payload.reporterUserId
        else "אנונימי"
    )

    # Store first: the admin section is the durable copy of the report, the
    # mail is only the notification. Losing a report because SMTP is down
    # would be worse than a late notification.
    #
    # The row keeps the two form fields as they were filled in - subject is
    # "סוג הדיווח", content is "תיאור" - so the admin grid shows the report
    # itself rather than the wrapping the mail adds around it.
    db.add(
        UserReport(
            user_id=payload.reportedUserId,
            subject=payload.category or "-",
            content=payload.reason,
        )
    )
    db.commit()

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

    # The report is already saved and visible in /admin/reports, so a mail
    # failure must not fail the request and invite a duplicate resubmit.
    try:
        with smtplib.SMTP("smtp.zoho.com", 587) as server:
            server.starttls()
            server.login(ADMIN_MAIL, "bmyPk-v9")
            server.send_message(msg)
    except Exception as e:
        log.warning("Report saved but the mail could not be sent: %s", e)

    return {"ok": True}