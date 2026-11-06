from pydantic import BaseModel, field_validator


class SendOTPRequest(BaseModel):
    email: str


class VerifyOTPRequest(BaseModel):
    email: str
    otp: str


class UserCreate(BaseModel):
    name: str
    phone_number: str
    email: str
    # Sign-in is by emailed one-time code, so a password is optional.
    password: str | None = None
    address: str
    location: str
    latitude: float | None = None
    longitude: float | None = None
    # farmer | buyer | machine_owner | storage_owner
    roles: list[str] = []


class UserUpdate(BaseModel):
    """Editable profile fields. Email is not editable (it is the sign-in identity)."""
    name: str | None = None
    phone_number: str | None = None
    address: str | None = None
    location: str | None = None
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
    roles: list[str] = []

    @field_validator("roles", mode="before")
    @classmethod
    def _active_role_names(cls, value):
        """Accept ORM UserRole rows and expose only the active role names."""
        return [r if isinstance(r, str) else r.role_type for r in value if isinstance(r, str) or r.deactivated_at is None]

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
