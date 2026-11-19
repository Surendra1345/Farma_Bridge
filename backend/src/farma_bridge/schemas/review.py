from datetime import datetime
from pydantic import BaseModel, Field


class ReviewCreate(BaseModel):
    reviewed_user_id: int
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)
    context_type: str | None = None
    context_id: int | None = None


class ReviewUpdate(BaseModel):
    rating: int | None = Field(default=None, ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


class ReviewResponse(BaseModel):
    review_id: int
    reviewer_id: int
    reviewed_user_id: int
    rating: int
    comment: str | None = None
    context_type: str | None = None
    context_id: int | None = None
    created_at: datetime
    reviewer_name: str | None = None
    reviewed_user_name: str | None = None
    product_title: str | None = None

    class Config:
        from_attributes = True
