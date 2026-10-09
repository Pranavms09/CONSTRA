from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.user import User
from app.auth.firebase import verify_firebase_token


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
    Verifies Firebase Bearer token and returns the registered, active database User.
    Never trusts roles from client or token - loads strictly from database.
    """
    id_token = parse_bearer_token(authorization)
    decoded_token = verify_firebase_token(id_token)

    if not decoded_token.get("email_verified", False):
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

    user = db.query(User).filter(func.lower(User.email) == email).first()
    if not user:
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
    # Auditors have global project access, other roles must be assigned
    # Placeholder for future project membership checks:
    # If not member: raise HTTPException(status_code=404, detail="Resource not found")
    pass
