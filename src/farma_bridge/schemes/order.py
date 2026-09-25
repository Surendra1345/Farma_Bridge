from datetime import datetime
from pydantic import BaseModel, Field


class OrderCreate(BaseModel):
    listing_id: int
    quantity_ordered: float = Field(gt=0)


class OrderStatusUpdate(BaseModel):
    status: str


class OrderResponse(BaseModel):
    order_id: int
    listing_id: int
    buyer_id: int
    farmer_id: int
    quantity_ordered: float
    total_price: float
    status: str
    ordered_at: datetime
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True
