"""Best-effort email notifications for new/changed orders and bookings.

Off unless NOTIFY_EMAIL_ENABLED=true (and SMTP credentials are set), so tests and dev runs never send mail.
Failures are logged and never break the request that triggered them.
"""
import logging
import os
import threading

from sqlalchemy.orm import Session

from model.user import User

log = logging.getLogger(__name__)


def _enabled() -> bool:
    return os.getenv("NOTIFY_EMAIL_ENABLED", "false").lower() in {"1", "true", "yes"} and bool(os.getenv("EMAIL_ADDRESS")) and bool(os.getenv("EMAIL_PASSWORD"))


def notify_user(db: Session, user_id: int, subject: str, message: str) -> None:
    user = db.get(User, user_id)
    if not user or not user.is_active:
        return
    body = f"Hi {user.name},\n\n{message}\n\nOpen Farma Bridge to respond.\n\nThe Farma Bridge Team"
    if not _enabled():
        log.info("[notification not sent: NOTIFY_EMAIL_ENABLED off] to=%s subject=%s", user.email, subject)
        return

    def send() -> None:
        try:
            from service.email_service import _send_plain_sync
            _send_plain_sync(user.email, f"Farma Bridge - {subject}", body)
        except Exception:  # noqa: BLE001 - never let a mail problem affect the app
            log.exception("Could not send notification email to user %s", user.id)

    threading.Thread(target=send, daemon=True).start()
