import random
from fastapi import HTTPException
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from repositories.user_repo import UserRepository
from model.user import User
from schemes.user import UserCreate
from service.email_service import send_otp_email

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserService:
    def __init__(self, db: Session):
        self.repo = UserRepository(db)

    async def register(self, payload: UserCreate) -> User:
        if self.repo.get_by_phone_or_email(payload.phone_number, payload.email):
            raise HTTPException(400, "Phone number or email already registered")

        otp = f"{random.randint(0, 999999):06d}"

        user = User(
            name=payload.name,
            phone_number=payload.phone_number,
            email=payload.email,
            password_hash=pwd_context.hash(payload.password),
            address=payload.address,
            location=payload.location,
            latitude=payload.latitude,
            longitude=payload.longitude,
            otp=otp,
        )
        created_user = self.repo.create(user)

        # Dispatch OTP via SMTP email
        await send_otp_email(to_email=created_user.email, otp=otp, user_name=created_user.name)

        return created_user

    def get(self, user_id: int) -> User:
        user = self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(404, "User not found")
        return user

    async def send_otp(self, email: str) -> str:
        user = self.repo.get_by_email(email)
        if not user:
            raise HTTPException(404, "User not found")
        otp = f"{random.randint(0, 999999):06d}"
        user.otp = otp
        self.repo.update(user)

        # Dispatch OTP via SMTP email
        await send_otp_email(to_email=user.email, otp=otp, user_name=user.name)
        return otp

    def verify_otp(self, email: str, otp: str) -> None:
        user = self.repo.get_by_email(email)
        if not user or user.otp != otp:
            raise HTTPException(400, "Invalid OTP")
        user.otp = None
        self.repo.update(user)
