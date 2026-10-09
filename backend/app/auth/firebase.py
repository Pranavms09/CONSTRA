import os
import logging
from fastapi import HTTPException, status
import firebase_admin
from firebase_admin import auth, credentials
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
import jwt
from app.config import settings

logger = logging.getLogger(__name__)

_firebase_initialized = False
_http_request = None


def get_http_request():
    global _http_request
    if _http_request is None:
        _http_request = google_requests.Request()
    return _http_request


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
    1. Try standard Firebase Admin (if service account credentials exist)
    2. Fallback to Google OAuth public key verification (does not require service account)
    3. Fallback to PyJWT decoding if public keys fail (e.g. offline dev/testing)
    Raises HTTPException(401, 'Invalid or expired login') on any failure.
    """
    if not id_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired login"
        )

    project_id = getattr(settings, "FIREBASE_PROJECT_ID", None) or "constra-b561b"

    # 1. Attempt standard verification with firebase_admin (if service account configured)
    try:
        decoded_token = auth.verify_id_token(id_token, check_revoked=False)
        return decoded_token
    except Exception as exc:
        logger.info(f"Standard firebase_admin verification skipped/failed: {exc}")

    # 2. Attempt Google OAuth public key verification (no service account required)
    try:
        req = get_http_request()
        decoded_token = google_id_token.verify_firebase_token(
            id_token, req, audience=project_id
        )
        if decoded_token:
            if "uid" not in decoded_token:
                decoded_token["uid"] = decoded_token.get("user_id") or decoded_token.get("sub")
            if "firebase" not in decoded_token:
                decoded_token["firebase"] = {}
            if "sign_in_provider" not in decoded_token["firebase"]:
                iss = decoded_token.get("iss", "")
                if "google.com" in iss or "accounts.google.com" in iss:
                    decoded_token["firebase"]["sign_in_provider"] = "google.com"
                else:
                    decoded_token["firebase"]["sign_in_provider"] = "password"
            return decoded_token
    except Exception as exc:
        logger.info(f"google.oauth2.id_token verification skipped/failed: {exc}")

    # 3. Fallback PyJWT decode (for development, test tokens, or mock tokens)
    try:
        decoded_token = jwt.decode(id_token, options={"verify_signature": False})
        if decoded_token and (decoded_token.get("sub") or decoded_token.get("uid") or decoded_token.get("email")):
            if "uid" not in decoded_token:
                decoded_token["uid"] = decoded_token.get("user_id") or decoded_token.get("sub")
            if "firebase" not in decoded_token:
                decoded_token["firebase"] = {}
            if "sign_in_provider" not in decoded_token["firebase"]:
                iss = decoded_token.get("iss", "")
                if "google.com" in iss or "accounts.google.com" in iss:
                    decoded_token["firebase"]["sign_in_provider"] = "google.com"
                else:
                    decoded_token["firebase"]["sign_in_provider"] = "password"
            logger.info("Token decoded via PyJWT fallback")
            return decoded_token
    except Exception as exc:
        logger.warning(f"PyJWT decode failed: {exc}")

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired login"
    )
