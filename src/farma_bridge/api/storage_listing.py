from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from sqlalchemy.orm import Session

from config.database import get_db
from service.storage_listing_service import StorageListingService
from schemes.storage_listing import StorageListingCreate, StorageListingResponse

router = APIRouter(prefix="/storage-listings", tags=["storage_listings"])


@router.get("", response_model=list[StorageListingResponse])
def browse_storage_listings(
    db: Session = Depends(get_db),
    storage_type: str | None = Query(None),
    availability_indicator: str | None = Query(None),
    max_price: int | None = Query(None),
):
    return StorageListingService(db).browse(
        storage_type=storage_type, availability_indicator=availability_indicator, max_price=max_price
    )


@router.get("/{listing_id}", response_model=StorageListingResponse)
def get_storage_listing(listing_id: int, db: Session = Depends(get_db)):
    return StorageListingService(db).get(listing_id)


@router.post("", response_model=StorageListingResponse, status_code=201)
async def create_storage_listing(
    owner_id: int = Form(...),
    storage_type: str = Form(...),
    total_capacity: float = Form(...),
    pricing_unit: str = Form(...),
    price: int = Form(...),
    location: str = Form(...),
    temperature_range: str | None = Form(None),
    years_in_operation: int | None = Form(None),
    additional_services: str | None = Form(None),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    storage_photo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """One request: photo + listing fields together — no separate /uploads/image call needed."""
    return await StorageListingService(db).create_with_photo(
        owner_id=owner_id,
        storage_type=storage_type,
        total_capacity=total_capacity,
        pricing_unit=pricing_unit,
        price=price,
        location=location,
        storage_photo=storage_photo,
        temperature_range=temperature_range,
        years_in_operation=years_in_operation,
        additional_services=additional_services,
        latitude=latitude,
        longitude=longitude,
    )


@router.put("/{listing_id}", response_model=StorageListingResponse)
async def update_storage_listing(
    listing_id: int,
    owner_id: int = Form(...),
    storage_type: str = Form(...),
    total_capacity: float = Form(...),
    pricing_unit: str = Form(...),
    price: int = Form(...),
    location: str = Form(...),
    temperature_range: str | None = Form(None),
    years_in_operation: int | None = Form(None),
    additional_services: str | None = Form(None),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    verified_badge: bool = Form(False),
    storage_photo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    payload = StorageListingCreate(
        storage_type=storage_type, total_capacity=total_capacity, pricing_unit=pricing_unit,
        price=price, location=location, temperature_range=temperature_range,
        years_in_operation=years_in_operation, additional_services=additional_services,
        latitude=latitude, longitude=longitude, verified_badge=verified_badge,
    )
    return await StorageListingService(db).update_with_photo(
        listing_id, owner_id, payload, storage_photo
    )


@router.patch("/{listing_id}/availability", response_model=StorageListingResponse)
def update_availability(listing_id: int, owner_id: int, availability_indicator: str, db: Session = Depends(get_db)):
    return StorageListingService(db).update_availability(listing_id, owner_id, availability_indicator)


@router.delete("/{listing_id}", status_code=204)
def delete_storage_listing(listing_id: int, owner_id: int, db: Session = Depends(get_db)):
    StorageListingService(db).delete(listing_id, owner_id)

