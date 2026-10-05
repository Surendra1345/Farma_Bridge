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
    availability_indicator: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    verified_badge: bool | None = False


class StorageListingUpdate(BaseModel):
    storage_photo: str | None = None
    storage_type: str | None = None
    total_capacity: float | None = None
    pricing_unit: str | None = None
    price: int | None = None
    temperature_range: str | None = None
    years_in_operation: int | None = None
    additional_services: str | None = None
    location: str | None = None
    availability_indicator: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    verified_badge: bool | None = None


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