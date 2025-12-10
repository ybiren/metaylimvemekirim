import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

def send_mail(email,pswd):
  message = Mail(
    from_email='bengold789@gmail.com',
    to_emails=email,
    subject="מטיילים ומכירים - איפוס סיסמא",
    html_content=f"<strong>{pswd}</strong>",
  )

  sg = SendGridAPIClient("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")
  response = sg.send(message)
  return response.status_code