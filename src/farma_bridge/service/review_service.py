from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session

from model.review import Review
from repositories.review_repo import ReviewRepository
from repositories.user_repo import UserRepository
from schemes.review import ReviewCreate


class ReviewService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ReviewRepository(db)
        self.user_repo = UserRepository(db)

    def browse(self, **filters) -> list[Review]:
        return self.repo.browse(**filters)

    def get(self, review_id: int) -> Review:
        review = self.repo.get_by_id(review_id)
        if not review:
            raise HTTPException(404, "Review not found")
        return review

    def create(self, reviewer_id: int, payload: ReviewCreate) -> Review:
        if reviewer_id == payload.reviewed_user_id:
            raise HTTPException(400, "You cannot review yourself")

        reviewed_user = self.user_repo.get_by_id(payload.reviewed_user_id)
        if not reviewed_user:
            raise HTTPException(404, "Reviewed user not found")

        review = Review(
            reviewer_id=reviewer_id,
            reviewed_user_id=payload.reviewed_user_id,
            rating=payload.rating,
            comment=payload.comment,
            context_type=payload.context_type,
            context_id=payload.context_id,
            created_at=datetime.utcnow(),
        )
        review = self.repo.create(review)
        self._update_trust_score(payload.reviewed_user_id)
        return review

    def _update_trust_score(self, user_id: int) -> None:
        avg = self.repo.average_rating(user_id)
        if avg is not None:
            user = self.user_repo.get_by_id(user_id)
            if user:
                user.trust_score = round(avg, 2)
                self.user_repo.update(user)
