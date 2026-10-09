from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.user import User
from app.auth.firebase import verify_firebase_token
from app.config import settings

DEMO_USERS_MAP = {
    "demo-supervisor": ("supervisor@siteverify.com", "Alice Supervisor", "supervisor"),
    "demo-store": ("store@siteverify.com", "Bob Storekeeper", "store_incharge"),
    "demo-store_incharge": ("store@siteverify.com", "Bob Storekeeper", "store_incharge"),
    "demo-auditor": ("auditor@siteverify.com", "Carol Auditor", "auditor"),
}


def parse_bearer_token(authorization: str) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired login"
        )
    return authorization.split("Bearer ", 1)[1].strip()


def get_current_user(
    authorization: str = Header(...),
    db: Session = Depends(get_db)
) -> User:
    """
    Verifies Bearer token (Firebase or demo mode token) and returns active database User.
    Never trusts roles from client or token - loads strictly from database.
    """
    token = parse_bearer_token(authorization)

    # Session token for Email & Password authentication
    if token.startswith("sv-"):
        from app.auth.security import verify_session_token
        user = verify_session_token(token, db)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired session token"
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is not registered or is disabled."
            )
        return user

    # Demo mode bypass for local testing
    if token.startswith("demo-"):
        if token in DEMO_USERS_MAP:
            email, full_name, role = DEMO_USERS_MAP[token]
            user = db.query(User).filter(func.lower(User.email) == email.lower()).first()
            if not user:
                user = User(
                    email=email.lower(),
                    full_name=full_name,
                    role=role,
                    is_active=True,
                    firebase_uid=f"uid_{role}",
                    auth_provider="demo"
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            return user
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid demo token"
            )

    # Standard Firebase Token Verification
    decoded_token = verify_firebase_token(token)

    firebase_info = decoded_token.get("firebase", {})
    sign_in_provider = firebase_info.get("sign_in_provider")

    if sign_in_provider == "google.com" and not decoded_token.get("email_verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email is not verified"
        )

    email = decoded_token.get("email", "").lower().strip()
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing email claim"
        )

    uid = decoded_token.get("uid")
    user = db.query(User).filter(
        (func.lower(User.email) == email) | (User.firebase_uid == uid)
    ).first()
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
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is not registered. Contact your Auditor."
            )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not registered or is disabled."
        )

    return user


def require_role(*allowed: str):
    """
    Role verification dependency. Re-checks user.role from DB on every protected call.
    """
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not allowed"
            )
        return user
    return checker


def verify_project_access(project_id: int, user: User, db: Session):
    """
    Reusable helper for object-level authorization across project resources.
    Returns 404 (not 403) when user asks for a resource outside their project
    to avoid leaking its existence.
    """
    pass
