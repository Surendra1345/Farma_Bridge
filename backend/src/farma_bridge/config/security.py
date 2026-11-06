"""JWT creation/validation and the FastAPI auth dependencies."""
import logging
import os
import secrets
from typing import Annotated
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from config.database import get_db
from model.user import User

load_dotenv()
log = logging.getLogger(__name__)

ALGORITHM = "HS256"
TOKEN_TTL = timedelta(days=int(os.getenv("JWT_TTL_DAYS", "7")))

_secret = os.getenv("JWT_SECRET")
if not _secret:
    # Tokens die on restart without a fixed secret; fine for a throwaway dev run only.
    _secret = secrets.token_urlsafe(48)
    log.warning("JWT_SECRET is not set - using a random per-process secret. Set it in .env.")

_bearer = HTTPBearer(auto_error=False)


def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": str(user_id), "iat": now, "exp": now + TOKEN_TTL}, _secret, algorithm=ALGORITHM)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(401, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    if creds is None:
        raise unauthorized
    try:
        payload = jwt.decode(creds.credentials, _secret, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise unauthorized
    user = db.get(User, user_id)
    if not user or not user.is_active or not user.is_verified:
        raise unauthorized
    return user


def admin_emails() -> set[str]:
    return {e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "").split(",") if e.strip()}


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.email.lower() not in admin_emails():
        raise HTTPException(403, "Admin access required")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
