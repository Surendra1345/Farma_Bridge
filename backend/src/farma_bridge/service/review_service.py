from datetime import datetime, timedelta
from fastapi import HTTPException
from sqlalchemy.orm import Session

from model.booking import Booking
from model.order import Order
from model.review import Review
from repositories.review_repo import ReviewRepository
from repositories.user_repo import UserRepository
from schemas.review import ReviewCreate, ReviewUpdate

EDIT_WINDOW = timedelta(days=7)


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

        self._check_context(reviewer_id, payload)

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

    def _own_editable(self, review_id: int, user_id: int) -> Review:
        review = self.get(review_id)
        if review.reviewer_id != user_id:
            raise HTTPException(403, "You can only change your own reviews")
        if datetime.utcnow() - review.created_at > EDIT_WINDOW:
            raise HTTPException(400, "Reviews can only be changed within 7 days")
        return review

    def update(self, review_id: int, user_id: int, payload: ReviewUpdate) -> Review:
        review = self._own_editable(review_id, user_id)
        if payload.rating is not None:
            review.rating = payload.rating
        if "comment" in payload.model_fields_set:
            review.comment = payload.comment
        review = self.repo.save(review)
        self._update_trust_score(review.reviewed_user_id)
        return review

    def delete(self, review_id: int, user_id: int) -> None:
        review = self._own_editable(review_id, user_id)
        reviewed = review.reviewed_user_id
        self.repo.delete(review)
        self._update_trust_score(reviewed)

    def _check_context(self, reviewer_id: int, payload: ReviewCreate) -> None:
        """A review must follow a Completed order/booking between exactly these two people, once."""
        if payload.context_type not in ("order", "booking") or payload.context_id is None:
            raise HTTPException(400, "Reviews must reference a completed order or booking (context_type 'order'/'booking' and context_id)")
        if payload.context_type == "order":
            ctx = self.db.get(Order, payload.context_id)
            parties = {ctx.buyer_id, ctx.farmer_id} if ctx else set()
        else:
            ctx = self.db.get(Booking, payload.context_id)
            parties = {ctx.requester_id, ctx.provider_id} if ctx else set()
        if not ctx:
            raise HTTPException(404, f"{payload.context_type.capitalize()} not found")
        if ctx.status != "Completed":
            raise HTTPException(400, f"You can only review after the {payload.context_type} is completed")
        if parties != {reviewer_id, payload.reviewed_user_id}:
            raise HTTPException(403, f"You can only review the other party of your own {payload.context_type}")
        if self.repo.browse(reviewer_id=reviewer_id, context_type=payload.context_type, context_id=payload.context_id):
            raise HTTPException(400, "You have already reviewed this " + payload.context_type)

    def _update_trust_score(self, user_id: int) -> None:
        avg = self.repo.average_rating(user_id)
        user = self.user_repo.get_by_id(user_id)
        if user:
            user.trust_score = round(avg, 2) if avg is not None else None
            self.user_repo.update(user)
