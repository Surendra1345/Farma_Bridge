from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from sqlalchemy.orm import Session

from config.database import get_db
from config.security import CurrentUser, OptionalUser
from service.contact import attach_owner_contact
from service.machine_listing_service import MachineListingService
from schemas.machine_listing import MachineListingCreate, MachineListingResponse

router = APIRouter(prefix="/machine-listings", tags=["machine_listings"])

@router.get("", response_model=list[MachineListingResponse])
def browse_machine_listings(
    db: Session = Depends(get_db),
    machine_type: str | None = Query(None),
    status: str | None = Query(None),
    max_price: int | None = Query(None),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    viewer: OptionalUser = None,
):
    listings = MachineListingService(db).browse(machine_type=machine_type, status=status, max_price=max_price, limit=limit, offset=offset)
    return attach_owner_contact(db, listings, "owner_id", viewer)


@router.get("/{listing_id}", response_model=MachineListingResponse)
def get_machine_listing(listing_id: int, viewer: OptionalUser = None, db: Session = Depends(get_db)):
    return attach_owner_contact(db, [MachineListingService(db).get(listing_id)], "owner_id", viewer)[0]


@router.post("", response_model=MachineListingResponse, status_code=201)
async def create_machine_listing(
    current: CurrentUser,
    machine_type: str = Form(..., min_length=2, max_length=100),
    pricing_unit: str = Form(..., pattern="^(Per Hour|Per Acre)$"),
    price_per_unit: int = Form(..., gt=0, le=10_000_000),
    location: str = Form(..., min_length=2, max_length=120),
    years_experience: int | None = Form(None),
    operator_included: bool | None = Form(None),
    machine_condition: str | None = Form(None),
    expected_duration: str | None = Form(None),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    machine_photo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """One request: photo + listing fields together — no separate /uploads/image call needed."""
    return await MachineListingService(db).create_with_photo(
        owner_id=current.id,
        machine_type=machine_type,
        pricing_unit=pricing_unit,
        price_per_unit=price_per_unit,
        location=location,
        machine_photo=machine_photo,
        years_experience=years_experience,
        operator_included=operator_included,
        machine_condition=machine_condition,
        expected_duration=expected_duration,
        latitude=latitude,
        longitude=longitude,
    )


@router.put("/{listing_id}", response_model=MachineListingResponse)
async def update_machine_listing(
    listing_id: int,
    current: CurrentUser,
    machine_type: str = Form(..., min_length=2, max_length=100),
    pricing_unit: str = Form(..., pattern="^(Per Hour|Per Acre)$"),
    price_per_unit: int = Form(..., gt=0, le=10_000_000),
    location: str = Form(..., min_length=2, max_length=120),
    years_experience: int | None = Form(None),
    operator_included: bool | None = Form(None),
    machine_condition: str | None = Form(None),
    expected_duration: str | None = Form(None),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    status: str = Form(...),
    machine_photo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    payload = MachineListingCreate(
        machine_type=machine_type, pricing_unit=pricing_unit, price_per_unit=price_per_unit,
        years_experience=years_experience, operator_included=operator_included,
        machine_condition=machine_condition, expected_duration=expected_duration,
        location=location, latitude=latitude, longitude=longitude, status=status,
    )
    return await MachineListingService(db).update_with_photo(
        listing_id, current.id, payload, machine_photo
    )


@router.patch("/{listing_id}/status", response_model=MachineListingResponse)
def update_status(listing_id: int, current: CurrentUser, status: str, db: Session = Depends(get_db)):
    return MachineListingService(db).update_status(listing_id, current.id, status)


@router.delete("/{listing_id}", status_code=204)
def delete_machine_listing(listing_id: int, current: CurrentUser, db: Session = Depends(get_db)):
    MachineListingService(db).delete(listing_id, current.id)