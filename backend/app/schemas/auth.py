from typing import Literal
from pydantic import BaseModel


ClaimedRole = Literal["supervisor", "store_incharge", "auditor"]


class LoginRequest(BaseModel):
    claimed_role: ClaimedRole


class DemoLoginRequest(BaseModel):
    role: ClaimedRole


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str

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
