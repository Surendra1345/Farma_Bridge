from sqlalchemy.orm import Session
from model.user_report import UserReport


class UserReportRepository:
    def __init__(self, db: Session):
        self.db = db

    def browse(
        self,
        reporter_id: int | None = None,
        reported_user_id: int | None = None,
        status: str | None = None,
    ) -> list[UserReport]:
        q = self.db.query(UserReport)
        if reporter_id is not None:
            q = q.filter(UserReport.reporter_id == reporter_id)
        if reported_user_id is not None:
            q = q.filter(UserReport.reported_user_id == reported_user_id)
        if status:
            q = q.filter(UserReport.status == status)
        return q.order_by(UserReport.created_at.desc()).all()

    def get_by_id(self, report_id: int) -> UserReport | None:
        return self.db.query(UserReport).filter(UserReport.report_id == report_id).first()

    def create(self, report: UserReport) -> UserReport:
        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)
        return report

    def save(self, report: UserReport) -> UserReport:
        self.db.commit()
        self.db.refresh(report)
        return report
