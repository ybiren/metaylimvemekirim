import smtplib
from email.message import EmailMessage

def send_mail_verification(email, uid):
    msg = EmailMessage()
    msg["Subject"] = "מטיילים ומכירים - לינק לאימות דואר אלקטרוני"
    msg["From"] = "admin@metaylimvemekirim.co.il"
    msg["To"] = email

    reset_link = f"https://metaylimvemekirim.co.il/email-verified?email-verified-uid={uid}"
    
    # טקסט רגיל (חשוב מאוד!)
    msg.set_content(f"אימות דואר אלקטרוני: {reset_link}")

    # HTML
    msg.add_alternative(f"""
    <html>
        <body dir="rtl">
            <h3>לאימות דואר אלקטרוני</h3>
            <p>לחץ על הקישור הבא:</p>
            <p>
                <a href="{reset_link}" 
                   style="background:#1e88e5;color:white;padding:10px 15px;
                          text-decoration:none;border-radius:6px;">
                   אימות דואר אלקטרוני
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

