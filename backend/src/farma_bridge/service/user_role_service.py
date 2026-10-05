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

    def deactivate_role(self, user_id: int, role_type: str) -> UserRole:
        role = self.repo.get_active(user_id, role_type)
        if not role:
            raise HTTPException(404, "Active role not found for this user")
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