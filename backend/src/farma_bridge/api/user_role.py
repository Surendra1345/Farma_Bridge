from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from config.database import get_db
from config.security import get_current_user
from model.user import User
from service.user_role_service import UserRoleService
from schemas.user_role import UserRoleCreate, UserRoleResponse, UserRoleUpdate

# Roles always belong to the signed-in user.
router = APIRouter(prefix="/users/me/roles", tags=["user_roles"])


@router.get("", response_model=list[UserRoleResponse])
def list_roles(current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return UserRoleService(db).list_roles(current.id)


@router.post("", response_model=UserRoleResponse, status_code=201)
def add_role(payload: UserRoleCreate, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return UserRoleService(db).add_role(current.id, payload.role_type)


@router.delete("/{role_type}", status_code=204)
def deactivate_role(role_type: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    UserRoleService(db).deactivate_role(current.id, role_type)


@router.patch("/{role_type}", response_model=UserRoleResponse)
def update_role(role_type: str, payload: UserRoleUpdate, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return UserRoleService(db).update_role(current.id, role_type, payload.active)
