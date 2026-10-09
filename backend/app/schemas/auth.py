from typing import Literal, Optional
from pydantic import BaseModel


ClaimedRole = Literal["supervisor", "store_incharge", "auditor"]


class LoginRequest(BaseModel):
    claimed_role: Optional[ClaimedRole] = None


class DemoLoginRequest(BaseModel):
    role: ClaimedRole


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    is_active: bool = True

    model_config = {"from_attributes": True}


class DemoLoginResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    token: str


class PasswordLoginRequest(BaseModel):
    email: str
    password: str
    claimed_role: Optional[ClaimedRole] = None


class PasswordLoginResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    is_active: bool = True
    token: str


class UserCreateRequest(BaseModel):
    full_name: str
    email: str
    role: ClaimedRole
    password: Optional[str] = None


class UserUpdateRequest(BaseModel):
    role: Optional[ClaimedRole] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

