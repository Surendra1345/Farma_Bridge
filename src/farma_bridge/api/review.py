from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from config.database import get_db
from schemes.review import ReviewCreate, ReviewResponse
from service.review_service import ReviewService

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("", response_model=list[ReviewResponse])
def browse_reviews(
    db: Session = Depends(get_db),
    reviewed_user_id: int | None = Query(None),
    reviewer_id: int | None = Query(None),
):
    return ReviewService(db).browse(reviewed_user_id=reviewed_user_id, reviewer_id=reviewer_id)


@router.get("/{review_id}", response_model=ReviewResponse)
def get_review(review_id: int, db: Session = Depends(get_db)):
    return ReviewService(db).get(review_id)


@router.post("", response_model=ReviewResponse, status_code=201)
def create_review(reviewer_id: int, payload: ReviewCreate, db: Session = Depends(get_db)):
    return ReviewService(db).create(reviewer_id, payload)
