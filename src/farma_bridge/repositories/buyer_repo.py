from sqlalchemy.orm import Session
from model.buyer import Buyer


class BuyerRepository:
    def __init__(self, db: Session):
        self.db = db

    def browse(self, crop_type: str | None = None, status: str | None = "Open") -> list[Buyer]:
        q = self.db.query(Buyer)
        if crop_type:
            q = q.filter(Buyer.crop_type.ilike(f"%{crop_type}%"))
        if status:
            q = q.filter(Buyer.status == status)
        return q.order_by(Buyer.posted_at.desc()).all()

    def get_by_id(self, requirement_id: int) -> Buyer | None:
        return self.db.query(Buyer).filter(Buyer.id == requirement_id).first()

    def create(self, requirement: Buyer) -> Buyer:
        self.db.add(requirement)
        self.db.commit()
        self.db.refresh(requirement)
        return requirement

    def save(self, requirement: Buyer) -> Buyer:
        self.db.commit()
        self.db.refresh(requirement)
        return requirement

    def delete(self, requirement: Buyer) -> None:
        self.db.delete(requirement)
        self.db.commit()