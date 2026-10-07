from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from config.database import get_db
from schemes.order import OrderCreate, OrderResponse, OrderStatusUpdate
from service.order_service import OrderService

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("", response_model=list[OrderResponse])
def browse_orders(
    db: Session = Depends(get_db),
    buyer_id: int | None = Query(None),
    farmer_id: int | None = Query(None),
    listing_id: int | None = Query(None),
    status: str | None = Query(None),
):
    return OrderService(db).browse(
        buyer_id=buyer_id, farmer_id=farmer_id, listing_id=listing_id, status=status
    )


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, db: Session = Depends(get_db)):
    return OrderService(db).get(order_id)


@router.post("", response_model=OrderResponse, status_code=201)
def create_order(buyer_id: int, payload: OrderCreate, db: Session = Depends(get_db)):
    return OrderService(db).create(buyer_id, payload)


@router.patch("/{order_id}/status", response_model=OrderResponse)
def update_order_status(
    order_id: int, user_id: int, payload: OrderStatusUpdate, db: Session = Depends(get_db)
):
    return OrderService(db).update_status(order_id, user_id, payload.status)
