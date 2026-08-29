from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from repositories.machine_listing_repo import MachineListingRepository
from service.user_role_service import UserRoleService
from service.upload import UploadService
from model.machine_listing import MachineListing
from schemes.machine_listing import MachineListingCreate

VALID_STATUSES = {"Available", "Booked"}


class MachineListingService:
    def __init__(self, db: Session):
        self.repo = MachineListingRepository(db)
        self.role_service = UserRoleService(db)
        self.upload_service = UploadService()

    def browse(self, **filters) -> list[MachineListing]:
        return self.repo.browse(**filters)

    def get(self, listing_id: int) -> MachineListing:
        listing = self.repo.get_by_id(listing_id)
        if not listing:
            raise HTTPException(404, "Listing not found")
        return listing

    async def create_with_photo(
        self,
        owner_id: int,
        machine_type: str,
        pricing_unit: str,
        price_per_unit: int,
        location: str,
        machine_photo: UploadFile,
        years_experience: int | None = None,
        operator_included: bool | None = None,
        machine_condition: str | None = None,
        expected_duration: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> MachineListing:
        """
        Uploads the photo and creates the listing in one request — same
        pattern as crop listings. owner_id identifies who uploaded this.
        """
        self.role_service.require_active(owner_id, "machine_owner")

        photo_url = await self.upload_service.save_image(machine_photo)

        listing = MachineListing(
            owner_id=owner_id,
            machine_photos=photo_url,
            machine_type=machine_type,
            pricing_unit=pricing_unit,
            price_per_unit=price_per_unit,
            years_experience=years_experience,
            operator_included=operator_included,
            machine_condition=machine_condition,
            status="Available",
            expected_duration=expected_duration,
            location=location,
            latitude=latitude,
            longitude=longitude,
            verified_badge=False,
        )
        return self.repo.create(listing)

    def update(self, listing_id: int, owner_id: int, payload: MachineListingCreate) -> MachineListing:
        listing = self._get_owned(listing_id, owner_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(listing, field, value)
        return self.repo.save(listing)

    async def update_with_photo(
        self,
        listing_id: int,
        owner_id: int,
        payload: MachineListingCreate,
        machine_photo: UploadFile | None = None,
    ) -> MachineListing:
        listing = self._get_owned(listing_id, owner_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(listing, field, value)
        if machine_photo:
            listing.machine_photos = await self.upload_service.save_image(machine_photo)
        return self.repo.save(listing)

    def update_status(self, listing_id: int, owner_id: int, status: str) -> MachineListing:
        """Available <-> Booked flip (spec §2.3) — kept separate from the general
        update so the frontend doesn't have to resend the full listing payload."""
        if status not in VALID_STATUSES:
            raise HTTPException(400, "status must be 'Available' or 'Booked'")
        listing = self._get_owned(listing_id, owner_id)
        listing.status = status
        return self.repo.save(listing)

    def delete(self, listing_id: int, owner_id: int) -> None:
        listing = self._get_owned(listing_id, owner_id)
        self.repo.delete(listing)

    def _get_owned(self, listing_id: int, owner_id: int) -> MachineListing:
        listing = self.repo.get_by_id(listing_id)
        if not listing:
            raise HTTPException(404, "Listing not found")
        if listing.owner_id != owner_id:
            raise HTTPException(403, "You can only modify your own listings")
        return listing