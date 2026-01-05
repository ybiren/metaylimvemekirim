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