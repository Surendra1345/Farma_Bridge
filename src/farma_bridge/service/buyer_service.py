from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session

from repositories.buyer_repo import BuyerRepository
from service.user_role_service import UserRoleService
from model.buyer import Buyer
from schemes.buyer import BuyerCreate


class BuyerService:
    def __init__(self, db: Session):
        self.repo = BuyerRepository(db)
        self.role_service = UserRoleService(db)

    def browse(self, **filters) -> list[Buyer]:
        """No role check — farmers need to browse these to respond with offers."""
        return self.repo.browse(**filters)

    def get(self, requirement_id: int) -> Buyer:
        req = self.repo.get_by_id(requirement_id)
        if not req:
            raise HTTPException(404, "Requirement not found")
        return req

    def create(self, user_id: int, payload: BuyerCreate) -> Buyer:
        self.role_service.require_active(user_id, "buyer")
        req = Buyer(user_id=user_id, posted_at=datetime.utcnow(), **payload.model_dump())
        return self.repo.create(req)

    def update(self, requirement_id: int, user_id: int, payload: BuyerCreate) -> Buyer:
        req = self._get_owned(requirement_id, user_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(req, field, value)
        return self.repo.save(req)

    def delete(self, requirement_id: int, user_id: int) -> None:
        req = self._get_owned(requirement_id, user_id)
        self.repo.delete(req)

    def _get_owned(self, requirement_id: int, user_id: int) -> Buyer:
        req = self.repo.get_by_id(requirement_id)
        if not req:
            raise HTTPException(404, "Requirement not found")
        if req.user_id != user_id:
            raise HTTPException(403, "You can only modify your own requirements")
        return req