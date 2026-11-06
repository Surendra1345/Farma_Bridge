from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from config.database import get_db
from config.security import CurrentUser
from schemas.activity import OrderView
from schemas.order import OrderCreate, OrderStatusUpdate
from service.activity_view import order_view
from service.order_service import OrderService

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("", response_model=list[OrderView])
def my_orders(
    current: CurrentUser,
    db: Session = Depends(get_db),
    listing_id: int | None = Query(None),
    status: str | None = Query(None),
):
    """Orders the signed-in user placed (as buyer) or received (as farmer)."""
    svc = OrderService(db)
    mine = {o.order_id: o for o in svc.browse(buyer_id=current.id, listing_id=listing_id, status=status)}
    mine.update({o.order_id: o for o in svc.browse(farmer_id=current.id, listing_id=listing_id, status=status)})
    return [order_view(db, o) for o in sorted(mine.values(), key=lambda o: o.ordered_at, reverse=True)]


@router.get("/{order_id}", response_model=OrderView)
def get_order(order_id: int, current: CurrentUser, db: Session = Depends(get_db)):
    order = OrderService(db).get(order_id)
    if current.id not in (order.buyer_id, order.farmer_id):
        raise HTTPException(403, "You are not part of this order")
    return order_view(db, order)


@router.post("", response_model=OrderView, status_code=201)
def create_order(payload: OrderCreate, current: CurrentUser, db: Session = Depends(get_db)):
    return order_view(db, OrderService(db).create(current.id, payload))


@router.patch("/{order_id}/status", response_model=OrderView)
def update_order_status(order_id: int, payload: OrderStatusUpdate, current: CurrentUser, db: Session = Depends(get_db)):
    return order_view(db, OrderService(db).update_status(order_id, current.id, payload.status))
