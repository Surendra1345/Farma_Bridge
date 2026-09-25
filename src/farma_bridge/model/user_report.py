from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from config.database import Base


class UserReport(Base):
    __tablename__ = "user_reports"

    report_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    reported_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    reason: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="Open")
    action_taken: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    reporter: Mapped["User"] = relationship(back_populates="reports_filed", foreign_keys=[reporter_id])
    reported_user: Mapped["User"] = relationship(back_populates="reports_received", foreign_keys=[reported_user_id])
    resolver: Mapped["User | None"] = relationship(back_populates="reports_resolved", foreign_keys=[resolved_by])
