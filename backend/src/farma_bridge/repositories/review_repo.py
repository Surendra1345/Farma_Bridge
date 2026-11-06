from sqlalchemy.orm import Session
from model.review import Review


class ReviewRepository:
    def __init__(self, db: Session):
        self.db = db

    def browse(
        self,
        reviewed_user_id: int | None = None,
        reviewer_id: int | None = None,
        context_type: str | None = None,
        context_id: int | None = None,
    ) -> list[Review]:
        q = self.db.query(Review)
        if reviewed_user_id is not None:
            q = q.filter(Review.reviewed_user_id == reviewed_user_id)
        if reviewer_id is not None:
            q = q.filter(Review.reviewer_id == reviewer_id)
        if context_type is not None:
            q = q.filter(Review.context_type == context_type)
        if context_id is not None:
            q = q.filter(Review.context_id == context_id)
        return q.order_by(Review.created_at.desc()).all()

    def get_by_id(self, review_id: int) -> Review | None:
        return self.db.query(Review).filter(Review.review_id == review_id).first()

    def create(self, review: Review) -> Review:
        self.db.add(review)
        self.db.commit()
        self.db.refresh(review)
        return review

    def average_rating(self, user_id: int) -> float | None:
        from sqlalchemy import func

        result = (
            self.db.query(func.avg(Review.rating))
            .filter(Review.reviewed_user_id == user_id)
            .scalar()
        )
        return float(result) if result is not None else None
