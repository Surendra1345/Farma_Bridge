from sqlalchemy.orm import Session
from model.user_roles import UserRole


class UserRoleRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_for_user(self, user_id: int) -> list[UserRole]:
        return self.db.query(UserRole).filter(UserRole.user_id == user_id).all()

    def get_active(self, user_id: int, role_type: str) -> UserRole | None:
        return (
            self.db.query(UserRole)
            .filter(
                UserRole.user_id == user_id,
                UserRole.role_type == role_type,
                UserRole.deactivated_at.is_(None),
            )
            .first()
        )

    def get_any(self, user_id: int, role_type: str) -> UserRole | None:
        return (
            self.db.query(UserRole)
            .filter(UserRole.user_id == user_id, UserRole.role_type == role_type)
            .first()
        )

    def create(self, role: UserRole) -> UserRole:
        self.db.add(role)
        self.db.commit()
        self.db.refresh(role)
        return role

    def save(self, role: UserRole) -> UserRole:
        self.db.commit()
        self.db.refresh(role)
        return role