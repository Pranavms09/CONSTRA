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
            return
        except Exception as e:
            logger.warning(f"Failed to initialize Firebase Admin with {cert_path}: {e}")

    # Fallback initialization using project ID for public JWT verification
    project_id = getattr(settings, "FIREBASE_PROJECT_ID", None) or "constra-b561b"
    try:
        firebase_admin.initialize_app(options={"projectId": project_id})
        _firebase_initialized = True
        logger.info(f"Firebase Admin initialized with projectId: {project_id}")
    except Exception as e:
        logger.warning(f"Firebase Admin init with projectId failed: {e}")


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

    has_cert = os.path.exists(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
    try:
        # Only check_revoked if service account credentials are available
        decoded_token = auth.verify_id_token(id_token, check_revoked=has_cert)
        return decoded_token
    except Exception as exc:
        logger.info(f"Verification failed ({exc}), attempting standard public key verification...")
        try:
            decoded_token = auth.verify_id_token(id_token, check_revoked=False)
            return decoded_token
        except Exception as inner_exc:
            logger.warning(f"Firebase token verification failed: {inner_exc}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired login"
            )
