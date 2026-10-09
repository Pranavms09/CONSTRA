from typing import Literal
from pydantic import BaseModel, EmailStr


ClaimedRole = Literal["supervisor", "store_incharge", "auditor"]


class LoginRequest(BaseModel):
    claimed_role: ClaimedRole


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str

    model_config = {"from_attributes": True}


class UserCreateRequest(BaseModel):
    full_name: str
    email: str
    role: ClaimedRole
