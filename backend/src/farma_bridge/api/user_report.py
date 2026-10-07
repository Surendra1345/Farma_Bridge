from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from config.database import get_db
from schemes.user_report import UserReportCreate, UserReportResolve, UserReportResponse
from service.user_report_service import UserReportService

router = APIRouter(prefix="/user-reports", tags=["user_reports"])


@router.get("", response_model=list[UserReportResponse])
def browse_user_reports(
    db: Session = Depends(get_db),
    reporter_id: int | None = Query(None),
    reported_user_id: int | None = Query(None),
    status: str | None = Query(None),
):
    return UserReportService(db).browse(
        reporter_id=reporter_id, reported_user_id=reported_user_id, status=status
    )


@router.get("/{report_id}", response_model=UserReportResponse)
def get_user_report(report_id: int, db: Session = Depends(get_db)):
    return UserReportService(db).get(report_id)


@router.post("", response_model=UserReportResponse, status_code=201)
def create_user_report(reporter_id: int, payload: UserReportCreate, db: Session = Depends(get_db)):
    return UserReportService(db).create(reporter_id, payload)


@router.patch("/{report_id}/resolve", response_model=UserReportResponse)
def resolve_user_report(
    report_id: int, resolver_id: int, payload: UserReportResolve, db: Session = Depends(get_db)
):
    return UserReportService(db).resolve(report_id, resolver_id, payload)
