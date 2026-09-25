from sqlalchemy.orm import Session
from model.machine_listing import MachineListing


class MachineListingRepository:
    def __init__(self, db: Session):
        self.db = db

    def browse(
        self,
        machine_type: str | None = None,
        status: str | None = None,
        max_price: int | None = None,
    ) -> list[MachineListing]:
        q = self.db.query(MachineListing)
        if machine_type:
            q = q.filter(MachineListing.machine_type == machine_type)
        if status:
            q = q.filter(MachineListing.status == status)
        if max_price is not None:
            q = q.filter(MachineListing.price_per_unit <= max_price)
        return q.all()

    def get_by_id(self, listing_id: int) -> MachineListing | None:
        return self.db.query(MachineListing).filter(MachineListing.listing_id == listing_id).first()

    def create(self, listing: MachineListing) -> MachineListing:
        self.db.add(listing)
        self.db.commit()
        self.db.refresh(listing)
        return listing

    def save(self, listing: MachineListing) -> MachineListing:
        self.db.commit()
        self.db.refresh(listing)
        return listing

    def delete(self, listing: MachineListing) -> None:
        self.db.delete(listing)
        self.db.commit()