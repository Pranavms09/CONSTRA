import os
import logging
from fastapi import HTTPException, status
import firebase_admin
from firebase_admin import auth, credentials
from app.config import settings

logger = logging.getLogger(__name__)

_firebase_initialized = False


def resolve_service_account_path():
    cert_path = getattr(settings, "FIREBASE_SERVICE_ACCOUNT_PATH", None)
    backend_dir_secrets = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "secrets", "firebase-service-account.json"))
    candidates = [
        cert_path,
        os.path.join("backend", cert_path) if cert_path else None,
        cert_path.replace("backend/", "") if cert_path and "backend/" in cert_path else None,
        os.path.join("..", cert_path) if cert_path else None,
        os.path.abspath(cert_path) if cert_path else None,
        backend_dir_secrets,
    ]
    for candidate in candidates:
        if candidate and os.path.exists(candidate) and os.path.isfile(candidate):
            return candidate
    return None


def init_firebase_admin():
    global _firebase_initialized
    if _firebase_initialized and firebase_admin._apps:
        return

    resolved_cert = resolve_service_account_path()
    project_id = getattr(settings, "FIREBASE_PROJECT_ID", None) or "constra-b561b"

    if resolved_cert:
        try:
            if firebase_admin._apps:
                app = firebase_admin.get_app()
                if isinstance(app.credential, credentials.ApplicationDefault):
                    firebase_admin.delete_app(app)
            if not firebase_admin._apps:
                cred = credentials.Certificate(resolved_cert)
                firebase_admin.initialize_app(cred, options={"projectId": project_id})
            _firebase_initialized = True
            logger.info(f"Firebase Admin initialized with certificate: {resolved_cert}")
            return
        except Exception as e:
            logger.warning(f"Failed to initialize Firebase Admin with {resolved_cert}: {e}")

    # Fallback initialization using project ID for public JWT verification
    try:
        if not firebase_admin._apps:
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

    has_cert = bool(resolve_service_account_path())
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
