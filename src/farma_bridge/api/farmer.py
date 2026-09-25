from datetime import datetime
from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from config.database import get_db
from service.farmer_service import FarmerService
from schemes.farmer import FarmerResponse

router = APIRouter(prefix="/crop-listings", tags=["crop_listings"])


@router.get("", response_model=list[FarmerResponse])
def browse_crop_listings(
    db: Session = Depends(get_db),
    crop_name: str | None = Query(None),
    category: str | None = Query(None),
    min_price: int | None = Query(None),
    max_price: int | None = Query(None),
    status: str | None = Query(None),
):
    return FarmerService(db).browse(
        crop_name=crop_name, category=category, min_price=min_price, max_price=max_price, status=status
    )


@router.get("/{listing_id}", response_model=FarmerResponse)
def get_crop_listing(listing_id: int, db: Session = Depends(get_db)):
    return FarmerService(db).get(listing_id)


@router.post("", response_model=FarmerResponse, status_code=201)
async def create_crop_listing(
    user_id: int = Form(...),
    crop_name: str = Form(...),
    category: str = Form(...),
    quantity: float = Form(...),
    unit: str = Form(...),
    price_per_kg: int = Form(...),
    quality_grade: str | None = Form(None),
    location: str = Form(...),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    post_cultivation_photo: UploadFile = File(...),        # mandatory, per spec
    pre_cultivation_photo: UploadFile | None = File(None),  # optional trust nudge
    db: Session = Depends(get_db),
):
    """
    ONE request: photo(s) + listing fields together. This is what makes
    'who uploaded this photo' a non-question — the photo is saved and the
    listing row (with its owner) is created in the same call, so there's
    never a moment where an uploaded file exists without a known owner.
    """
    return await FarmerService(db).create_with_photos(
        user_id=user_id,
        crop_name=crop_name,
        category=category,
        quantity=quantity,
        unit=unit,
        price_per_kg=price_per_kg,
        quality_grade=quality_grade,
        location=location,
        latitude=latitude,
        longitude=longitude,
        post_cultivation_photo=post_cultivation_photo,
        pre_cultivation_photo=pre_cultivation_photo,
    )


@router.put("/{listing_id}", response_model=FarmerResponse)
async def update_crop_listing(
    listing_id: int,
    user_id: int = Form(...),
    crop_name: str = Form(...),
    category: str = Form(...),
    quantity: float = Form(...),
    unit: str = Form(...),
    price_per_kg: int = Form(...),
    location: str = Form(...),
    quality_grade: str | None = Form(None),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    status: str = Form(...),
    expires_at: datetime | None = Form(None),
    post_cultivation_photo: UploadFile | None = File(None),
    pre_cultivation_photo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    payload = {
        "crop_name": crop_name,
        "category": category,
        "quantity": quantity,
        "unit": unit,
        "price_per_kg": price_per_kg,
        "location": location,
        "quality_grade": quality_grade,
        "latitude": latitude,
        "longitude": longitude,
        "status": status,
        "expires_at": expires_at,
    }
    return await FarmerService(db).update_with_photos(
        listing_id, user_id, payload, post_cultivation_photo, pre_cultivation_photo
    )


@router.patch("/{listing_id}/availability", response_model=FarmerResponse)
def update_crop_availability(
    listing_id: int,
    user_id: int,
    status: str,
    db: Session = Depends(get_db),
):
    return FarmerService(db).update_availability(listing_id, user_id, status)


@router.delete("/{listing_id}", status_code=204)
def delete_crop_listing(listing_id: int, user_id: int, db: Session = Depends(get_db)):
    FarmerService(db).delete(listing_id, user_id)