from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from config.database import get_db
from config.security import CurrentUser
from schemas.activity import BookingView
from schemas.booking import BookingCreate, BookingStatusUpdate
from service.activity_view import booking_view
from service.booking_service import BookingService

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get("", response_model=list[BookingView])
def my_bookings(
    current: CurrentUser,
    db: Session = Depends(get_db),
    booking_type: str | None = Query(None),
    status: str | None = Query(None),
):
    """Bookings the signed-in user requested or is providing."""
    svc = BookingService(db)
    mine = {b.booking_id: b for b in svc.browse(requester_id=current.id, booking_type=booking_type, status=status)}
    mine.update({b.booking_id: b for b in svc.browse(provider_id=current.id, booking_type=booking_type, status=status)})
    return [booking_view(db, b) for b in sorted(mine.values(), key=lambda b: b.created_at, reverse=True)]


@router.get("/{booking_id}", response_model=BookingView)
def get_booking(booking_id: int, current: CurrentUser, db: Session = Depends(get_db)):
    booking = BookingService(db).get(booking_id)
    if current.id not in (booking.requester_id, booking.provider_id):
        raise HTTPException(403, "You are not part of this booking")
    return booking_view(db, booking)


@router.post("", response_model=BookingView, status_code=201)
def create_booking(payload: BookingCreate, current: CurrentUser, db: Session = Depends(get_db)):
    return booking_view(db, BookingService(db).create(current.id, payload))


@router.patch("/{booking_id}/status", response_model=BookingView)
def update_booking_status(booking_id: int, payload: BookingStatusUpdate, current: CurrentUser, db: Session = Depends(get_db)):
    return booking_view(db, BookingService(db).update_status(booking_id, current.id, payload.status))
