from sqlalchemy.orm import Session
from model.order import Order


class OrderRepository:
    def __init__(self, db: Session):
        self.db = db

    def browse(
        self,
        buyer_id: int | None = None,
        farmer_id: int | None = None,
        listing_id: int | None = None,
        status: str | None = None,
    ) -> list[Order]:
        q = self.db.query(Order)
        if buyer_id is not None:
            q = q.filter(Order.buyer_id == buyer_id)
        if farmer_id is not None:
            q = q.filter(Order.farmer_id == farmer_id)
        if listing_id is not None:
            q = q.filter(Order.listing_id == listing_id)
        if status:
            q = q.filter(Order.status == status)
        return q.order_by(Order.ordered_at.desc()).all()

    def get_by_id(self, order_id: int) -> Order | None:
        return self.db.query(Order).filter(Order.order_id == order_id).first()

    def create(self, order: Order) -> Order:
        self.db.add(order)
        self.db.commit()
        self.db.refresh(order)
        return order

    def save(self, order: Order) -> Order:
        self.db.commit()
        self.db.refresh(order)
        return order
