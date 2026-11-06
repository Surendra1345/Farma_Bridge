"""Order/booking responses enriched for the "My orders" screens."""
from pydantic import BaseModel

from schemas.booking import BookingResponse
from schemas.order import OrderResponse


class Party(BaseModel):
    """The other person in a deal. Phone is shared only once the deal is confirmed."""
    id: int
    name: str
    location: str
    phone_number: str | None = None


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
