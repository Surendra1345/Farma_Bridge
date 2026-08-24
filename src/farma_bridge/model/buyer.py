from datetime import date, datetime
from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from config.database import Base


class Buyer(Base):
    """
    One row per Buyer Requirement post (a buyer can post many requirements
    over time — user_id is a plain FK, no uniqueness constraint).
    Renamed table to buyer_requirements: this isn't a buyer profile
    (buyers have no extra profile fields beyond the base User record) —
    it's the requirement posting itself.
    """
    __tablename__ = "buyer_requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    crop_type: Mapped[str] = mapped_column(String(100), nullable=False)
    quantity_needed: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    quality_grade: Mapped[str | None] = mapped_column(String(50), nullable=True)
    budget_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    budget_max: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Both mandatory per spec's Buyer Requirements table — were missing entirely before
    delivery_location: Mapped[str] = mapped_column(String(100), nullable=False)
    delivery_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    delivery_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    deadline: Mapped[date] = mapped_column(Date, nullable=False)

    status: Mapped[str] = mapped_column(String(50), nullable=False, default="Open")  # Open / Fulfilled / Expired
    posted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="buyer_requirements")