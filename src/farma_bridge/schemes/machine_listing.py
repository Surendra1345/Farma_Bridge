from pydantic import BaseModel


class MachineListingCreate(BaseModel):
    machine_photos: str | None = None
    machine_type: str
    pricing_unit: str  # Per Acre / Per Hour
    price_per_unit: int
    years_experience: int | None = None
    operator_included: bool | None = None
    machine_condition: str | None = None
    status: str | None = "Available"
    expected_duration: str | None = None
    location: str
    latitude: float | None = None
    longitude: float | None = None
    # NOTE: no `contact` field — resolved via call masking from owner.phone_number


class MachineListingResponse(BaseModel):
    listing_id: int
    owner_id: int
    machine_photos: str | None = None
    machine_type: str
    pricing_unit: str
    price_per_unit: int
    years_experience: int | None = None
    operator_included: bool | None = None
    machine_condition: str | None = None
    status: str | None = "Available"
    expected_duration: str | None = None
    location: str
    latitude: float | None = None
    longitude: float | None = None
    verified_badge: bool = False

    class Config:
        from_attributes = True