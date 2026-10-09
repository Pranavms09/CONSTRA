import os
import logging
from fastapi import HTTPException, status
import firebase_admin
from firebase_admin import auth, credentials
from app.config import settings

logger = logging.getLogger(__name__)

_firebase_initialized = False


def init_firebase_admin():
    global _firebase_initialized
    if _firebase_initialized or firebase_admin._apps:
        _firebase_initialized = True
        return

    cert_path = settings.FIREBASE_SERVICE_ACCOUNT_PATH
    if os.path.exists(cert_path):
        try:
            cred = credentials.Certificate(cert_path)
            firebase_admin.initialize_app(cred)
            _firebase_initialized = True
            logger.info(f"Firebase Admin initialized with certificate: {cert_path}")
        except Exception as e:
            logger.warning(f"Failed to initialize Firebase Admin with {cert_path}: {e}")
    else:
        # Default initialization or delayed until real cert is provided
        try:
            firebase_admin.initialize_app()
            _firebase_initialized = True
            logger.info("Firebase Admin initialized with default credentials")
        except Exception as e:
            logger.warning(f"Firebase Admin default init failed (service account path not found): {e}")


# Attempt initialisation on import
init_firebase_admin()


def verify_firebase_token(id_token: str) -> dict:
    """
    Verifies a Firebase ID token.
    Raises HTTPException(401, 'Invalid or expired login') on any failure.
    """
    if not id_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired login"
        )

    try:
        decoded_token = auth.verify_id_token(id_token, check_revoked=True)
        return decoded_token
    except Exception as exc:
        logger.warning(f"Firebase token verification failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired login"
        )
