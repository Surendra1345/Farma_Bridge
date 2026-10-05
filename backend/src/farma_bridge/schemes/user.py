from pydantic import BaseModel


class SendOTPRequest(BaseModel):
    email: str


class VerifyOTPRequest(BaseModel):
    email: str
    otp: str


class LoginRequest(BaseModel):
    identifier: str  # email or phone number
    password: str


class UserCreate(BaseModel):
    name: str
    phone_number: str
    email: str
    password: str
    address: str
    location: str
    latitude: float | None = None
    longitude: float | None = None


class UserResponse(BaseModel):
    id: int
    name: str
    phone_number: str
    email: str
    address: str
    location: str
    latitude: float | None = None
    longitude: float | None = None
    trust_score: float | None = None

    class Config:
        from_attributes = True