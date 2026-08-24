from sqlalchemy import Boolean, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from config.database import Base


class MachineListing(Base):
    __tablename__ = "machine_listings"

    listing_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    machine_photos: Mapped[str | None] = mapped_column(String(255), nullable=True)  # mandatory at API layer via schema
    machine_type: Mapped[str] = mapped_column(String(100), nullable=False)
    pricing_unit: Mapped[str] = mapped_column(String(50), nullable=False)  # Per Acre / Per Hour
    price_per_unit: Mapped[int] = mapped_column(Integer, nullable=False)
    years_experience: Mapped[int | None] = mapped_column(Integer, nullable=True)
    operator_included: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    machine_condition: Mapped[str | None] = mapped_column(String(100), nullable=True)

    status: Mapped[str] = mapped_column(String(50), nullable=False, default="Available")  # Available / Booked
    expected_duration: Mapped[str | None] = mapped_column(String(50), nullable=True)  # rough estimate only

    location: Mapped[str] = mapped_column(String(100), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    verified_badge: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # NOTE: raw `contact` field intentionally removed. Spec §4 requires call
    # masking / proxy numbers — contact is resolved dynamically at the API
    # layer from owner.phone_number through the masking service, never
    # stored redundantly per listing or accepted as client input.

    owner: Mapped["User"] = relationship(back_populates="machine_listings")