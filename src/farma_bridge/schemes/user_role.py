from datetime import datetime
from pydantic import BaseModel


class UserRoleCreate(BaseModel):
    role_type: str  # farmer | buyer | machine_owner | storage_owner


class UserRoleUpdate(BaseModel):
    active: bool


class UserRoleResponse(BaseModel):
    id: int
    user_id: int
    role_type: str
    activated_at: datetime | None = None
    deactivated_at: datetime | None = None

    class Config:
        from_attributes = True