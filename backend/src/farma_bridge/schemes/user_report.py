from datetime import datetime
from pydantic import BaseModel


class UserReportCreate(BaseModel):
    reported_user_id: int
    reason: str
    description: str | None = None


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

    class Config:
        from_attributes = True
