import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.auth.deps import require_role
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.auth import UserCreateRequest, UserUpdateRequest, UserResponse

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
            role=u.role,
            is_active=u.is_active
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
    Creates an active user without firebase_uid (bound on first login).
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
        auth_provider="firebase"
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
        role=new_user.role,
        is_active=new_user.is_active
    )


@router.patch("/{user_id}", response_model=UserResponse)
def update_user_role(
    user_id: int,
    body: UserUpdateRequest,
    current_user: User = Depends(require_role("auditor")),
    db: Session = Depends(get_db)
):
    """
    Update a user's role or status. Only Project Auditor can modify roles.
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    old_role = target_user.role
    if body.role:
        target_user.role = body.role
    if body.full_name:
        target_user.full_name = body.full_name.strip()
    if body.is_active is not None:
        target_user.is_active = body.is_active

    db.commit()
    db.refresh(target_user)

    audit_log = AuditLog(
        actor_id=current_user.id,
        action="user_updated",
        entity="user",
        entity_id=str(target_user.id),
        detail=json.dumps({
            "email": target_user.email,
            "old_role": old_role,
            "new_role": target_user.role,
            "is_active": target_user.is_active
        })
    )
    db.add(audit_log)
    db.commit()

    return UserResponse(
        id=target_user.id,
        full_name=target_user.full_name,
        email=target_user.email,
        role=target_user.role,
        is_active=target_user.is_active
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    current_user: User = Depends(require_role("auditor")),
    db: Session = Depends(get_db)
):
    """
    Remove a user from the allowlist. Auditor-only.
    """
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own auditor account."
        )

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    user_email = target_user.email
    db.delete(target_user)
    db.commit()

    audit_log = AuditLog(
        actor_id=current_user.id,
        action="user_deleted",
        entity="user",
        entity_id=str(user_id),
        detail=json.dumps({"email": user_email})
    )
    db.add(audit_log)
    db.commit()
