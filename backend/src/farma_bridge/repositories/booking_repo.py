from sqlalchemy.orm import Session
from model.booking import Booking


class BookingRepository:
    def __init__(self, db: Session):
        self.db = db

    def browse(
        self,
        requester_id: int | None = None,
        provider_id: int | None = None,
        booking_type: str | None = None,
        status: str | None = None,
    ) -> list[Booking]:
        q = self.db.query(Booking)
        if requester_id is not None:
            q = q.filter(Booking.requester_id == requester_id)
        if provider_id is not None:
            q = q.filter(Booking.provider_id == provider_id)
        if booking_type:
            q = q.filter(Booking.booking_type == booking_type)
        if status:
            q = q.filter(Booking.status == status)
        return q.order_by(Booking.created_at.desc()).all()

    def get_by_id(self, booking_id: int) -> Booking | None:
        return self.db.query(Booking).filter(Booking.booking_id == booking_id).first()

    def create(self, booking: Booking) -> Booking:
        self.db.add(booking)
        self.db.commit()
        self.db.refresh(booking)
        return booking

    def save(self, booking: Booking) -> Booking:
        self.db.commit()
        self.db.refresh(booking)
        return booking
