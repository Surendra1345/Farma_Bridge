from datetime import datetime, timedelta
from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from repositories.farmer_repo import FarmerRepository
from service.user_role_service import UserRoleService
from service.upload import UploadService
from model.farmer import Farmer
VALID_STATUSES = {"Available", "Partially Sold", "Sold"}


class FarmerService:
    def __init__(self, db: Session):
        self.repo = FarmerRepository(db)
        self.role_service = UserRoleService(db)
        self.upload_service = UploadService()

    def browse(self, **filters) -> list[Farmer]:
        """No role check — browsing is open to every logged-in user."""
        return self.repo.browse(**filters)

    def get(self, listing_id: int, increment_view: bool = True) -> Farmer:
        listing = self.repo.get_by_id(listing_id)
        if not listing:
            raise HTTPException(404, "Listing not found")
        if increment_view:
            listing.view_count += 1
            listing = self.repo.save(listing)
        return listing

    async def create_with_photos(
        self,
        user_id: int,
        crop_name: str,
        category: str,
        quantity: float,
        unit: str,
        price_per_kg: int,
        location: str,
        post_cultivation_photo: UploadFile,
        quality_grade: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        pre_cultivation_photo: UploadFile | None = None,
    ) -> Farmer:
        """
        Uploads photo(s) and creates the listing in one atomic step — no
        window where a photo exists without a known owner. `user_id` on the
        row identifies who uploaded the listing.
        """
        self.role_service.require_active(user_id, "farmer")

        post_photo_url = await self.upload_service.save_image(post_cultivation_photo)
        pre_photo_url = (
            await self.upload_service.save_image(pre_cultivation_photo)
            if pre_cultivation_photo
            else None
        )

        expiry_days = 5 if category and category.lower() == "perishable" else 30
        listing = Farmer(
            user_id=user_id,
            post_cultivation_photo=post_photo_url,
            pre_cultivation_photo=pre_photo_url,
            crop_name=crop_name,
            category=category,
            quantity=quantity,
            quantity_remaining=quantity,
            unit=unit,
            price_per_kg=price_per_kg,
            quality_grade=quality_grade,
            location=location,
            latitude=latitude,
            longitude=longitude,
            posted_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=expiry_days),
            status="Available",
        )
        return self.repo.create(listing)

    async def update_with_photos(
        self,
        listing_id: int,
        user_id: int,
        payload: dict,
        post_cultivation_photo: UploadFile | None = None,
        pre_cultivation_photo: UploadFile | None = None,
    ) -> Farmer:
        listing = self._get_owned(listing_id, user_id)
        changes = payload.copy()
        if "status" in changes and changes["status"] not in VALID_STATUSES:
            raise HTTPException(400, f"status must be one of {sorted(VALID_STATUSES)}")
        if post_cultivation_photo:
            changes["post_cultivation_photo"] = await self.upload_service.save_image(post_cultivation_photo)
        if pre_cultivation_photo:
            changes["pre_cultivation_photo"] = await self.upload_service.save_image(pre_cultivation_photo)
        for field, value in changes.items():
            if value is not None:
                setattr(listing, field, value)
        return self.repo.save(listing)

    def update_availability(self, listing_id: int, user_id: int, status: str) -> Farmer:
        if status not in VALID_STATUSES:
            raise HTTPException(400, f"status must be one of {sorted(VALID_STATUSES)}")
        listing = self._get_owned(listing_id, user_id)
        listing.status = status
        return self.repo.save(listing)

    def delete(self, listing_id: int, user_id: int) -> None:
        listing = self._get_owned(listing_id, user_id)
        self.repo.delete(listing)

    def _get_owned(self, listing_id: int, user_id: int) -> Farmer:
        listing = self.repo.get_by_id(listing_id)
        if not listing:
            raise HTTPException(404, "Listing not found")
        if listing.user_id != user_id:
            raise HTTPException(403, "You can only modify your own listings")
        return listing