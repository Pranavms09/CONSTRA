import json
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Header, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.config import settings, get_gemini_api_key
from app.database import get_db
from app.models.image_analysis import ImageAnalysis
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.analysis import ImageAnalysisResponse, HealthResponse
from app.services.gemini_service import validate_image_file, analyze_image_with_gemini
from app.auth.deps import get_current_user

logger = logging.getLogger("siteverify.analysis")

router = APIRouter(tags=["image-analysis"])


def get_optional_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Optional authentication: associates analysis with authenticated user if Bearer token present,
    while allowing open demonstration/testing.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return get_current_user(authorization=authorization, db=db)
    except Exception:
        return None


@router.get("/api/health", response_model=HealthResponse)
@router.get("/health", response_model=HealthResponse)
def get_health():
    """
    Reports backend health status and indicates whether Gemini API key is configured
    WITHOUT exposing the actual API key.
    """
    api_key = get_gemini_api_key()
    return HealthResponse(
        status="ok",
        app="SiteVerify API",
        gemini_configured=bool(api_key),
        model=settings.GEMINI_MODEL
    )


@router.post("/api/analyze-image", response_model=ImageAnalysisResponse)
@router.post("/analyze-image", response_model=ImageAnalysisResponse)
async def analyze_image(
    request: Request,
    file: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload an image for AI vision analysis via Google Gemini.
    - Validates image integrity and MIME format
    - Generates description server-side using google-genai SDK
    - Saves the original AI description in the database (provenance tracked)
    - Returns strictly the backend-generated description
    """
    upload = file or image
    if upload is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No image file provided. Please upload an image using the 'file' or 'image' field."
        )

    filename = upload.filename or "unknown_image.jpg"
    content_type = upload.content_type or "image/jpeg"

    try:
        file_bytes = await upload.read()
    except Exception as exc:
        logger.error(f"Failed to read uploaded file: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to read the uploaded image file."
        )

    # 1. Validate file format, size, and image integrity via PIL
    normalized_mime, sha256_hash = validate_image_file(filename, content_type, file_bytes)

    # 2. Call Google Gemini vision model
    description = analyze_image_with_gemini(file_bytes, normalized_mime)

    # 3. Persist original AI-generated description in database
    analysis_record = ImageAnalysis(
        filename=filename,
        content_type=normalized_mime,
        file_size=len(file_bytes),
        file_hash=sha256_hash,
        description=description,
        model=settings.GEMINI_MODEL,
        source="backend_gemini_vision",
        uploaded_by_id=current_user.id if current_user else None,
    )
    db.add(analysis_record)

    # 4. Record audit log entry
    ip_addr = request.client.host if request.client else None
    audit_entry = AuditLog(
        actor_id=current_user.id if current_user else None,
        action="image_analysis",
        entity="image_analysis",
        entity_id=sha256_hash[:16],
        detail=json.dumps({
            "filename": filename,
            "file_size": len(file_bytes),
            "model": settings.GEMINI_MODEL,
            "source": "backend_gemini_vision",
        }),
        ip_address=ip_addr
    )
    db.add(audit_entry)

    try:
        db.commit()
        db.refresh(analysis_record)
    except Exception as exc:
        db.rollback()
        logger.error(f"Failed to persist analysis record: {exc}")

    return ImageAnalysisResponse(
        status="success",
        description=description,
        filename=filename,
        id=analysis_record.id,
        file_size=len(file_bytes),
        file_hash=sha256_hash,
        model=settings.GEMINI_MODEL,
        source="backend_gemini_vision",
        created_at=analysis_record.created_at.isoformat() if analysis_record.created_at else None,
    )


@router.get("/api/analyses")
@router.get("/analyses")
def list_analyses(
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    Read-only retrieval of past backend-generated analyses.
    """
    records = db.query(ImageAnalysis).order_by(ImageAnalysis.id.desc()).limit(limit).all()
    return [r.to_dict() for r in records]


@router.put("/api/analyze-image/{analysis_id}")
@router.patch("/api/analyze-image/{analysis_id}")
@router.put("/analyze-image/{analysis_id}")
@router.patch("/analyze-image/{analysis_id}")
def update_analysis_forbidden(analysis_id: int):
    """
    Security safeguard: AI-generated descriptions are immutable.
    Prevent any client or user from modifying or overwriting saved descriptions.
    """
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="AI-generated descriptions are strictly immutable and cannot be modified."
    )
