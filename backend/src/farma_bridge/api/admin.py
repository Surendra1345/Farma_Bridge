"""Admin-only moderation: find users and suspend / reinstate them. Admins are listed in ADMIN_EMAILS."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from config.database import get_db
from config.security import admin_emails, require_admin
from model.user import User

router = APIRouter(prefix="/admin", tags=["admin"])


class AdminUser(BaseModel):
    id: int
    name: str
    email: str
    phone_number: str
    location: str
    is_active: bool
    is_verified: bool
    trust_score: float | None = None

    class Config:
        from_attributes = True


class ActiveUpdate(BaseModel):
    active: bool


@router.get("/users", response_model=list[AdminUser])
def list_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    search: str | None = Query(None, max_length=100),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    q = db.query(User)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(User.name.ilike(like), User.email.ilike(like), User.phone_number.ilike(like)))
    return q.order_by(User.id.desc()).offset(offset).limit(limit).all()


@router.patch("/users/{user_id}/active", response_model=AdminUser)
def set_user_active(user_id: int, payload: ActiveUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Suspend (active=false) or reinstate a user. A suspended user's tokens stop working immediately."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id or user.email.lower() in admin_emails():
        raise HTTPException(400, "You can't suspend an administrator")
    user.is_active = payload.active
    db.commit()
    db.refresh(user)
    return user
