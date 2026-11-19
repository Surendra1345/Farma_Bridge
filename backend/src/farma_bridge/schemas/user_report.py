from datetime import datetime
from pydantic import BaseModel, Field


class UserReportCreate(BaseModel):
    reported_user_id: int
    reason: str = Field(min_length=3, max_length=100)
    description: str | None = Field(default=None, max_length=1000)


class UserReportResolve(BaseModel):
    action_taken: str
    status: str = "Resolved"


class UserReportResponse(BaseModel):
    report_id: int
    reporter_id: int
    reported_user_id: int
    reason: str
    description: str | None = None
    status: str
    action_taken: str | None = None
    created_at: datetime
    resolved_at: datetime | None = None
    resolved_by: int | None = None
    reporter_name: str | None = None
    reported_user_name: str | None = None

    class Config:
        from_attributes = True
