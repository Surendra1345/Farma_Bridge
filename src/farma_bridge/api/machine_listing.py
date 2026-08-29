from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from sqlalchemy.orm import Session

from config.database import get_db
from service.machine_listing_service import MachineListingService
from schemes.machine_listing import MachineListingCreate, MachineListingResponse

router = APIRouter(prefix="/machine-listings", tags=["machine_listings"])

@router.get("", response_model=list[MachineListingResponse])
def browse_machine_listings(
    db: Session = Depends(get_db),
    machine_type: str | None = Query(None),
    status: str | None = Query(None),
    max_price: int | None = Query(None),
):
    return MachineListingService(db).browse(machine_type=machine_type, status=status, max_price=max_price)


@router.get("/{listing_id}", response_model=MachineListingResponse)
def get_machine_listing(listing_id: int, db: Session = Depends(get_db)):
    return MachineListingService(db).get(listing_id)


@router.post("", response_model=MachineListingResponse, status_code=201)
async def create_machine_listing(
    owner_id: int = Form(...),
    machine_type: str = Form(...),
    pricing_unit: str = Form(...),
    price_per_unit: int = Form(...),
    location: str = Form(...),
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
        owner_id=owner_id,
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
    owner_id: int = Form(...),
    machine_type: str = Form(...),
    pricing_unit: str = Form(...),
    price_per_unit: int = Form(...),
    location: str = Form(...),
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
        listing_id, owner_id, payload, machine_photo
    )


@router.patch("/{listing_id}/status", response_model=MachineListingResponse)
def update_status(listing_id: int, owner_id: int, status: str, db: Session = Depends(get_db)):
    return MachineListingService(db).update_status(listing_id, owner_id, status)


@router.delete("/{listing_id}", status_code=204)
def delete_machine_listing(listing_id: int, owner_id: int, db: Session = Depends(get_db)):
    MachineListingService(db).delete(listing_id, owner_id)