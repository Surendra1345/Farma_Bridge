from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from config.database import get_db
from service.user_role_service import UserRoleService
from schemes.user_role import UserRoleCreate, UserRoleResponse, UserRoleUpdate

router = APIRouter(prefix="/users/{user_id}/roles", tags=["user_roles"])


@router.get("", response_model=list[UserRoleResponse])
def list_roles(user_id: int, db: Session = Depends(get_db)):
    return UserRoleService(db).list_roles(user_id)


@router.post("", response_model=UserRoleResponse, status_code=201)
def add_role(user_id: int, payload: UserRoleCreate, db: Session = Depends(get_db)):
    return UserRoleService(db).add_role(user_id, payload.role_type)


@router.delete("/{role_type}", status_code=204)
def deactivate_role(user_id: int, role_type: str, db: Session = Depends(get_db)):
    UserRoleService(db).deactivate_role(user_id, role_type)


@router.patch("/{role_type}", response_model=UserRoleResponse)
def update_role(
    user_id: int,
    role_type: str,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
):
    return UserRoleService(db).update_role(user_id, role_type, payload.active)