from fastapi import APIRouter, Depends

from config.ratelimit import limit
from sqlalchemy.orm import Session

from config.database import get_db
from config.security import get_current_user
from model.user import User
from schemas.user import SendOTPRequest, TokenResponse, UserCreate, UserResponse, UserUpdate, VerifyOTPRequest
from service.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/register", response_model=UserResponse, status_code=201, dependencies=[Depends(limit("register", 10))])
async def register_user(payload: UserCreate, db: Session = Depends(get_db)):
    return await UserService(db).register(payload)


@router.post("/send-otp", dependencies=[Depends(limit("send-otp", 15))])
async def send_otp(payload: SendOTPRequest, db: Session = Depends(get_db)):
    await UserService(db).send_otp(payload.email)
    return {"message": "A verification code has been sent"}


@router.post("/verify-otp", response_model=TokenResponse, dependencies=[Depends(limit("verify-otp", 30))])
def verify_otp(payload: VerifyOTPRequest, db: Session = Depends(get_db)):
    user, token = UserService(db).verify_otp(payload.email, payload.otp)
    return TokenResponse(access_token=token, user=user)


@router.get("/me", response_model=UserResponse)
def get_me(current: User = Depends(get_current_user)):
    return current


@router.delete("/me", status_code=204)
def delete_me(current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete (anonymise) the signed-in account. Blocked while orders/bookings are still open."""
    UserService(db).delete_account(current)


@router.patch("/me", response_model=UserResponse)
def update_me(payload: UserUpdate, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return UserService(db).update_profile(current, payload.model_dump(exclude_unset=True, exclude_none=True))
