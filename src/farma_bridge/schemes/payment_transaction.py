from datetime import datetime
from pydantic import BaseModel, Field


class PaymentTransactionCreate(BaseModel):
    amount: float = Field(gt=0)
    plan_type: str
    period_start: datetime
    period_end: datetime
    payment_gateway_ref: str | None = None


class PaymentStatusUpdate(BaseModel):
    payment_status: str
    payment_gateway_ref: str | None = None


class PaymentTransactionResponse(BaseModel):
    transaction_id: int
    user_id: int
    amount: float
    plan_type: str
    period_start: datetime
    period_end: datetime
    payment_status: str
    payment_gateway_ref: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True
