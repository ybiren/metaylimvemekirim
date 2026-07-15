import smtplib
from email.message import EmailMessage
from helper import encrypt_uid

def send_mail(email, uid):
    msg = EmailMessage()
    msg["Subject"] = "מטיילים ומכירים - לינק לאיפוס סיסמא"
    msg["From"] = "admin@metaylimvemekirim.co.il"
    msg["To"] = email

    reset_link = f"https://metaylimvemekirim.co.il/reset-password?reset-password-uid={encrypt_uid(uid)}"

    # טקסט רגיל (חשוב מאוד!)
    msg.set_content(
        "שלום,\n\n"
        "קיבלנו בקשה לאיפוס הסיסמה עבור החשבון שלך באתר מטיילים ומכירים.\n\n"
        f"לבחירת סיסמה חדשה, לחץ על הקישור הבא:\n{reset_link}\n\n"
        "אם לא ביקשת איפוס סיסמה, ניתן להתעלם מהודעה זו והחשבון שלך יישאר מאובטח.\n"
        "הקישור יהיה בתוקף למשך 30 דקות.\n\n"
        "תודה,\n"
        "צוות מטיילים ומכירים\n"
        "https://metaylimvemekirim.co.il\n"
        "support@metaylimvemekirim.co.il"
    )

    # HTML
    msg.add_alternative(f"""
    <html>
        <body dir="rtl" style="font-family:Arial,sans-serif;color:#222;">
            <p>שלום,</p>
            <p>קיבלנו בקשה לאיפוס הסיסמה עבור החשבון שלך באתר <strong>מטיילים ומכירים</strong>.</p>
            <p>אם אתה ביקשת את איפוס הסיסמה, לחץ על הכפתור למטה כדי לבחור סיסמה חדשה.</p>
            <p>
                <a href="{reset_link}"
                   style="background:#1e88e5;color:white;padding:10px 15px;
                          text-decoration:none;border-radius:6px;display:inline-block;">
                   אפס סיסמא
                </a>
            </p>
            <p>אם לא ביקשת איפוס סיסמה, ניתן להתעלם מהודעה זו והחשבון שלך יישאר מאובטח.</p>
            <p>הקישור יהיה בתוקף למשך 30 דקות.</p>
            <p>תודה,<br>צוות מטיילים ומכירים</p>
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
            <p style="font-size:12px;color:#888;">
                <a href="https://metaylimvemekirim.co.il" style="color:#888;">metaylimvemekirim.co.il</a>
                &nbsp;|&nbsp; support@metaylimvemekirim.co.il
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