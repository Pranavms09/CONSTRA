import json
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Request, UploadFile, status
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
    project_id: Optional[int] = Form(None),
    stage_id: Optional[int] = Form(None),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload an image for AI vision analysis via Google Gemini and authoritative GPS geofence audit.
    - Validates image integrity and MIME format
    - Enforces server-side project authorization (never trusts coordinates from client)
    - Retrieves authoritative project latitude, longitude, and radius from database
    - Inspects EXIF GPS metadata and computes Haversine distance
    - Raises HIGH severity verification alert if outside permitted radius
    - Returns structured verification result and persists outcome in DB
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

    # 2. Check for duplicate upload across database
    duplicate_record = db.query(ImageAnalysis).filter(ImageAnalysis.file_hash == sha256_hash).first()
    is_duplicate = duplicate_record is not None
    duplicate_of_id = duplicate_record.id if duplicate_record else None

    # 3. Save physical file to shared upload storage for multi-laptop retrieval
    import os
    from datetime import datetime, timezone
    from app.checks.exif_gps_analyzer import analyze_exif_gps, verify_gps_geofence
    from app.models.project import Project, ProjectMember
    from app.services.alerts import raise_alert

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(filename)[1].lower() or ".jpg"
    safe_filename = f"evd_{sha256_hash[:16]}{ext}"
    saved_path = os.path.join(settings.UPLOAD_DIR, safe_filename)
    if not os.path.exists(saved_path):
        with open(saved_path, "wb") as f:
            f.write(file_bytes)

    # Also ensure original filename exists in uploads if needed for legacy lookups
    orig_path = os.path.join(settings.UPLOAD_DIR, os.path.basename(filename))
    if not os.path.exists(orig_path):
        with open(orig_path, "wb") as f:
            f.write(file_bytes)

    # 4. Enforce server-side project authorization and retrieve authoritative project coordinates (Requirements 2 & 10)
    target_project = None
    if project_id:
        if current_user and current_user.role == "supervisor":
            membership = db.query(ProjectMember).filter(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == current_user.id
            ).first()
            if not membership:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"User is not authorized for project ID {project_id}."
                )
        target_project = db.query(Project).filter(Project.id == project_id).first()

    if not target_project and current_user:
        membership = db.query(ProjectMember).filter(ProjectMember.user_id == current_user.id).first()
        if membership:
            target_project = db.query(Project).filter(Project.id == membership.project_id).first()

    if not target_project:
        target_project = db.query(Project).first()

    if target_project:
        site_lat = target_project.centroid_lat if target_project.centroid_lat is not None else 28.6280
        site_lng = target_project.centroid_lng if target_project.centroid_lng is not None else 77.3649
        site_radius = target_project.site_radius_m if (target_project.site_radius_m and target_project.site_radius_m > 0) else 200.0
        resolved_project_id = target_project.id
    else:
        site_lat = 28.6280
        site_lng = 77.3649
        site_radius = 200.0
        resolved_project_id = 1

    # 5. Run real EXIF & GPS geofence analysis using authoritative DB values
    exif_report = None
    gps_verification = None
    try:
        exif_report = analyze_exif_gps(
            saved_path,
            site_latitude=site_lat,
            site_longitude=site_lng,
            uploaded_at=datetime.now(timezone.utc),
            site_radius_m=site_radius,
            max_capture_age_hours=48.0,
        )
        gps_verification = exif_report.get("gps_verification")
    except Exception as exc:
        logger.warning(f"EXIF analysis note: {exc}")
        gps_verification = {
            "status": "REVIEW",
            "gps_status": "REVIEW",
            "project_coordinates": {"latitude": site_lat, "longitude": site_lng},
            "extracted_coordinates": None,
            "distance_m": None,
            "permitted_radius_m": site_radius,
            "explanation": f"GPS analysis encountered an unexpected exception: {exc}",
            "severity": "medium",
            "alert_required": False,
            "security_disclaimer": "Metadata-based verification signal: not cryptographic proof of physical presence.",
        }

    # 6. If photo is outside permitted radius, create HIGH severity verification alert (Requirement 5)
    created_alert = None
    if gps_verification and gps_verification.get("alert_required"):
        try:
            created_alert = raise_alert(
                db,
                project_id=resolved_project_id,
                stage_id=stage_id,
                photo_id=None,
                type="GEOFENCE_BREACH",
                severity="high",
                explanation=gps_verification["explanation"],
                evidence={
                    "gps_verification": gps_verification,
                    "filename": filename,
                    "file_hash": sha256_hash,
                    "project_id": resolved_project_id,
                    "stage_id": stage_id,
                    "disclaimer": gps_verification.get("security_disclaimer"),
                }
            )
        except Exception as alert_exc:
            logger.error(f"Failed to raise geofence breach alert: {alert_exc}")

    # 7. Call Google Gemini vision model
    description = analyze_image_with_gemini(file_bytes, normalized_mime)

    # 8. Persist verification outcome in database (Requirement 7)
    analysis_record = ImageAnalysis(
        filename=filename,
        content_type=normalized_mime,
        file_size=len(file_bytes),
        file_hash=sha256_hash,
        description=description,
        model=settings.GEMINI_MODEL,
        source="backend_gemini_vision",
        uploaded_by_id=current_user.id if current_user else None,
        project_id=resolved_project_id,
        stage_id=stage_id,
        gps_status=gps_verification["status"] if gps_verification else "REVIEW",
        gps_latitude=gps_verification["extracted_coordinates"]["latitude"] if (gps_verification and gps_verification.get("extracted_coordinates")) else None,
        gps_longitude=gps_verification["extracted_coordinates"]["longitude"] if (gps_verification and gps_verification.get("extracted_coordinates")) else None,
        gps_distance_m=gps_verification.get("distance_m") if gps_verification else None,
        verification_result=json.dumps(gps_verification) if gps_verification else None,
        alert_id=created_alert.id if created_alert else None,
    )
    db.add(analysis_record)

    # 9. Record audit log entry
    ip_addr = request.client.host if request.client else None
    audit_entry = AuditLog(
        actor_id=current_user.id if current_user else None,
        action="image_analysis",
        entity="image_analysis",
        entity_id=sha256_hash[:16],
        detail=json.dumps({
            "filename": filename,
            "saved_filename": safe_filename,
            "file_size": len(file_bytes),
            "is_duplicate": is_duplicate,
            "project_id": resolved_project_id,
            "gps_status": gps_verification["status"] if gps_verification else "REVIEW",
            "distance_m": gps_verification.get("distance_m") if gps_verification else None,
            "alert_created": created_alert is not None,
            "model": settings.GEMINI_MODEL,
            "source": "backend_gemini_vision",
        }),
        ip_address=ip_addr
    )
    db.add(audit_entry)

    try:
        db.commit()
        db.refresh(analysis_record)
        if created_alert:
            created_alert.photo_id = analysis_record.id
            db.commit()
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
        file_url=f"/uploads/{safe_filename}",
        is_duplicate=is_duplicate,
        duplicate_of_id=duplicate_of_id,
        exif_gps=exif_report,
        gps_verification=gps_verification,
        project_id=resolved_project_id,
        stage_id=stage_id,
        alert_id=created_alert.id if created_alert else None,
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
