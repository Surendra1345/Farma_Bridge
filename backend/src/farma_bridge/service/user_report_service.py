from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session

from model.user_report import UserReport
from repositories.user_report_repo import UserReportRepository
from repositories.user_repo import UserRepository
from schemes.user_report import UserReportCreate, UserReportResolve

VALID_REPORT_STATUSES = {"Open", "Under Review", "Resolved", "Dismissed"}


class UserReportService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = UserReportRepository(db)
        self.user_repo = UserRepository(db)

    def browse(self, **filters) -> list[UserReport]:
        return self.repo.browse(**filters)

    def get(self, report_id: int) -> UserReport:
        report = self.repo.get_by_id(report_id)
        if not report:
            raise HTTPException(404, "Report not found")
        return report

    def create(self, reporter_id: int, payload: UserReportCreate) -> UserReport:
        if reporter_id == payload.reported_user_id:
            raise HTTPException(400, "You cannot report yourself")

        reported_user = self.user_repo.get_by_id(payload.reported_user_id)
        if not reported_user:
            raise HTTPException(404, "Reported user not found")

        report = UserReport(
            reporter_id=reporter_id,
            reported_user_id=payload.reported_user_id,
            reason=payload.reason,
            description=payload.description,
            status="Open",
            created_at=datetime.utcnow(),
        )
        return self.repo.create(report)

    def resolve(self, report_id: int, resolver_id: int, payload: UserReportResolve) -> UserReport:
        if payload.status not in VALID_REPORT_STATUSES:
            raise HTTPException(400, f"status must be one of {sorted(VALID_REPORT_STATUSES)}")

        report = self.get(report_id)
        if report.status == "Resolved":
            raise HTTPException(400, "Report is already resolved")

        report.status = payload.status
        report.action_taken = payload.action_taken
        report.resolved_by = resolver_id
        report.resolved_at = datetime.utcnow()
        return self.repo.save(report)
