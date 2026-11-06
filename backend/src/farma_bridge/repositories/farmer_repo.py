from sqlalchemy.orm import Session
from model.farmer import Farmer


class FarmerRepository:
    def __init__(self, db: Session):
        self.db = db

    def browse(self,crop_name: str | None = None,category: str | None = None,min_price: int | None = None,max_price: int | None = None,status: str | None = None,) -> list[Farmer]:
        q = self.db.query(Farmer)
        if crop_name:
            q = q.filter(Farmer.crop_name.ilike(f"%{crop_name}%"))
        if category:
            q = q.filter(Farmer.category == category)
        if min_price is not None:
            q = q.filter(Farmer.price_per_kg >= min_price)
        if max_price is not None:
            q = q.filter(Farmer.price_per_kg <= max_price)
        q = q.filter(Farmer.status == status) if status else q.filter(Farmer.status != "Sold")
        return q.order_by(Farmer.posted_at.desc()).all()

    def get_by_id(self, listing_id: int) -> Farmer | None:
        return self.db.query(Farmer).filter(Farmer.id == listing_id).first()

    def create(self, listing: Farmer) -> Farmer:
        self.db.add(listing)
        self.db.commit()
        self.db.refresh(listing)
        return listing

    def save(self, listing: Farmer) -> Farmer:
        self.db.commit()
        self.db.refresh(listing)
        return listing

    def delete(self, listing: Farmer) -> None:
        self.db.delete(listing)
        self.db.commit()