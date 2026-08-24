from datetime import datetime
from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from config.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    otp: Mapped[str | None] = mapped_column(String(6), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str] = mapped_column(String(100), nullable=False)  # human-readable address text
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)   # home GPS - needed for "nearby" queries
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    trust_score: Mapped[float | None] = mapped_column(Float, nullable=True)  # computed from thumbs up/down
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)  # False = suspended/banned
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    # A user can hold multiple roles, and can post many listings per role over time —
    # all one-to-many, not one-to-one.
    roles: Mapped[list["UserRole"]] = relationship(back_populates="user")
    farmer_listings: Mapped[list["Farmer"]] = relationship(back_populates="user")
    buyer_requirements: Mapped[list["Buyer"]] = relationship(back_populates="user")
    storage_listings: Mapped[list["StorageListing"]] = relationship(back_populates="owner")
    machine_listings: Mapped[list["MachineListing"]] = relationship(back_populates="owner")