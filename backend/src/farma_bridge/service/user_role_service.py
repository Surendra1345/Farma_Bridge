from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session

from repositories.user_roles_repo import UserRoleRepository
from repositories.user_repo import UserRepository
from model.user_roles import UserRole

VALID_ROLES = {"farmer", "buyer", "machine_owner", "storage_owner"}


class UserRoleService:
    def __init__(self, db: Session):
        self.repo = UserRoleRepository(db)
        self.user_repo = UserRepository(db)

    def list_roles(self, user_id: int) -> list[UserRole]:
        return self.repo.list_for_user(user_id)

    def add_role(self, user_id: int, role_type: str) -> UserRole:
        if role_type not in VALID_ROLES:
            raise HTTPException(400, f"role_type must be one of {sorted(VALID_ROLES)}")
        if not self.user_repo.get_by_id(user_id):
            raise HTTPException(404, "User not found")

        existing = self.repo.get_any(user_id, role_type)
        if existing:
            if existing.deactivated_at is None:
                return existing
            existing.deactivated_at = None
            existing.activated_at = datetime.utcnow()
            return self.repo.save(existing)

        return self.repo.create(UserRole(user_id=user_id, role_type=role_type))

    def _blockers(self, user_id: int, role_type: str) -> list[str]:
        """Reasons this role can't be switched off yet (open deals or listings still live)."""
        from sqlalchemy import or_
        from model.booking import Booking
        from model.farmer import Farmer
        from model.machine_listing import MachineListing
        from model.order import Order
        from model.storage_listing import StorageListing

        db, open_ = self.repo.db, ("Pending", "Confirmed")
        reasons: list[str] = []
        if role_type == "farmer":
            if db.query(Order).filter(Order.farmer_id == user_id, Order.status.in_(open_)).count():
                reasons.append("you still have open orders on your crops")
            if db.query(Farmer).filter(Farmer.user_id == user_id, Farmer.status != "Sold").count():
                reasons.append("you still have crop listings on the marketplace (delete them or mark them Sold)")
        elif role_type == "buyer":
            if db.query(Order).filter(Order.buyer_id == user_id, Order.status.in_(open_)).count():
                reasons.append("you still have open orders")
            if db.query(Booking).filter(Booking.requester_id == user_id, Booking.status.in_(open_)).count():
                reasons.append("you still have open bookings")
        elif role_type == "machine_owner":
            if db.query(Booking).filter(Booking.provider_id == user_id, Booking.booking_type == "machine", Booking.status.in_(open_)).count():
                reasons.append("you still have open machinery bookings")
            if db.query(MachineListing).filter(MachineListing.owner_id == user_id, MachineListing.status != "Booked").count():
                reasons.append("you still have machinery listed (delete it or mark it Booked)")
        elif role_type == "storage_owner":
            if db.query(Booking).filter(Booking.provider_id == user_id, Booking.booking_type == "storage", Booking.status.in_(open_)).count():
                reasons.append("you still have open storage bookings")
            if db.query(StorageListing).filter(StorageListing.owner_id == user_id, StorageListing.availability_indicator != "Full").count():
                reasons.append("you still have storage listed (delete it or mark it Full)")
        return reasons

    def deactivate_role(self, user_id: int, role_type: str) -> UserRole:
        role = self.repo.get_active(user_id, role_type)
        if not role:
            raise HTTPException(404, "Active role not found for this user")
        blockers = self._blockers(user_id, role_type)
        if blockers:
            raise HTTPException(400, "Can't turn this off yet: " + "; ".join(blockers) + ".")
        role.deactivated_at = datetime.utcnow()  # soft-remove — keeps history + existing listings
        return self.repo.save(role)

    def update_role(self, user_id: int, role_type: str, active: bool) -> UserRole:
        if active:
            role = self.repo.get_any(user_id, role_type)
            if role and role.deactivated_at is None:
                return role
            return self.add_role(user_id, role_type)
        return self.deactivate_role(user_id, role_type)

    def require_active(self, user_id: int, role_type: str) -> None:
        """Used by other services to gate create/update/delete actions."""
        if not self.repo.get_active(user_id, role_type):
            raise HTTPException(403, f"User does not have an active '{role_type}' role")