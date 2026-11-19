"""Order/booking responses enriched for the "My orders" screens."""
from pydantic import BaseModel

from schemas.booking import BookingResponse
from schemas.order import OrderResponse


class Party(BaseModel):
    """A person in a deal. Phone is shared with both sides while the deal is Pending/Confirmed/Completed."""
    id: int
    name: str
    location: str
    phone_number: str | None = None
    trust_score: float | None = None  # average review rating, if any


class OrderView(OrderResponse):
    listing_title: str | None = None
    listing_photo: str | None = None
    unit: str | None = None
    price_per_unit: float | None = None
    buyer: Party | None = None
    farmer: Party | None = None


class BookingView(BookingResponse):
    listing_title: str | None = None
    listing_photo: str | None = None
    pricing_unit: str | None = None
    requester: Party | None = None
    provider: Party | None = None
