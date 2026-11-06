"""Build OrderView / BookingView objects (listing details + the people involved)."""
from sqlalchemy.orm import Session

from model.booking import Booking
from model.farmer import Farmer
from model.machine_listing import MachineListing
from model.order import Order
from model.storage_listing import StorageListing
from model.user import User
from schemas.activity import BookingView, OrderView, Party
from schemas.booking import BookingResponse
from schemas.order import OrderResponse

SHARE_PHONE_STATUSES = {"Confirmed", "Completed"}


def _party(db: Session, user_id: int, share_phone: bool) -> Party | None:
    user = db.get(User, user_id)
    if not user:
        return None
    return Party(id=user.id, name=user.name, location=user.location, phone_number=user.phone_number if share_phone else None)


def order_view(db: Session, order: Order) -> OrderView:
    # Start from the plain columns: the ORM's buyer/farmer relationships would clash with the Party fields.
    view = OrderView(**OrderResponse.model_validate(order).model_dump())
    listing = db.get(Farmer, order.listing_id)
    if listing:
        view.listing_title, view.listing_photo = listing.crop_name, listing.post_cultivation_photo
        view.unit, view.price_per_unit = listing.unit, listing.price_per_kg
    share = order.status in SHARE_PHONE_STATUSES
    view.buyer, view.farmer = _party(db, order.buyer_id, share), _party(db, order.farmer_id, share)
    return view


def booking_view(db: Session, booking: Booking) -> BookingView:
    view = BookingView(**BookingResponse.model_validate(booking).model_dump())
    if booking.booking_type == "machine":
        listing = db.get(MachineListing, booking.reference_id)
        if listing:
            view.listing_title, view.listing_photo = listing.machine_type, listing.machine_photos
    else:
        listing = db.get(StorageListing, booking.reference_id)
        if listing:
            view.listing_title, view.listing_photo = listing.storage_type, listing.storage_photo
    if listing:
        view.pricing_unit = listing.pricing_unit
    share = booking.status in SHARE_PHONE_STATUSES
    view.requester, view.provider = _party(db, booking.requester_id, share), _party(db, booking.provider_id, share)
    return view
