import asyncio
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()

EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")


def smtp_enabled() -> bool:
    """Read this at send time so a changed .env setting takes effect reliably."""
    return os.getenv("OTP_EMAIL_ENABLED", "false").lower() in {"1", "true", "yes"}

def _send_otp_email_sync(to_email: str, otp: str, user_name: str = "User") -> bool:
    """
    Sends a 6-digit OTP email to the user for FarmaBridge registration or account verification.
    """
    load_dotenv(override=True)
    email_address = os.getenv("EMAIL_ADDRESS")
    email_password = os.getenv("EMAIL_PASSWORD")
    send_via_smtp = smtp_enabled()

    if email_password:
        email_password = email_password.replace(" ", "").strip()
    if email_address:
        email_address = email_address.strip()

    if not email_address or not email_password:
        print("WARNING: EMAIL_ADDRESS or EMAIL_PASSWORD environment variables are not set in .env")

    try:
        msg = MIMEMultipart()
        msg['From'] = email_address or "no-reply@farmabridge.com"
        msg['To'] = to_email
        msg['Subject'] = "FarmaBridge — Your Registration OTP"

        body = f"""Dear {user_name},

Welcome to FarmaBridge!

Your One-Time Password (OTP) for registration and account verification is:

    {otp}

This OTP is valid for 5 minutes.
Please do not share this OTP with anyone for security reasons.

If you did not initiate this registration, please ignore this email or contact support immediately.

Regards,
The FarmaBridge Team
"""

        msg.attach(MIMEText(body, 'plain'))

        if send_via_smtp and email_address and email_password:
            with smtplib.SMTP('smtp.gmail.com', 587) as server:
                server.starttls()
                server.login(email_address, email_password)
                server.sendmail(email_address, to_email, msg.as_string())
            print(f"OTP email sent successfully to {to_email}")
        else:
            print(f"[Simulated Email] OTP for {to_email} ({user_name}): {otp}")

        return True

    except Exception as e:
        print(f"Failed to send OTP email to {to_email}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send OTP email: {str(e)}"
        )


async def send_otp_email(to_email: str, otp: str, user_name: str = "User") -> bool:
    """Send an OTP without blocking FastAPI's event loop."""
    return await asyncio.to_thread(_send_otp_email_sync, to_email, otp, user_name)
