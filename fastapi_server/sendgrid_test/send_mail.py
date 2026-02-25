import smtplib
from email.message import EmailMessage
from helper import encrypt_uid

def send_mail(email, uid):
    msg = EmailMessage()
    msg["Subject"] = "מטיילים ומכירים - לינק לאיפוס סיסמא"
    msg["From"] = "admin@metaylimvemekirim.co.il"
    msg["To"] = email

    reset_link = f"https://metaylimvemekirim.co.il/reset-password?uid={encrypt_uid(uid)}"

    # טקסט רגיל (חשוב מאוד!)
    msg.set_content(f"איפוס סיסמא: {reset_link}")

    # HTML
    msg.add_alternative(f"""
    <html>
        <body dir="rtl">
            <h3>איפוס סיסמא</h3>
            <p>לחץ על הקישור הבא:</p>
            <p>
                <a href="{reset_link}" 
                   style="background:#1e88e5;color:white;padding:10px 15px;
                          text-decoration:none;border-radius:6px;">
                   אפס סיסמא
                </a>
            </p>
        </body>
    </html>
    """, subtype="html")

    with smtplib.SMTP("smtp.zoho.com", 587) as server:
        server.starttls()
        server.login("admin@metaylimvemekirim.co.il", "bmyPk-v9")
        server.send_message(msg)

    return {"ok": True}

'''
import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from helper import encrypt_uid


def send_mail(email,uid):
  message = Mail(
    from_email='bengold789@gmail.com',
    to_emails=email,
    subject="מטיילים ומכירים - לינק לאיפוס סיסמא",
    html_content=f"<strong><a href='http://194.36.90.119:8000/?uid={encrypt_uid(uid)}'>אפס סיסמא</a></strong>",
  )

  sg = SendGridAPIClient("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")
  response = sg.send(message)
  return response.status_code
  '''