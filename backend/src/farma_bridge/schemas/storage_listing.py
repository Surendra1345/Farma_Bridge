from pydantic import BaseModel


class StorageListingCreate(BaseModel):
    storage_photo: str | None = None
    storage_type: str  # Cold Storage / Dry Storage / Both
    total_capacity: float
    pricing_unit: str  # Per Day / Per Week / Per Month
    price: int
    temperature_range: str | None = None
    years_in_operation: int | None = None
    additional_services: str | None = None
    location: str
    latitude: float | None = None
    longitude: float | None = None
    verified_badge: bool | None = False


class StorageListingResponse(BaseModel):
    listing_id: int
    owner_id: int
    storage_photo: str | None = None
    storage_type: str
    total_capacity: float
    pricing_unit: str
    price: int
    temperature_range: str | None = None
    years_in_operation: int | None = None
    additional_services: str | None = None
    availability_indicator: str = "Plenty of Space"
    location: str
    latitude: float | None = None
    longitude: float | None = None
    verified_badge: bool = False

    class Config:
        from_attributes = True