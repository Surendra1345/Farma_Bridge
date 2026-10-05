from datetime import datetime
from pydantic import BaseModel, Field


class BookingCreate(BaseModel):
    booking_type: str  # machine / storage
    reference_id: int
    start_date: datetime
    end_date: datetime
    total_price: float = Field(gt=0)


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

    class Config:
        from_attributes = True
