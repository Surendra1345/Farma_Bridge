from datetime import datetime
from pydantic import BaseModel


class FarmerCreate(BaseModel):
    post_cultivation_photo: str        # mandatory
    pre_cultivation_photo: str | None = None  # optional trust nudge
    crop_name: str
    category: str
    quantity: float
    unit: str
    price_per_kg: int
    quality_grade: str | None = None
    location: str
    latitude: float | None = None
    longitude: float | None = None
    posted_at: datetime | None = None
    status: str | None = "Available"
    expires_at: datetime | None = None
    # NOTE: no `contact` field here — contact number is resolved from the
    # owning user's phone_number through call masking, not submitted by client.


class FarmerResponse(BaseModel):
    id: int
    user_id: int
    post_cultivation_photo: str
    pre_cultivation_photo: str | None = None
    crop_name: str
    category: str
    quantity: float
    quantity_remaining: float
    unit: str
    price_per_kg: int
    quality_grade: str | None = None
    location: str
    latitude: float | None = None
    longitude: float | None = None
    contact_count: int
    view_count: int
    posted_at: datetime | None = None
    status: str | None = "Available"
    expires_at: datetime | None = None

    class Config:
        from_attributes = True