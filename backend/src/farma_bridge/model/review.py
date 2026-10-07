from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from config.database import Base


class Review(Base):
    __tablename__ = "reviews"

    review_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    reviewer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    reviewed_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    context_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # order / booking
    context_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    reviewer: Mapped["User"] = relationship(back_populates="reviews_given", foreign_keys=[reviewer_id])
    reviewed_user: Mapped["User"] = relationship(back_populates="reviews_received", foreign_keys=[reviewed_user_id])

    @property
    def reviewer_name(self) -> str | None:
        return self.reviewer.name if self.reviewer else None

    @property
    def reviewed_user_name(self) -> str | None:
        return self.reviewed_user.name if self.reviewed_user else None
