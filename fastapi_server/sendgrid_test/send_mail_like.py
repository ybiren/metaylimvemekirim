import smtplib
from email.message import EmailMessage


def send_mail_like(email, liker_name, liker_id):
    msg = EmailMessage()
    msg["Subject"] = "מטיילים ומכירים - מישהו מחבב אותך"
    msg["From"] = "admin@metaylimvemekirim.co.il"
    msg["To"] = email

    who = liker_name or "מישהו"
    profile_link = f"https://metaylimvemekirim.co.il/user/{liker_id}"

    msg.set_content(
        "שלום,\n\n"
        f"{who} סימן/ה שהוא/היא מחבב/ת אותך באתר מטיילים ומכירים.\n\n"
        f"לצפייה בפרופיל:\n{profile_link}\n\n"
        "אם אינך מעוניין/ת לקבל הודעות דואר אלקטרוני, אפשר לבטל זאת במסך עדכון הפרטים.\n\n"
        "תודה,\n"
        "צוות מטיילים ומכירים\n"
        "https://metaylimvemekirim.co.il"
    )

    msg.add_alternative(f"""
    <html>
        <body dir="rtl" style="font-family:Arial,sans-serif;color:#222;">
            <p>שלום,</p>
            <p><strong>{who}</strong> סימן/ה שהוא/היא מחבב/ת אותך באתר <strong>מטיילים ומכירים</strong>.</p>
            <p>
                <a href="{profile_link}"
                   style="background:#24a859;color:white;padding:10px 15px;
                          text-decoration:none;border-radius:6px;display:inline-block;">
                   לצפייה בפרופיל
                </a>
            </p>
            <p style="font-size:12px;color:#888;">
                אם אינך מעוניין/ת לקבל הודעות דואר אלקטרוני, אפשר לבטל זאת במסך עדכון הפרטים.
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
            <p style="font-size:12px;color:#888;">
                <a href="https://metaylimvemekirim.co.il" style="color:#888;">metaylimvemekirim.co.il</a>
            </p>
        </body>
    </html>
    """, subtype="html")

    # Without a timeout an unreachable SMTP server hangs the request rather
    # than raising, which no caller can guard against.
    with smtplib.SMTP("smtp.zoho.com", 587, timeout=15) as server:
        server.starttls()
        server.login("admin@metaylimvemekirim.co.il", "bmyPk-v9")
        server.send_message(msg)

    return {"ok": True}
