from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from config.database import Base


class Farmer(Base):
    """
    One row per crop listing (a farmer can post many listings over time,
    hence NOT a 1:1 profile table — user_id is a plain FK, not unique).
    """
    __tablename__ = "farmer_listings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    # Listing photos
    post_cultivation_photo: Mapped[str] = mapped_column(String(255), nullable=False)  # mandatory per spec
    pre_cultivation_photo: Mapped[str | None] = mapped_column(String(255), nullable=True)  # optional trust nudge

    # Crop information
    crop_name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    quantity_remaining: Mapped[float] = mapped_column(Float, nullable=False)  # auto-derived, drives Partially Sold
    unit: Mapped[str] = mapped_column(String(50), nullable=False)  # kg / quintal / ton
    price_per_kg: Mapped[int] = mapped_column(Integer, nullable=False)
    quality_grade: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reference_price: Mapped[int | None] = mapped_column(Integer, nullable=True)  # mandi price snapshot at posting

    # Listing status
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="Available")  # Available / Partially Sold / Sold

    # Location — farm/plot GPS, separate from the user's home address
    location: Mapped[str] = mapped_column(String(100), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    posted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # 3-5 days perishable / 30 days grains

    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    contact_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # was wrongly String before

    user: Mapped["User"] = relationship(back_populates="farmer_listings")