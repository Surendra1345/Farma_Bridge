from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from config.database import get_db
from service.user_service import UserService
from schemes.user import UserCreate, UserResponse, SendOTPRequest, VerifyOTPRequest

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/register", response_model=UserResponse, status_code=201)
async def register_user(payload: UserCreate, db: Session = Depends(get_db)):
    return await UserService(db).register(payload)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    return UserService(db).get(user_id)


@router.post("/send-otp")
async def send_otp(payload: SendOTPRequest, db: Session = Depends(get_db)):
    await UserService(db).send_otp(payload.email)
    return {"message": f"OTP successfully sent to {payload.email}"}


@router.post("/verify-otp")
def verify_otp(payload: VerifyOTPRequest, db: Session = Depends(get_db)):
    UserService(db).verify_otp(payload.email, payload.otp)
    return {"message": "OTP verified"}