"""
Cloudinary Upload Service for CONSTRA Evidence Images.

Handles uploading evidence photos to Cloudinary CDN so that all authority
dashboards (Supervisor, Store Incharge, Auditor) can view images without
depending on local disk storage.
"""

import logging
from typing import Optional

import cloudinary
import cloudinary.uploader

from app.config import settings

logger = logging.getLogger("siteverify.cloudinary")

_configured = False


def _ensure_configured():
    """Lazily configure the Cloudinary SDK from environment settings."""
    global _configured
    if _configured:
        return

    cloud_name = getattr(settings, "CLOUDINARY_CLOUD_NAME", None)
    api_key = getattr(settings, "CLOUDINARY_API_KEY", None)
    api_secret = getattr(settings, "CLOUDINARY_API_SECRET", None)

    if not all([cloud_name, api_key, api_secret]):
        logger.warning(
            "Cloudinary credentials not fully configured. "
            "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env"
        )
        return

    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True,
    )
    _configured = True
    logger.info("Cloudinary SDK configured for cloud: %s", cloud_name)


def is_cloudinary_configured() -> bool:
    """Check whether Cloudinary credentials are available."""
    _ensure_configured()
    return _configured


def upload_evidence_image(
    file_bytes: bytes,
    *,
    public_id: str,
    folder: str = "constra/evidence",
    resource_type: str = "image",
) -> Optional[str]:
    """
    Upload evidence image bytes to Cloudinary.

    Args:
        file_bytes: Raw image bytes.
        public_id: A unique identifier for the asset (e.g., sha256_deviceEvidenceId).
        folder: Cloudinary folder path for organization.
        resource_type: The Cloudinary resource type (default: "image").

    Returns:
        The secure_url (HTTPS CDN link) on success, or None if upload fails
        or Cloudinary is not configured.
    """
    if not is_cloudinary_configured():
        logger.info("Cloudinary not configured; skipping cloud upload.")
        return None

    try:
        result = cloudinary.uploader.upload(
            file_bytes,
            public_id=public_id,
            folder=folder,
            resource_type=resource_type,
            overwrite=False,           # Idempotent: don't replace existing
            unique_filename=False,     # Use our public_id as-is
            invalidate=False,
        )
        secure_url = result.get("secure_url")
        logger.info(
            "Uploaded evidence to Cloudinary: %s (%d bytes)",
            secure_url,
            len(file_bytes),
        )
        return secure_url
    except Exception as exc:
        logger.error("Cloudinary upload failed: %s", exc, exc_info=True)
        return None
