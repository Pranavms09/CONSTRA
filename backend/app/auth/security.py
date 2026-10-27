import hashlib
import hmac
import secrets
from typing import Optional
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User


def hash_password(password: str) -> str:
    """Hashes a password with a random 8-byte salt using SHA-256."""
    salt = secrets.token_hex(8)
    h = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
    return f"{salt}:{h}"


def verify_password(plain_password: str, hashed: Optional[str]) -> bool:
    """Verifies a plain password against a salt:hash string."""
    if not hashed or ":" not in hashed:
        return False
    salt, expected_hash = hashed.split(":", 1)
    calc = hashlib.sha256((salt + plain_password).encode("utf-8")).hexdigest()
    return hmac.compare_digest(calc, expected_hash)


def create_session_token(user_id: int, email: str) -> str:
    """Generates an HMAC-SHA256 signed session token for email/password authentication."""
    secret = getattr(settings, "SECRET_KEY", "siteverify-secret-key-2025-constra-apex")
    msg = f"{user_id}:{email.lower().strip()}"
    sig = hmac.new(secret.encode("utf-8"), msg.encode("utf-8"), hashlib.sha256).hexdigest()[:32]
    return f"sv-{user_id}-{sig}"


def verify_session_token(token: str, db: Session) -> Optional[User]:
    """Verifies an sv-* session token and returns the corresponding active User."""
    if not token or not token.startswith("sv-"):
        return None
    parts = token.split("-")
    if len(parts) != 3:
        return None
    user_id_str, sig = parts[1], parts[2]
    try:
        user_id = int(user_id_str)
    except ValueError:
        return None

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        return None

    secret = getattr(settings, "SECRET_KEY", "siteverify-secret-key-2025-constra-apex")
    expected_msg = f"{user.id}:{user.email.lower().strip()}"
    expected_sig = hmac.new(secret.encode("utf-8"), expected_msg.encode("utf-8"), hashlib.sha256).hexdigest()[:32]
    if not hmac.compare_digest(sig, expected_sig):
        return None

    return user
