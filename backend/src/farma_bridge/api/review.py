from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from config.database import get_db
from config.security import CurrentUser
from schemas.review import ReviewCreate, ReviewResponse, ReviewUpdate
from service.review_service import ReviewService

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("", response_model=list[ReviewResponse])
def browse_reviews(
    db: Session = Depends(get_db),
    reviewed_user_id: int | None = Query(None),
    reviewer_id: int | None = Query(None),
    context_type: str | None = Query(None),
    context_id: int | None = Query(None),
):
    return ReviewService(db).browse(
        reviewed_user_id=reviewed_user_id,
        reviewer_id=reviewer_id,
        context_type=context_type,
        context_id=context_id,
    )


@router.get("/{review_id}", response_model=ReviewResponse)
def get_review(review_id: int, db: Session = Depends(get_db)):
    return ReviewService(db).get(review_id)


@router.post("", response_model=ReviewResponse, status_code=201)
def create_review(payload: ReviewCreate, current: CurrentUser, db: Session = Depends(get_db)):
    return ReviewService(db).create(current.id, payload)


@router.patch("/{review_id}", response_model=ReviewResponse)
def update_review(review_id: int, payload: ReviewUpdate, current: CurrentUser, db: Session = Depends(get_db)):
    """Change your own review's rating/comment within 7 days of posting it."""
    return ReviewService(db).update(review_id, current.id, payload)


@router.delete("/{review_id}", status_code=204)
def delete_review(review_id: int, current: CurrentUser, db: Session = Depends(get_db)):
    ReviewService(db).delete(review_id, current.id)
