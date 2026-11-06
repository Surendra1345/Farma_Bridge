from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from config.database import get_db
from config.security import get_current_user
from model.user import User
from schemas.user import SendOTPRequest, TokenResponse, UserCreate, UserResponse, UserUpdate, VerifyOTPRequest
from service.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/register", response_model=UserResponse, status_code=201)
async def register_user(payload: UserCreate, db: Session = Depends(get_db)):
    return await UserService(db).register(payload)


@router.post("/send-otp")
async def send_otp(payload: SendOTPRequest, db: Session = Depends(get_db)):
    await UserService(db).send_otp(payload.email)
    return {"message": "A verification code has been sent"}


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(payload: VerifyOTPRequest, db: Session = Depends(get_db)):
    user, token = UserService(db).verify_otp(payload.email, payload.otp)
    return TokenResponse(access_token=token, user=user)


@router.get("/me", response_model=UserResponse)
def get_me(current: User = Depends(get_current_user)):
    return current


@router.patch("/me", response_model=UserResponse)
def update_me(payload: UserUpdate, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return UserService(db).update_profile(current, payload.model_dump(exclude_unset=True, exclude_none=True))
