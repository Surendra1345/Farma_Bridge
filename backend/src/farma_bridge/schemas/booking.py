from datetime import datetime, timezone
from pydantic import BaseModel, Field, field_validator


def to_naive_utc(value: datetime) -> datetime:
    """The database stores naive UTC. Accept 'Z' / '+05:30' dates from API clients by converting them."""
    return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value


class BookingCreate(BaseModel):
    booking_type: str  # machine / storage
    reference_id: int
    start_date: datetime
    end_date: datetime
    # Needed for non-time units such as "Per Acre" (how many acres). Ignored for hour/day/week/month.
    quantity: float | None = Field(default=None, gt=0)
    total_price: float | None = None  # ignored: the server always computes the price

    @field_validator("start_date", "end_date")
    @classmethod
    def _naive_utc(cls, v: datetime) -> datetime:
        return to_naive_utc(v)


class BookingStatusUpdate(BaseModel):
    status: str


class BookingResponse(BaseModel):
    booking_id: int
    booking_type: str
    reference_id: int
    requester_id: int
    provider_id: int
    start_date: datetime
    end_date: datetime
    total_price: float
    status: str
    created_at: datetime
    updated_at: datetime | None = None
    payment_status: str = "Unpaid"
    payment_method: str | None = None
    paid_at: datetime | None = None

    class Config:
        from_attributes = True
