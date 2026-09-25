from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session

from model.booking import Booking
from repositories.booking_repo import BookingRepository
from repositories.machine_listing_repo import MachineListingRepository
from repositories.storage_listing_repo import StorageListingRepository
from schemes.booking import BookingCreate
from service.user_role_service import UserRoleService

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

        provider_id = self._resolve_provider(payload.booking_type, payload.reference_id, requester_id)

        booking = Booking(
            booking_type=payload.booking_type,
            reference_id=payload.reference_id,
            requester_id=requester_id,
            provider_id=provider_id,
            start_date=payload.start_date,
            end_date=payload.end_date,
            total_price=payload.total_price,
            status="Pending",
            created_at=datetime.utcnow(),
        )
        return self.repo.create(booking)

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

        if status == "Confirmed" and booking.booking_type == "machine":
            listing = self.machine_repo.get_by_id(booking.reference_id)
            if listing:
                listing.status = "Booked"
                self.machine_repo.save(listing)

        if status == "Cancelled" and booking.status == "Confirmed" and booking.booking_type == "machine":
            listing = self.machine_repo.get_by_id(booking.reference_id)
            if listing:
                listing.status = "Available"
                self.machine_repo.save(listing)

        booking.status = status
        booking.updated_at = datetime.utcnow()
        return self.repo.save(booking)

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
