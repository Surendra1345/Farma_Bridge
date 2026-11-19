import hmac
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException
from passlib.context import CryptContext
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config.security import create_access_token
from model.booking import Booking
from model.farmer import Farmer
from model.machine_listing import MachineListing
from model.order import Order
from model.storage_listing import StorageListing
from model.user import User
from repositories.user_repo import UserRepository
from schemas.user import UserCreate
from service.email_service import send_otp_email
from service.user_role_service import VALID_ROLES, UserRoleService

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

OTP_TTL = timedelta(minutes=5)
OTP_RESEND_COOLDOWN = timedelta(seconds=30)
OTP_MAX_ATTEMPTS = 5


def _new_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


class UserService:
    def __init__(self, db: Session):
        self.repo = UserRepository(db)
        self.roles = UserRoleService(db)

    async def register(self, payload: UserCreate) -> User:
        bad = [r for r in payload.roles if r not in VALID_ROLES]
        if bad:
            raise HTTPException(400, f"Unknown role(s) {bad}; allowed: {sorted(VALID_ROLES)}")

        existing = self.repo.get_by_phone_or_email(payload.phone_number, payload.email)
        if existing and existing.is_verified:
            raise HTTPException(400, "Phone number or email already registered")

        password_hash = pwd_context.hash(payload.password or secrets.token_urlsafe(32))
        email_changed = bool(existing and existing.email != payload.email)
        try:
            if existing:  # unfinished sign-up: let the person start over with corrected details
                existing.name, existing.phone_number, existing.email = payload.name, payload.phone_number, payload.email
                existing.address, existing.location = payload.address, payload.location
                existing.latitude, existing.longitude = payload.latitude, payload.longitude
                existing.password_hash = password_hash
                user = self.repo.update(existing)
            else:
                user = self.repo.create(User(
                    name=payload.name, phone_number=payload.phone_number, email=payload.email,
                    password_hash=password_hash, address=payload.address, location=payload.location,
                    latitude=payload.latitude, longitude=payload.longitude, is_verified=False,
                ))
        except IntegrityError:
            self.repo.db.rollback()
            raise HTTPException(400, "Phone number or email already registered")

        for role in dict.fromkeys(payload.roles):
            try:
                self.roles.add_role(user.id, role)
            except HTTPException:
                pass  # already active from an earlier attempt

        await self._issue_otp(user, enforce_cooldown=not email_changed)
        return user

    def get(self, user_id: int) -> User:
        user = self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(404, "User not found")
        return user

    def update_profile(self, user: User, changes: dict) -> User:
        for field in ("name", "phone_number", "address", "location"):
            if field in changes and not (changes[field] or "").strip():
                raise HTTPException(400, f"{field.replace('_', ' ').capitalize()} cannot be empty")
        phone = changes.get("phone_number")
        if phone and phone != user.phone_number:
            other = self.repo.get_by_phone_or_email(phone, user.email)
            if other and other.id != user.id:
                raise HTTPException(400, "That phone number is already used by another account")
        for field, value in changes.items():
            value = value.strip() if isinstance(value, str) else value
            setattr(user, field, (value or None) if field == "upi_id" else value)
        try:
            return self.repo.update(user)
        except IntegrityError:
            self.repo.db.rollback()
            raise HTTPException(400, "That phone number is already used by another account")

    def delete_account(self, user: User) -> None:
        """Anonymise the account and take its listings off the market. History (orders, reviews) is kept."""
        db = self.repo.db
        open_orders = db.query(Order).filter(
            or_(Order.buyer_id == user.id, Order.farmer_id == user.id), Order.status.in_(("Pending", "Confirmed"))
        ).count()
        open_bookings = db.query(Booking).filter(
            or_(Booking.requester_id == user.id, Booking.provider_id == user.id), Booking.status.in_(("Pending", "Confirmed"))
        ).count()
        if open_orders or open_bookings:
            raise HTTPException(400, "You still have open orders or bookings. Complete or cancel them before deleting your account")
        db.query(Farmer).filter(Farmer.user_id == user.id).update({"status": "Sold", "quantity_remaining": 0})
        db.query(MachineListing).filter(MachineListing.owner_id == user.id).update({"status": "Booked"})
        db.query(StorageListing).filter(StorageListing.owner_id == user.id).update({"availability_indicator": "Full"})
        user.name, user.email = "Deleted user", f"deleted-{user.id}@deleted.invalid"
        user.phone_number, user.address, user.location = f"deleted-{user.id}", "-", "-"
        user.otp = user.otp_expires_at = None
        user.password_hash = "!"
        user.is_active = False
        db.commit()

    async def send_otp(self, email: str) -> None:
        user = self.repo.get_by_email(email)
        if not user:
            raise HTTPException(404, "User not found")
        if not user.is_active:
            raise HTTPException(403, "This account is suspended")
        await self._issue_otp(user)

    def verify_otp(self, email: str, otp: str) -> tuple[User, str]:
        user = self.repo.get_by_email(email)
        invalid = HTTPException(400, "Invalid or expired code")
        if not user or not user.otp or not user.otp_expires_at:
            raise invalid
        if user.otp_attempts >= OTP_MAX_ATTEMPTS:
            raise HTTPException(429, "Too many wrong attempts. Request a new code.")
        if datetime.utcnow() > user.otp_expires_at:
            raise invalid
        if not hmac.compare_digest(user.otp, otp):
            user.otp_attempts += 1
            self.repo.update(user)
            raise invalid

        user.otp, user.otp_expires_at, user.otp_attempts = None, None, 0
        user.is_verified = True
        user = self.repo.update(user)
        return user, create_access_token(user.id)

    async def _issue_otp(self, user: User, enforce_cooldown: bool = True) -> None:
        now = datetime.utcnow()
        if enforce_cooldown and user.otp_expires_at and now < user.otp_expires_at - OTP_TTL + OTP_RESEND_COOLDOWN:
            raise HTTPException(429, "Please wait a few seconds before requesting another code.")
        otp = _new_otp()
        user.otp, user.otp_expires_at, user.otp_attempts = otp, now + OTP_TTL, 0
        self.repo.update(user)
        await send_otp_email(to_email=user.email, otp=otp, user_name=user.name)
