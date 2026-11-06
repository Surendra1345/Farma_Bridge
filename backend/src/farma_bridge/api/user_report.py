from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from config.database import get_db
from config.security import CurrentUser, admin_emails, require_admin
from model.user import User
from schemas.user_report import UserReportCreate, UserReportResolve, UserReportResponse
from service.user_report_service import UserReportService

router = APIRouter(prefix="/user-reports", tags=["user_reports"])


def _is_admin(user: User) -> bool:
    return user.email.lower() in admin_emails()


@router.get("", response_model=list[UserReportResponse])
def browse_user_reports(
    current: CurrentUser,
    db: Session = Depends(get_db),
    reported_user_id: int | None = Query(None),
    status: str | None = Query(None),
):
    """Admins see every report; everyone else sees only the reports they filed."""
    return UserReportService(db).browse(
        reporter_id=None if _is_admin(current) else current.id,
        reported_user_id=reported_user_id,
        status=status,
    )


@router.get("/{report_id}", response_model=UserReportResponse)
def get_user_report(report_id: int, current: CurrentUser, db: Session = Depends(get_db)):
    report = UserReportService(db).get(report_id)
    if report.reporter_id != current.id and not _is_admin(current):
        raise HTTPException(403, "You can only view your own reports")
    return report


@router.post("", response_model=UserReportResponse, status_code=201)
def create_user_report(payload: UserReportCreate, current: CurrentUser, db: Session = Depends(get_db)):
    return UserReportService(db).create(current.id, payload)


@router.patch("/{report_id}/resolve", response_model=UserReportResponse)
def resolve_user_report(report_id: int, payload: UserReportResolve, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return UserReportService(db).resolve(report_id, admin.id, payload)
