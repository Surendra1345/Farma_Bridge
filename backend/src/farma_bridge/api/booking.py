from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from config.database import get_db
from schemes.booking import BookingCreate, BookingResponse, BookingStatusUpdate
from service.booking_service import BookingService

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get("", response_model=list[BookingResponse])
def browse_bookings(
    db: Session = Depends(get_db),
    requester_id: int | None = Query(None),
    provider_id: int | None = Query(None),
    booking_type: str | None = Query(None),
    status: str | None = Query(None),
):
    return BookingService(db).browse(
        requester_id=requester_id,
        provider_id=provider_id,
        booking_type=booking_type,
        status=status,
    )


@router.get("/{booking_id}", response_model=BookingResponse)
def get_booking(booking_id: int, db: Session = Depends(get_db)):
    return BookingService(db).get(booking_id)


@router.post("", response_model=BookingResponse, status_code=201)
def create_booking(requester_id: int, payload: BookingCreate, db: Session = Depends(get_db)):
    return BookingService(db).create(requester_id, payload)


@router.patch("/{booking_id}/status", response_model=BookingResponse)
def update_booking_status(
    booking_id: int, user_id: int, payload: BookingStatusUpdate, db: Session = Depends(get_db)
):
    return BookingService(db).update_status(booking_id, user_id, payload.status)
