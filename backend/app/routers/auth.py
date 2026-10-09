import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.auth import LoginRequest, UserResponse
from app.auth.firebase import verify_firebase_token
from app.auth.deps import get_current_user, parse_bearer_token
from app.limiter import limiter

router = APIRouter(prefix="/auth", tags=["auth"])


def record_audit(
    db: Session,
    action: str,
    actor_id: int | None = None,
    detail: dict | None = None,
    ip_address: str | None = None
):
    try:
        log_entry = AuditLog(
            actor_id=actor_id,
            action=action,
            entity="user",
            entity_id=str(actor_id) if actor_id else None,
            detail=json.dumps(detail) if detail else None,
            ip_address=ip_address,
        )
        db.add(log_entry)
        db.commit()
    except Exception:
        db.rollback()


@router.post("/login", response_model=UserResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    body: LoginRequest,
    authorization: str = Header(...),
    db: Session = Depends(get_db)
):
    ip_addr = request.client.host if request.client else None
    id_token = parse_bearer_token(authorization)
    decoded_token = verify_firebase_token(id_token)

    uid = decoded_token.get("uid")
    raw_email = decoded_token.get("email", "")
    email = raw_email.lower().strip()
    email_verified = decoded_token.get("email_verified", False)

    # 1. Reject if email_verified is false
    if not email_verified:
        record_audit(
            db,
            action="login_denied",
            detail={"email": email, "reason": "Email not verified"},
            ip_address=ip_addr
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email is not verified. Please verify your email with Google."
        )

    # 2. Lowercase email and load user from database
    user = db.query(User).filter(func.lower(User.email) == email).first()

    # 3. Allowlist check: If user does not exist or is inactive
    if not user:
        record_audit(
            db,
            action="login_denied",
            detail={"email": email, "reason": "Account not registered"},
            ip_address=ip_addr
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not registered. Contact your Auditor."
        )

    if not user.is_active:
        record_audit(
            db,
            action="login_denied",
            actor_id=user.id,
            detail={"email": email, "reason": "Account disabled"},
            ip_address=ip_addr
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not registered or is disabled."
        )

    # 4. Compare user.role with claimed_role
    if user.role != body.claimed_role:
        record_audit(
            db,
            action="login_denied",
            actor_id=user.id,
            detail={
                "email": email,
                "claimed_role": body.claimed_role,
                "actual_role": user.role,
                "reason": "Role mismatch"
            },
            ip_address=ip_addr
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This Google account is not registered as {body.claimed_role}."
        )

    # 5. UID binding: If empty, save. If exists and differs, return 403
    if not user.firebase_uid:
        user.firebase_uid = uid
    elif user.firebase_uid != uid:
        record_audit(
            db,
            action="login_denied",
            actor_id=user.id,
            detail={"email": email, "reason": "Firebase UID mismatch"},
            ip_address=ip_addr
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Security error: Google account identity mismatch."
        )

    # 6. Update last_login_at
    user.last_login_at = datetime.now(timezone.utc)

    # 7. Write audit log entry for successful login (no tokens stored)
    record_audit(
        db,
        action="login",
        actor_id=user.id,
        detail={"role": user.role, "claimed_role": body.claimed_role},
        ip_address=ip_addr
    )

    db.commit()
    db.refresh(user)

    # 8. Return user object
    return UserResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns the authenticated user object using Bearer token verification.
    Frontend uses this to restore sessions on refresh.
    """
    return UserResponse(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role
    )
