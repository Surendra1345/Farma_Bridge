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

    def _resolve_product_title(self, review: Review) -> str:
        try:
            if review.context_type == "order" and review.context_id:
                from repositories.order_repo import OrderRepository
                order = OrderRepository(self.db).get_by_id(review.context_id)
                if order and order.listing:
                    return f"{order.listing.crop_name} (Order #{order.order_id})"
                elif order:
                    return f"Harvest Order #{order.order_id}"
            elif review.context_type == "booking" and review.context_id:
                from repositories.booking_repo import BookingRepository
                booking = BookingRepository(self.db).get_by_id(review.context_id)
                if booking:
                    if booking.booking_type == "machine":
                        from repositories.machine_listing_repo import MachineListingRepository
                        m = MachineListingRepository(self.db).get_by_id(booking.reference_id)
                        return f"{m.machine_type if m else 'Machinery'} (Booking #{booking.booking_id})"
                    else:
                        from repositories.storage_listing_repo import StorageListingRepository
                        s = StorageListingRepository(self.db).get_by_id(booking.reference_id)
                        return f"{s.storage_type if s else 'Storage'} (Booking #{booking.booking_id})"
            elif review.context_type == "crop" and review.context_id:
                from repositories.farmer_repo import FarmerRepository
                c = FarmerRepository(self.db).get_by_id(review.context_id)
                if c:
                    return f"{c.crop_name} Harvest"
            elif review.context_type == "machine" and review.context_id:
                from repositories.machine_listing_repo import MachineListingRepository
                m = MachineListingRepository(self.db).get_by_id(review.context_id)
                if m:
                    return f"{m.machine_type} Equipment"
            elif review.context_type == "storage" and review.context_id:
                from repositories.storage_listing_repo import StorageListingRepository
                s = StorageListingRepository(self.db).get_by_id(review.context_id)
                if s:
                    return f"{s.storage_type} Facility"
        except Exception:
            pass
        return "Product / Service Delivery"

    def browse(self, **filters) -> list[Review]:
        reviews = self.repo.browse(**filters)
        for r in reviews:
            r.product_title = self._resolve_product_title(r)
        return reviews

    def get(self, review_id: int) -> Review:
        review = self.repo.get_by_id(review_id)
        if not review:
            raise HTTPException(404, "Review not found")
        review.product_title = self._resolve_product_title(review)
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
        review.product_title = self._resolve_product_title(review)
        return review

    def _update_trust_score(self, user_id: int) -> None:
        avg = self.repo.average_rating(user_id)
        if avg is not None:
            user = self.user_repo.get_by_id(user_id)
            if user:
                user.trust_score = round(avg, 2)
                self.user_repo.update(user)
