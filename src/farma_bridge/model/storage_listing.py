from sqlalchemy import Boolean, ForeignKey, Float, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from config.database import Base


class StorageListing(Base):
    __tablename__ = "storage_listings"

    listing_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    storage_photo: Mapped[str | None] = mapped_column(String(255), nullable=True)  # mandatory at API layer via schema
    storage_type: Mapped[str] = mapped_column(String(100), nullable=False)  # Cold Storage / Dry Storage / Both
    total_capacity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    pricing_unit: Mapped[str] = mapped_column(String(50), nullable=False)  # Per Day / Per Week / Per Month
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    temperature_range: Mapped[str | None] = mapped_column(String(50), nullable=True)
    years_in_operation: Mapped[int | None] = mapped_column(Integer, nullable=True)
    additional_services: Mapped[str | None] = mapped_column(String(255), nullable=True)

    availability_indicator: Mapped[str] = mapped_column(
        String(50), nullable=False, default="Plenty of Space"
    )  # Plenty of Space / Limited Space / Full

    location: Mapped[str] = mapped_column(String(100), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    verified_badge: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    owner: Mapped["User"] = relationship(back_populates="storage_listings")