from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from config.database import Base


class UserRole(Base):
    """
    Tracks which roles a user currently holds. A user can hold any
    combination of: farmer, buyer, machine_owner, storage_owner.
    Roles are additive and editable anytime (spec Section 1) — this table
    is what makes "I selected Farmer at registration" mean something even
    before that user has posted a single listing.
    """
    __tablename__ = "user_roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    role_type: Mapped[str] = mapped_column(String(20), nullable=False)  # farmer | buyer | machine_owner | storage_owner
    activated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # soft-remove, keeps history

    user: Mapped["User"] = relationship(back_populates="roles")

    __table_args__ = (
        UniqueConstraint("user_id", "role_type", name="uq_user_role"),
    )