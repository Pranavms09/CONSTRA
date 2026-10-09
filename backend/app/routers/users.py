import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.auth.deps import require_role
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.auth import UserCreateRequest, UserResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=List[UserResponse])
def list_users(
    current_user: User = Depends(require_role("auditor")),
    db: Session = Depends(get_db)
):
    """
    List all registered users. Auditor-only.
    """
    users = db.query(User).order_by(User.id.asc()).all()
    return [
        UserResponse(
            id=u.id,
            full_name=u.full_name,
            email=u.email,
            role=u.role
        )
        for u in users
    ]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreateRequest,
    current_user: User = Depends(require_role("auditor")),
    db: Session = Depends(get_db)
):
    """
    Register a new user into the allowlist. Auditor-only.
    Creates an active user without firebase_uid (bound on first Google login).
    """
    normalized_email = body.email.lower().strip()
    existing = db.query(User).filter(func.lower(User.email) == normalized_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists."
        )

    new_user = User(
        email=normalized_email,
        full_name=body.full_name.strip(),
        role=body.role,
        is_active=True,
        firebase_uid=None,
        auth_provider="google"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Audit log
    audit_log = AuditLog(
        actor_id=current_user.id,
        action="user_created",
        entity="user",
        entity_id=str(new_user.id),
        detail=json.dumps({
            "email": new_user.email,
            "role": new_user.role,
            "full_name": new_user.full_name
        })
    )
    db.add(audit_log)
    db.commit()

    return UserResponse(
        id=new_user.id,
        full_name=new_user.full_name,
        email=new_user.email,
        role=new_user.role
    )
