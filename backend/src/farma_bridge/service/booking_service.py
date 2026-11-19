import math
from datetime import datetime, timedelta
from fastapi import HTTPException
from sqlalchemy.orm import Session

from model.booking import Booking
from repositories.booking_repo import BookingRepository
from repositories.machine_listing_repo import MachineListingRepository
from repositories.storage_listing_repo import StorageListingRepository
from schemas.booking import BookingCreate
from service.notify import notify_user
from service.payment_tracking import PaymentAction, apply_payment_action
from service.user_role_service import UserRoleService

MAX_BOOKING_DAYS = 90
MAX_ADVANCE_DAYS = 365
VALID_BOOKING_TYPES = {"machine", "storage"}
VALID_BOOKING_STATUSES = {"Pending", "Confirmed", "Completed", "Cancelled"}
VALID_TRANSITIONS = {
    "Pending": {"Confirmed", "Cancelled"},
    "Confirmed": {"Completed", "Cancelled"},
    "Completed": set(),
    "Cancelled": set(),
}


class BookingService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = BookingRepository(db)
        self.machine_repo = MachineListingRepository(db)
        self.storage_repo = StorageListingRepository(db)
        self.role_service = UserRoleService(db)

    def browse(self, **filters) -> list[Booking]:
        return self.repo.browse(**filters)

    def get(self, booking_id: int) -> Booking:
        booking = self.repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(404, "Booking not found")
        return booking

    def create(self, requester_id: int, payload: BookingCreate) -> Booking:
        if payload.booking_type not in VALID_BOOKING_TYPES:
            raise HTTPException(400, f"booking_type must be one of {sorted(VALID_BOOKING_TYPES)}")
        if payload.end_date <= payload.start_date:
            raise HTTPException(400, "end_date must be after start_date")

        if payload.start_date < datetime.utcnow() - timedelta(minutes=5):
            raise HTTPException(400, "start_date cannot be in the past")
        if payload.start_date > datetime.utcnow() + timedelta(days=MAX_ADVANCE_DAYS):
            raise HTTPException(400, f"You can only book up to {MAX_ADVANCE_DAYS} days ahead")
        if payload.end_date - payload.start_date > timedelta(days=MAX_BOOKING_DAYS):
            raise HTTPException(400, f"A booking can be at most {MAX_BOOKING_DAYS} days long")

        provider_id = self._resolve_provider(payload.booking_type, payload.reference_id, requester_id)

        self._ensure_free(payload.booking_type, payload.reference_id, payload.start_date, payload.end_date)

        # The same person can't hold two overlapping requests for the same listing.
        duplicate = self.db.query(Booking).filter(
            Booking.requester_id == requester_id,
            Booking.booking_type == payload.booking_type,
            Booking.reference_id == payload.reference_id,
            Booking.status.in_(("Pending", "Confirmed")),
            Booking.start_date < payload.end_date,
            Booking.end_date > payload.start_date,
        ).first()
        if duplicate:
            raise HTTPException(400, "You already have a booking for this listing that overlaps these dates. Cancel it first or pick different dates")

        booking = Booking(
            booking_type=payload.booking_type,
            reference_id=payload.reference_id,
            requester_id=requester_id,
            provider_id=provider_id,
            start_date=payload.start_date,
            end_date=payload.end_date,
            total_price=self._price(payload),
            status="Pending",
            created_at=datetime.utcnow(),
        )
        booking = self.repo.create(booking)
        notify_user(self.db, provider_id, "New booking request", f"You have a new {payload.booking_type} booking request ({booking.start_date:%d %b %H:%M} to {booking.end_date:%d %b %H:%M}).")
        return booking

    def set_payment(self, booking_id: int, user_id: int, payload: PaymentAction) -> Booking:
        booking = self.get(booking_id)
        apply_payment_action(booking, booking.requester_id, booking.provider_id, user_id, booking.status, payload)
        booking = self.repo.save(booking)
        other = booking.provider_id if user_id == booking.requester_id else booking.requester_id
        notify_user(self.db, other, "Payment update", f"Booking #{booking.booking_id} payment is now: {booking.payment_status}.")
        return booking

    def update_status(self, booking_id: int, user_id: int, status: str) -> Booking:
        if status not in VALID_BOOKING_STATUSES:
            raise HTTPException(400, f"status must be one of {sorted(VALID_BOOKING_STATUSES)}")

        booking = self.get(booking_id)
        if user_id not in (booking.requester_id, booking.provider_id):
            raise HTTPException(403, "Only the requester or provider can update this booking")

        if status == "Confirmed" and user_id != booking.provider_id:
            raise HTTPException(403, "Only the provider can confirm a booking")
        if status not in VALID_TRANSITIONS[booking.status]:
            raise HTTPException(
                400,
                f"Cannot change a booking from '{booking.status}' to '{status}'",
            )

        if status == "Completed" and booking.start_date > datetime.utcnow():
            raise HTTPException(400, "A booking can only be completed once it has started")

        if status == "Confirmed":
            # Re-check at confirmation: another request may have been confirmed meanwhile.
            self._ensure_free(booking.booking_type, booking.reference_id, booking.start_date, booking.end_date, exclude_id=booking.booking_id)

        # Availability (Available/Booked) is the owner's manual switch; date clashes are caught by _ensure_free.

        booking.status = status
        booking.updated_at = datetime.utcnow()
        booking = self.repo.save(booking)
        other = booking.requester_id if user_id == booking.provider_id else booking.provider_id
        notify_user(self.db, other, f"Booking {status.lower()}", f"Booking #{booking.booking_id} is now {status}.")
        return booking

    def _ensure_free(self, booking_type: str, reference_id: int, start, end, exclude_id: int | None = None) -> None:
        """Reject a booking whose dates overlap an already Confirmed booking of the same listing."""
        q = self.db.query(Booking).filter(
            Booking.booking_type == booking_type,
            Booking.reference_id == reference_id,
            Booking.status == "Confirmed",
            Booking.start_date < end,
            Booking.end_date > start,
        )
        if exclude_id is not None:
            q = q.filter(Booking.booking_id != exclude_id)
        if q.first():
            raise HTTPException(400, "These dates overlap an existing confirmed booking")

    def _price(self, payload: BookingCreate) -> float:
        """Compute the price from the listing so clients can't set their own.

        Time-based units (hour/day/week/month) are derived from the dates.
        Other units (e.g. "Per Acre") can't be derived from dates, so the
        client-supplied total is kept for those.
        """
        if payload.booking_type == "machine":
            listing = self.machine_repo.get_by_id(payload.reference_id)
            unit_price = listing.price_per_unit
        else:
            listing = self.storage_repo.get_by_id(payload.reference_id)
            unit_price = listing.price
        unit = listing.pricing_unit.lower()
        seconds = (payload.end_date - payload.start_date).total_seconds()
        days = seconds / 86400
        for key, units in (("hour", seconds / 3600), ("day", days), ("week", days / 7), ("month", days / 30)):
            if key in unit:
                return float(unit_price * max(1, math.ceil(units)))
        # Non-time units (e.g. "Per Acre"): price = rate x the quantity the requester asked for.
        if not payload.quantity:
            raise HTTPException(400, f"Enter the quantity ({listing.pricing_unit.lower().replace('per ', '')}s) to book")
        return float(unit_price * payload.quantity)

    def _resolve_provider(self, booking_type: str, reference_id: int, requester_id: int) -> int:
        if booking_type == "machine":
            listing = self.machine_repo.get_by_id(reference_id)
            if not listing:
                raise HTTPException(404, "Machine listing not found")
            if listing.status == "Booked":
                raise HTTPException(400, "This machine is already booked")
            if listing.owner_id == requester_id:
                raise HTTPException(400, "You cannot book your own listing")
            return listing.owner_id

        listing = self.storage_repo.get_by_id(reference_id)
        if not listing:
            raise HTTPException(404, "Storage listing not found")
        if listing.availability_indicator == "Full":
            raise HTTPException(400, "This storage facility is unavailable")
        if listing.owner_id == requester_id:
            raise HTTPException(400, "You cannot book your own listing")
        return listing.owner_id
