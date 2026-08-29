from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from repositories.storage_listing_repo import StorageListingRepository
from service.user_role_service import UserRoleService
from service.upload import UploadService
from model.storage_listing import StorageListing
from schemes.storage_listing import StorageListingCreate

VALID_AVAILABILITY = {"Plenty of Space", "Limited Space", "Full"}


class StorageListingService:
    def __init__(self, db: Session):
        self.repo = StorageListingRepository(db)
        self.role_service = UserRoleService(db)
        self.upload_service = UploadService()

    def browse(self, **filters) -> list[StorageListing]:
        return self.repo.browse(**filters)

    def get(self, listing_id: int) -> StorageListing:
        listing = self.repo.get_by_id(listing_id)
        if not listing:
            raise HTTPException(404, "Listing not found")
        return listing

    async def create_with_photo(
        self,
        owner_id: int,
        storage_type: str,
        total_capacity: float,
        pricing_unit: str,
        price: int,
        location: str,
        storage_photo: UploadFile,
        temperature_range: str | None = None,
        years_in_operation: int | None = None,
        additional_services: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> StorageListing:
        """
        Uploads the facility photo and creates the listing in one request —
        same pattern as crop/machine listings. owner_id identifies who
        uploaded this listing.
        """
        self.role_service.require_active(owner_id, "storage_owner")

        photo_url = await self.upload_service.save_image(storage_photo)

        listing = StorageListing(
            owner_id=owner_id,
            storage_photo=photo_url,
            storage_type=storage_type,
            total_capacity=total_capacity,
            pricing_unit=pricing_unit,
            price=price,
            temperature_range=temperature_range,
            years_in_operation=years_in_operation,
            additional_services=additional_services,
            availability_indicator="Plenty of Space",
            location=location,
            latitude=latitude,
            longitude=longitude,
            verified_badge=False,
        )
        return self.repo.create(listing)

    def update(self, listing_id: int, owner_id: int, payload: StorageListingCreate) -> StorageListing:
        listing = self._get_owned(listing_id, owner_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(listing, field, value)
        return self.repo.save(listing)

    async def update_with_photo(
        self,
        listing_id: int,
        owner_id: int,
        payload: StorageListingCreate,
        storage_photo: UploadFile | None = None,
    ) -> StorageListing:
        listing = self._get_owned(listing_id, owner_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(listing, field, value)
        if storage_photo:
            listing.storage_photo = await self.upload_service.save_image(storage_photo)
        return self.repo.save(listing)

    def update_availability(self, listing_id: int, owner_id: int, availability_indicator: str) -> StorageListing:
        """Plenty of Space / Limited Space / Full (spec §2.4), updated manually as space fills/frees."""
        if availability_indicator not in VALID_AVAILABILITY:
            raise HTTPException(400, "Invalid availability_indicator")
        listing = self._get_owned(listing_id, owner_id)
        listing.availability_indicator = availability_indicator
        return self.repo.save(listing)

    def delete(self, listing_id: int, owner_id: int) -> None:
        listing = self._get_owned(listing_id, owner_id)
        self.repo.delete(listing)

    def _get_owned(self, listing_id: int, owner_id: int) -> StorageListing:
        listing = self.repo.get_by_id(listing_id)
        if not listing:
            raise HTTPException(404, "Listing not found")
        if listing.owner_id != owner_id:
            raise HTTPException(403, "You can only modify your own listings")
        return listing