from typing import Literal, Optional
from pydantic import BaseModel


ClaimedRole = Literal["supervisor", "store_incharge", "auditor"]


class LoginRequest(BaseModel):
    claimed_role: Optional[ClaimedRole] = None
    is_signup: Optional[bool] = False
    full_name: Optional[str] = None


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


class UserCreateRequest(BaseModel):
    full_name: str
    email: str
    role: ClaimedRole


class UserUpdateRequest(BaseModel):
    role: Optional[ClaimedRole] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
