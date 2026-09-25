from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session

from model.order import Order
from repositories.farmer_repo import FarmerRepository
from repositories.order_repo import OrderRepository
from repositories.user_repo import UserRepository
from schemes.order import OrderCreate
from service.user_role_service import UserRoleService

VALID_ORDER_STATUSES = {"Pending", "Confirmed", "Completed", "Cancelled"}
VALID_TRANSITIONS = {
    "Pending": {"Confirmed", "Cancelled"},
    "Confirmed": {"Completed", "Cancelled"},
    "Completed": set(),
    "Cancelled": set(),
}


class OrderService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = OrderRepository(db)
        self.farmer_repo = FarmerRepository(db)
        self.user_repo = UserRepository(db)
        self.role_service = UserRoleService(db)

    def browse(self, **filters) -> list[Order]:
        return self.repo.browse(**filters)

    def get(self, order_id: int) -> Order:
        order = self.repo.get_by_id(order_id)
        if not order:
            raise HTTPException(404, "Order not found")
        return order

    def create(self, buyer_id: int, payload: OrderCreate) -> Order:
        self.role_service.require_active(buyer_id, "buyer")

        listing = self.farmer_repo.get_by_id(payload.listing_id)
        if not listing:
            raise HTTPException(404, "Crop listing not found")
        if listing.status == "Sold":
            raise HTTPException(400, "This listing is already sold out")
        if payload.quantity_ordered > listing.quantity_remaining:
            raise HTTPException(400, "Requested quantity exceeds available stock")
        if buyer_id == listing.user_id:
            raise HTTPException(400, "You cannot order your own listing")

        total_price = payload.quantity_ordered * listing.price_per_kg
        order = Order(
            listing_id=payload.listing_id,
            buyer_id=buyer_id,
            farmer_id=listing.user_id,
            quantity_ordered=payload.quantity_ordered,
            total_price=total_price,
            status="Pending",
            ordered_at=datetime.utcnow(),
            created_at=datetime.utcnow(),
        )
        return self.repo.create(order)

    def update_status(self, order_id: int, user_id: int, status: str) -> Order:
        if status not in VALID_ORDER_STATUSES:
            raise HTTPException(400, f"status must be one of {sorted(VALID_ORDER_STATUSES)}")

        order = self.get(order_id)
        if user_id not in (order.buyer_id, order.farmer_id):
            raise HTTPException(403, "Only the buyer or farmer can update this order")

        if status == "Confirmed" and user_id != order.farmer_id:
            raise HTTPException(403, "Only the farmer can confirm an order")
        if status not in VALID_TRANSITIONS[order.status]:
            raise HTTPException(
                400,
                f"Cannot change an order from '{order.status}' to '{status}'",
            )

        if status == "Confirmed":
            listing = self.farmer_repo.get_by_id(order.listing_id)
            if not listing:
                raise HTTPException(404, "Crop listing not found")
            if order.quantity_ordered > listing.quantity_remaining:
                raise HTTPException(400, "Insufficient stock to confirm this order")

            listing.quantity_remaining -= order.quantity_ordered
            if listing.quantity_remaining <= 0:
                listing.status = "Sold"
                listing.quantity_remaining = 0
            elif listing.quantity_remaining < listing.quantity:
                listing.status = "Partially Sold"
            self.farmer_repo.save(listing)

        if status == "Cancelled" and order.status == "Confirmed":
            listing = self.farmer_repo.get_by_id(order.listing_id)
            if not listing:
                raise HTTPException(404, "Crop listing not found")
            listing.quantity_remaining = min(
                listing.quantity, listing.quantity_remaining + order.quantity_ordered
            )
            listing.status = (
                "Available"
                if listing.quantity_remaining == listing.quantity
                else "Partially Sold"
            )
            self.farmer_repo.save(listing)

        if status == "Completed":
            order.completed_at = datetime.utcnow()

        order.status = status
        order.updated_at = datetime.utcnow()
        return self.repo.save(order)
