from sqlalchemy.orm import Session
from model.storage_listing import StorageListing


class StorageListingRepository:
    def __init__(self, db: Session):
        self.db = db

    def browse(
        self,
        storage_type: str | None = None,
        availability_indicator: str | None = None,
        max_price: int | None = None,
    ) -> list[StorageListing]:
        q = self.db.query(StorageListing)
        if storage_type:
            q = q.filter(StorageListing.storage_type == storage_type)
        if availability_indicator:
            q = q.filter(StorageListing.availability_indicator == availability_indicator)
        if max_price is not None:
            q = q.filter(StorageListing.price <= max_price)
        return q.all()

    def get_by_id(self, listing_id: int) -> StorageListing | None:
        return self.db.query(StorageListing).filter(StorageListing.listing_id == listing_id).first()

    def create(self, listing: StorageListing) -> StorageListing:
        self.db.add(listing)
        self.db.commit()
        self.db.refresh(listing)
        return listing

    def save(self, listing: StorageListing) -> StorageListing:
        self.db.commit()
        self.db.refresh(listing)
        return listing

    def delete(self, listing: StorageListing) -> None:
        self.db.delete(listing)
        self.db.commit()