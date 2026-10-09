import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.auth import LoginRequest, UserResponse, PasswordLoginRequest, PasswordLoginResponse
from app.auth.firebase import verify_firebase_token
from app.auth.deps import get_current_user, parse_bearer_token
from app.auth.security import hash_password, verify_password, create_session_token
from app.limiter import limiter
from app.config import settings

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

    firebase_info = decoded_token.get("firebase", {})
    sign_in_provider = firebase_info.get("sign_in_provider")

    # 1. Require verified email unless password provider
    if not email_verified and sign_in_provider != "password":
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

    # 3. Allowlist check: If user does not exist
    if not user:
        if settings.BOOTSTRAP_ADMIN_EMAIL and email == settings.BOOTSTRAP_ADMIN_EMAIL.lower():
            user = User(
                email=email,
                full_name=decoded_token.get("name") or "Bootstrap Project Auditor",
                role="auditor",
                is_active=True,
                firebase_uid=uid,
                auth_provider=sign_in_provider or "google"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
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

    # 4. Role verification: If claimed_role is provided, enforce strict match
    if body.claimed_role and user.role != body.claimed_role:
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

    # 5. UID binding: bind or update on successful sign-in
    user.firebase_uid = uid
    if sign_in_provider:
        user.auth_provider = sign_in_provider

    # 6. Update last_login_at
    user.last_login_at = datetime.now(timezone.utc)

    # 7. Write audit log entry for successful login
    record_audit(
        db,
        action="login",
        actor_id=user.id,
        detail={"role": user.role, "claimed_role": body.claimed_role, "provider": sign_in_provider},
        ip_address=ip_addr
    )

    db.commit()
    db.refresh(user)

    # 8. Return user object
    return UserResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        is_active=user.is_active
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


from app.schemas.auth import DemoLoginRequest, DemoLoginResponse


@router.post("/demo-login", response_model=DemoLoginResponse)
def demo_login(
    body: DemoLoginRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Instant demo login for testing each authorized role without requiring a Google account.
    """
    ip_addr = request.client.host if request.client else None
    role_map = {
        "supervisor": ("supervisor@siteverify.com", "Alice Supervisor"),
        "store_incharge": ("store@siteverify.com", "Bob Storekeeper"),
        "auditor": ("auditor@siteverify.com", "Carol Auditor"),
    }
    email, full_name = role_map[body.role]
    user = db.query(User).filter(func.lower(User.email) == email.lower()).first()
    if not user:
        user = User(
            email=email.lower(),
            full_name=full_name,
            role=body.role,
            is_active=True,
            firebase_uid=f"uid_{body.role}",
            auth_provider="demo"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    user.last_login_at = datetime.now(timezone.utc)
    record_audit(
        db,
        action="login",
        actor_id=user.id,
        detail={"role": user.role, "mode": "demo"},
        ip_address=ip_addr
    )
    db.commit()

    return DemoLoginResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        token=f"demo-{user.role}"
    )


@router.post("/login-password", response_model=PasswordLoginResponse)
@limiter.limit("20/minute")
async def login_password(
    request: Request,
    body: PasswordLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Direct Email and Password authentication against user allowlist.
    Issues a verified session token (sv-*) recognized by backend protected routes.
    """
    ip_addr = request.client.host if request.client else None
    email = body.email.lower().strip()
    password = body.password.strip() if body.password else ""

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required."
        )

    # Allowlist check: check if user exists
    user = db.query(User).filter(func.lower(User.email) == email).first()

    # Special bootstrap check for designated auditor pranavms09@gmail.com
    is_bootstrap_auditor_email = (
        email == "pranavms09@gmail.com" or
        bool(settings.BOOTSTRAP_ADMIN_EMAIL and email == settings.BOOTSTRAP_ADMIN_EMAIL.lower())
    )

    if not user:
        if is_bootstrap_auditor_email and password == "3157":
            user = User(
                email=email,
                full_name="Pranav Auditor",
                role="auditor",
                password_hash=hash_password("3157"),
                is_active=True,
                auth_provider="password"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        elif is_bootstrap_auditor_email:
            record_audit(
                db,
                action="login_denied",
                detail={"email": email, "reason": "Invalid password"},
                ip_address=ip_addr
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password. Please verify your credentials."
            )
        else:
            record_audit(
                db,
                action="login_denied",
                detail={"email": email, "reason": "Account not registered"},
                ip_address=ip_addr
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Your account is not registered. Only the Project Auditor can authorize Site Supervisors and Store In-Charges."
            )

    # Password check
    password_valid = False
    if is_bootstrap_auditor_email and password == "3157":
        password_valid = True
        # Keep password_hash up to date
        if not user.password_hash or not verify_password("3157", user.password_hash):
            user.password_hash = hash_password("3157")
            db.commit()
    elif user.password_hash and verify_password(password, user.password_hash):
        password_valid = True

    if not password_valid:
        record_audit(
            db,
            action="login_denied",
            actor_id=user.id,
            detail={"email": email, "reason": "Invalid password"},
            ip_address=ip_addr
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please verify your credentials."
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

    # Role enforcement:
    # Project Auditor has clearance to enter system regardless of login radio selection.
    # Non-auditor roles are strictly restricted to their database assigned role.
    if body.claimed_role and user.role != body.claimed_role and user.role != "auditor":
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
            detail=f"This account is authorized as '{user.role}', not '{body.claimed_role}'. Please select your authorized role."
        )

    # Update last login time and record audit
    user.last_login_at = datetime.now(timezone.utc)
    token = create_session_token(user.id, user.email)

    record_audit(
        db,
        action="login",
        actor_id=user.id,
        detail={"role": user.role, "claimed_role": body.claimed_role, "provider": "password"},
        ip_address=ip_addr
    )
    db.commit()
    db.refresh(user)

    return PasswordLoginResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        token=token
    )


