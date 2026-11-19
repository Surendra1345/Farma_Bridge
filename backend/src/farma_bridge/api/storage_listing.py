from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from sqlalchemy.orm import Session

from config.database import get_db
from config.security import CurrentUser, OptionalUser
from service.contact import attach_owner_contact
from service.storage_listing_service import StorageListingService
from schemas.storage_listing import StorageListingCreate, StorageListingResponse

router = APIRouter(prefix="/storage-listings", tags=["storage_listings"])


@router.get("", response_model=list[StorageListingResponse])
def browse_storage_listings(
    db: Session = Depends(get_db),
    storage_type: str | None = Query(None),
    availability_indicator: str | None = Query(None),
    max_price: int | None = Query(None),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    viewer: OptionalUser = None,
):
    listings = StorageListingService(db).browse(
        storage_type=storage_type, availability_indicator=availability_indicator, max_price=max_price,
        limit=limit, offset=offset,
    )
    return attach_owner_contact(db, listings, "owner_id", viewer)


@router.get("/{listing_id}", response_model=StorageListingResponse)
def get_storage_listing(listing_id: int, viewer: OptionalUser = None, db: Session = Depends(get_db)):
    return attach_owner_contact(db, [StorageListingService(db).get(listing_id)], "owner_id", viewer)[0]


@router.post("", response_model=StorageListingResponse, status_code=201)
async def create_storage_listing(
    current: CurrentUser,
    storage_type: str = Form(..., min_length=2, max_length=100),
    total_capacity: float = Form(..., gt=0, le=100_000_000),
    pricing_unit: str = Form(..., pattern="^(Per Day|Per Week|Per Month)$"),
    price: int = Form(..., gt=0, le=100_000_000),
    location: str = Form(..., min_length=2, max_length=120),
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
        owner_id=current.id,
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
    current: CurrentUser,
    storage_type: str = Form(..., min_length=2, max_length=100),
    total_capacity: float = Form(..., gt=0, le=100_000_000),
    pricing_unit: str = Form(..., pattern="^(Per Day|Per Week|Per Month)$"),
    price: int = Form(..., gt=0, le=100_000_000),
    location: str = Form(..., min_length=2, max_length=120),
    temperature_range: str | None = Form(None),
    years_in_operation: int | None = Form(None),
    additional_services: str | None = Form(None),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    storage_photo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    payload = StorageListingCreate(
        storage_type=storage_type, total_capacity=total_capacity, pricing_unit=pricing_unit,
        price=price, location=location, temperature_range=temperature_range,
        years_in_operation=years_in_operation, additional_services=additional_services,
        latitude=latitude, longitude=longitude,
    )
    return await StorageListingService(db).update_with_photo(
        listing_id, current.id, payload, storage_photo
    )


@router.patch("/{listing_id}/availability", response_model=StorageListingResponse)
def update_availability(listing_id: int, current: CurrentUser, availability_indicator: str, db: Session = Depends(get_db)):
    return StorageListingService(db).update_availability(listing_id, current.id, availability_indicator)


@router.delete("/{listing_id}", status_code=204)
def delete_storage_listing(listing_id: int, current: CurrentUser, db: Session = Depends(get_db)):
    StorageListingService(db).delete(listing_id, current.id)

