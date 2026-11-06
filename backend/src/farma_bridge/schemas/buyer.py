from datetime import date, datetime
from pydantic import BaseModel


class BuyerCreate(BaseModel):
    crop_type: str
    quantity_needed: float
    unit: str
    quality_grade: str | None = None
    budget_min: int | None = None
    budget_max: int | None = None
    delivery_location: str          # mandatory per spec
    delivery_latitude: float | None = None
    delivery_longitude: float | None = None
    deadline: date                  # mandatory per spec
    status: str | None = "Open"


class BuyerResponse(BaseModel):
    id: int
    user_id: int
    crop_type: str
    quantity_needed: float
    unit: str
    quality_grade: str | None = None
    budget_min: int | None = None
    budget_max: int | None = None
    delivery_location: str
    delivery_latitude: float | None = None
    delivery_longitude: float | None = None
    deadline: date
    status: str | None = "Open"
    posted_at: datetime | None = None

    class Config:
        from_attributes = True