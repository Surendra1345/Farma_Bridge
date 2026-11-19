import re

from pydantic import BaseModel, Field, field_validator

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
_PHONE = re.compile(r"^\d{10}$")
_UPI = re.compile(r"^[A-Za-z0-9._-]{2,}@[A-Za-z][A-Za-z0-9]{1,}$")


def _clean(v: str | None) -> str | None:
    return v.strip() if isinstance(v, str) else v


def _check_phone(v: str | None) -> str | None:
    if v is not None and not _PHONE.match(v.strip()):
        raise ValueError("Phone number must be exactly 10 digits")
    return _clean(v)


class SendOTPRequest(BaseModel):
    email: str = Field(max_length=254)


class VerifyOTPRequest(BaseModel):
    email: str = Field(max_length=254)
    otp: str = Field(max_length=10)


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone_number: str
    email: str = Field(max_length=254)
    # Sign-in is by emailed one-time code, so a password is optional.
    password: str | None = Field(default=None, max_length=128)
    address: str = Field(min_length=1, max_length=300)
    location: str = Field(min_length=1, max_length=120)
    latitude: float | None = None
    longitude: float | None = None
    # farmer | buyer | machine_owner | storage_owner
    roles: list[str] = Field(default=[], max_length=4)

    @field_validator("phone_number")
    @classmethod
    def _phone(cls, v):
        return _check_phone(v)

    @field_validator("email")
    @classmethod
    def _email(cls, v):
        v = v.strip()
        if not _EMAIL.match(v):
            raise ValueError("Enter a valid email address")
        return v

    @field_validator("name", "address", "location")
    @classmethod
    def _strip(cls, v):
        v = _clean(v)
        if not v:
            raise ValueError("This field cannot be blank")
        return v


class UserUpdate(BaseModel):
    """Editable profile fields. Email is not editable (it is the sign-in identity)."""
    name: str | None = Field(default=None, max_length=100)
    phone_number: str | None = None
    address: str | None = Field(default=None, max_length=300)
    location: str | None = Field(default=None, max_length=120)
    latitude: float | None = None
    longitude: float | None = None
    upi_id: str | None = Field(default=None, max_length=60)  # "" clears it

    @field_validator("phone_number")
    @classmethod
    def _phone(cls, v):
        return _check_phone(v)

    @field_validator("upi_id")
    @classmethod
    def _upi(cls, v):
        v = _clean(v)
        if v and not _UPI.match(v):
            raise ValueError("Enter a valid UPI id like name@bank")
        return v


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
    upi_id: str | None = None
    is_admin: bool = False
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
