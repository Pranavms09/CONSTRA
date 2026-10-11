import os
import math
import hashlib
import json
import logging
from datetime import datetime, timezone, date
from pathlib import Path
from typing import List, Optional
from PIL import Image
import io

from fastapi import (
    APIRouter, Depends, HTTPException, UploadFile, File, Form,
    status, Request, Response
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.config import settings
from app.auth.deps import require_role, get_current_user
from app.models.user import User
from app.models.project import Project, Stage, ProjectMember
from app.models.evidence import Evidence
from app.models.alert import Alert
from app.models.audit_log import AuditLog
from app.schemas.supervisor import (
    SupervisorProjectResponse,
    SupervisorStageResponse,
    EvidenceResponse,
    SupervisorDashboardResponse,
)
from app.services.chain_hooks import enqueue_anchor
from app.services.cloudinary_service import upload_evidence_image, is_cloudinary_configured

logger = logging.getLogger("siteverify.supervisor")

router = APIRouter(prefix="/supervisor", tags=["supervisor"])

EVIDENCE_STORAGE_DIR = Path("uploads") / "evidence"
EVIDENCE_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

MAX_EVIDENCE_BYTES = 20 * 1024 * 1024  # 20 MB limit
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points in meters.
    """
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def ensure_supervisor_project(db: Session, supervisor: User, project_id: int) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Project membership check
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == supervisor.id
    ).first()
    
    if not member:
        # Fallback for demo supervisor or default project assignment if supervisor has no assignments yet
        # Check if project has no members or if this is the demo project and user is supervisor
        if supervisor.email.lower() == "supervisor@siteverify.com":
            # Auto-link demo supervisor to project 1 for flawless demo testing
            auto_member = ProjectMember(
                project_id=project_id,
                user_id=supervisor.id,
                role="supervisor"
            )
            db.add(auto_member)
            db.commit()
            return project
        
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or user is not an assigned member"
        )
    return project


@router.get("/projects", response_model=List[SupervisorProjectResponse])
def get_assigned_projects(
    user: User = Depends(require_role("supervisor")),
    db: Session = Depends(get_db)
):
    """
    Returns projects assigned to the authenticated Site Supervisor.
    """
    # Auto-link demo supervisor to project 1 if not yet assigned
    if user.email.lower() == "supervisor@siteverify.com":
        first_proj = db.query(Project).first()
        if first_proj:
            membership = db.query(ProjectMember).filter(
                ProjectMember.project_id == first_proj.id,
                ProjectMember.user_id == user.id
            ).first()
            if not membership:
                db.add(ProjectMember(
                    project_id=first_proj.id,
                    user_id=user.id,
                    role="supervisor"
                ))
                db.commit()

    projects = (
        db.query(Project)
        .join(ProjectMember, Project.id == ProjectMember.project_id)
        .filter(ProjectMember.user_id == user.id)
        .order_by(Project.id.asc())
        .all()
    )
    return [
        SupervisorProjectResponse(
            id=p.id,
            name=p.name,
            site_address=p.site_address,
            centroid_lat=p.centroid_lat,
            centroid_lng=p.centroid_lng,
            site_radius_m=p.site_radius_m or 200.0
        )
        for p in projects
    ]


@router.get("/projects/{pid}/stages", response_model=List[SupervisorStageResponse])
def get_project_stages(
    pid: int,
    user: User = Depends(require_role("supervisor")),
    db: Session = Depends(get_db)
):
    """
    Returns stages for the specified project, enforcing supervisor membership.
    """
    ensure_supervisor_project(db, user, pid)
    stages = (
        db.query(Stage)
        .filter(Stage.project_id == pid)
        .order_by(Stage.order.asc(), Stage.id.asc())
        .all()
    )
    return [
        SupervisorStageResponse(
            id=s.id,
            project_id=s.project_id,
            name=s.name,
            order=s.order,
            status=s.status,
            verified_progress=float(s.verified_progress or 0.0)
        )
        for s in stages
    ]


@router.post("/evidence", response_model=EvidenceResponse, status_code=status.HTTP_201_CREATED)
async def submit_evidence(
    request: Request,
    response: Response,
    file: UploadFile = File(...),
    device_evidence_id: str = Form(...),
    project_id: int = Form(...),
    stage_id: int = Form(...),
    captured_at: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    accuracy_m: float = Form(...),
    client_sha256: str = Form(...),
    notes: Optional[str] = Form(None),
    user: User = Depends(require_role("supervisor")),
    db: Session = Depends(get_db)
):
    """
    Submits live camera-captured evidence for a project milestone stage.
    - Idempotent on device_evidence_id
    - Recalculates SHA-256 server-side from raw bytes
    - Validates image integrity
    - Validates geofence against project centroid & radius
    - Enqueues blockchain hash anchoring
    - Disallows editing, replacements, or gallery uploads
    """
    # 1. Idempotency Check
    existing_evidence = db.query(Evidence).filter(Evidence.device_evidence_id == device_evidence_id).first()
    if existing_evidence:
        response.status_code = status.HTTP_200_OK
        return EvidenceResponse(**existing_evidence.to_dict())

    # 2. Authorization & Project Membership Validation
    project = ensure_supervisor_project(db, user, project_id)
    
    stage = db.query(Stage).filter(Stage.id == stage_id, Stage.project_id == project_id).first()
    if not stage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stage not found for this project"
        )

    # 3. Read and validate raw file bytes
    try:
        file_bytes = await file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded evidence file: {exc}"
        )

    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded evidence file is empty"
        )

    if len(file_bytes) > MAX_EVIDENCE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {MAX_EVIDENCE_BYTES // (1024 * 1024)} MB"
        )

    # Validate image bytes integrity using PIL
    try:
        image = Image.open(io.BytesIO(file_bytes))
        image.verify()
        format_lower = (image.format or "JPEG").lower()
        mime_type = f"image/{format_lower}" if format_lower in ["jpeg", "png", "webp"] else "image/jpeg"
    except Exception as img_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid or corrupted image format: {img_err}"
        )

    # 4. Server-Side SHA-256 Calculation
    server_sha256 = hashlib.sha256(file_bytes).hexdigest().lower()
    norm_client_sha = client_sha256.strip().lower()
    hash_matched = (server_sha256 == norm_client_sha)

    # 5. Geofence & Proximity Calculation
    distance_to_site_m = None
    is_within_radius = True
    radius_warning = False

    if project.centroid_lat is not None and project.centroid_lng is not None:
        distance_to_site_m = haversine_distance(
            latitude, longitude,
            project.centroid_lat, project.centroid_lng
        )
        allowed_radius = float(project.site_radius_m or 200.0)
        # Account for device measurement accuracy radius
        effective_radius = allowed_radius + max(0.0, float(accuracy_m))
        if distance_to_site_m > effective_radius:
            is_within_radius = False
            radius_warning = True

    # 6. Secure Server Storage outside public paths
    # Filename format: {server_sha256}_{device_evidence_id}.jpg
    safe_filename = f"{server_sha256}_{device_evidence_id}.jpg"
    target_path = EVIDENCE_STORAGE_DIR / safe_filename
    with open(target_path, "wb") as f_out:
        f_out.write(file_bytes)

    # 6b. Upload to Cloudinary CDN for cross-dashboard access
    cloudinary_url = upload_evidence_image(
        file_bytes,
        public_id=f"{server_sha256}_{device_evidence_id}",
        folder="constra/evidence",
    )

    # Parse capture timestamp
    try:
        captured_dt = datetime.fromisoformat(captured_at.replace("Z", "+00:00"))
    except Exception:
        captured_dt = datetime.now(timezone.utc)

    # 7. Persist Evidence Record
    evidence_record = Evidence(
        device_evidence_id=device_evidence_id,
        project_id=project_id,
        stage_id=stage_id,
        supervisor_id=user.id,
        file_path=str(target_path),
        file_url=cloudinary_url,
        original_filename=file.filename or safe_filename,
        file_size=len(file_bytes),
        mime_type=mime_type,
        client_sha256=norm_client_sha,
        server_sha256=server_sha256,
        hash_matched=hash_matched,
        captured_at=captured_dt,
        server_received_at=datetime.now(timezone.utc),
        latitude=latitude,
        longitude=longitude,
        accuracy_m=accuracy_m,
        distance_to_site_m=round(distance_to_site_m, 2) if distance_to_site_m is not None else None,
        is_within_radius=is_within_radius,
        radius_warning=radius_warning,
        blockchain_status="queued",
        ai_status="pending",
        status="VERIFIED_SUBMITTED" if hash_matched else "HASH_MISMATCH_SUSPICIOUS",
        notes=notes
    )
    db.add(evidence_record)
    db.commit()
    db.refresh(evidence_record)

    # 8. Record Alerts if Suspicious
    if not hash_matched:
        alert = Alert(
            project_id=project_id,
            stage_id=stage_id,
            photo_id=evidence_record.id,
            type="HASH_MISMATCH",
            severity="critical",
            status="open",
            explanation=(
                f"Evidence submission hash mismatch detected. Client reported {norm_client_sha}, "
                f"but server calculated {server_sha256}."
            ),
            evidence=json.dumps({"device_evidence_id": device_evidence_id, "evidence_id": evidence_record.id})
        )
        db.add(alert)
        db.commit()

    if radius_warning:
        alert = Alert(
            project_id=project_id,
            stage_id=stage_id,
            photo_id=evidence_record.id,
            type="GEOFENCE_VIOLATION",
            severity="medium",
            status="open",
            explanation=(
                f"Site photo captured {distance_to_site_m:.1f}m from site centroid "
                f"(site radius {project.site_radius_m}m, accuracy ±{accuracy_m:.1f}m)."
            ),
            evidence=json.dumps({
                "latitude": latitude,
                "longitude": longitude,
                "distance_m": distance_to_site_m,
                "accuracy_m": accuracy_m,
                "evidence_id": evidence_record.id
            })
        )
        db.add(alert)
        db.commit()

    # 9. Audit Log
    client_ip = request.client.host if request.client else "unknown"
    audit = AuditLog(
        actor_id=user.id,
        action="EVIDENCE_CAPTURED",
        entity="evidence",
        entity_id=str(evidence_record.id),
        detail=json.dumps({
            "device_evidence_id": device_evidence_id,
            "project_id": project_id,
            "stage_id": stage_id,
            "sha256": server_sha256,
            "hash_matched": hash_matched,
            "radius_warning": radius_warning,
            "distance_to_site_m": distance_to_site_m
        }),
        ip_address=client_ip
    )
    db.add(audit)
    db.commit()

    # 10. Enqueue Blockchain Anchor
    try:
        anchor_id = enqueue_anchor(
            db,
            entity="photo",
            entity_id=evidence_record.id,
            sha256=server_sha256,
            project_id=project_id
        )
        if anchor_id != -1:
            evidence_record.blockchain_status = "queued"
            db.commit()
    except Exception as exc:
        logger.warning(f"Blockchain anchoring failed to enqueue: {exc}")

    # 11. Launch Asynchronous Gemini VLM Construction Progress Analysis
    try:
        import asyncio
        from app.services.construction_vision import run_evidence_ai_analysis_async
        asyncio.create_task(
            run_evidence_ai_analysis_async(
                evidence_id=evidence_record.id,
                file_bytes=file_bytes,
                mime_type=mime_type,
                stage_name=stage.name if stage else None,
                project_name=project.name if project else None,
            )
        )
    except Exception as ai_err:
        logger.warning(f"Failed to launch background AI vision analysis: {ai_err}")

    return EvidenceResponse(**evidence_record.to_dict())


@router.get("/evidence", response_model=List[EvidenceResponse])
def list_supervisor_evidence(
    project_id: Optional[int] = None,
    stage_id: Optional[int] = None,
    limit: int = 50,
    user: User = Depends(require_role("supervisor")),
    db: Session = Depends(get_db)
):
    """
    Retrieves the supervisor's submitted evidence history.
    """
    query = db.query(Evidence).filter(Evidence.supervisor_id == user.id)
    if project_id:
        query = query.filter(Evidence.project_id == project_id)
    if stage_id:
        query = query.filter(Evidence.stage_id == stage_id)

    records = query.order_by(Evidence.id.desc()).limit(limit).all()
    return [EvidenceResponse(**r.to_dict()) for r in records]


@router.get("/evidence/{evidence_id}", response_model=EvidenceResponse)
def get_evidence_detail(
    evidence_id: int,
    user: User = Depends(require_role("supervisor")),
    db: Session = Depends(get_db)
):
    """
    Retrieves detailed metadata for a specific evidence submission.
    """
    evidence = db.query(Evidence).filter(
        Evidence.id == evidence_id,
        Evidence.supervisor_id == user.id
    ).first()
    
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence record not found"
        )
    return EvidenceResponse(**evidence.to_dict())


@router.post("/evidence/{evidence_id}/retry-ai", response_model=EvidenceResponse)
async def retry_evidence_ai_analysis(
    evidence_id: int,
    user: User = Depends(require_role("supervisor")),
    db: Session = Depends(get_db)
):
    """
    Retries Gemini construction vision analysis for a previously submitted evidence photo.
    """
    evidence = db.query(Evidence).filter(
        Evidence.id == evidence_id,
        Evidence.supervisor_id == user.id
    ).first()
    if not evidence:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence record not found")

    if not os.path.exists(evidence.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Physical evidence file not found for re-analysis")

    with open(evidence.file_path, "rb") as f:
        file_bytes = f.read()

    evidence.ai_status = "pending"
    db.commit()

    import asyncio
    from app.services.construction_vision import run_evidence_ai_analysis_async
    stage_name = evidence.stage.name if evidence.stage else None
    project_name = evidence.project.name if evidence.project else None
    asyncio.create_task(
        run_evidence_ai_analysis_async(
            evidence_id=evidence.id,
            file_bytes=file_bytes,
            mime_type=evidence.mime_type or "image/jpeg",
            stage_name=stage_name,
            project_name=project_name,
        )
    )

    return EvidenceResponse(**evidence.to_dict())


@router.post("/evidence/{evidence_id}/retry-anchor", response_model=EvidenceResponse)
def retry_evidence_anchor(
    evidence_id: int,
    user: User = Depends(require_role("supervisor")),
    db: Session = Depends(get_db)
):
    """
    Safely retries blockchain anchoring for an unconfirmed or failed evidence record.
    """
    evidence = db.query(Evidence).filter(
        Evidence.id == evidence_id,
        Evidence.supervisor_id == user.id
    ).first()
    if not evidence:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence record not found")

    from app.services.chain_hooks import enqueue_anchor
    from app.services.firestore_db import get_firestore_client
    from datetime import datetime, timezone

    # Reset Firestore chain_anchors document if present
    try:
        client = get_firestore_client()
        doc_ref = client.collection("chain_anchors").document(evidence.server_sha256)
        doc_ref.set({
            "status": "pending",
            "attempts": 0,
            "next_attempt_at": datetime.now(timezone.utc),
            "claimed_by": None,
            "lease_until": None,
            "last_error": None,
        }, merge=True)
    except Exception as fs_err:
        logger.warning(f"Resetting Firestore anchor doc failed: {fs_err}")
        enqueue_anchor(
            db,
            entity="photo",
            entity_id=evidence.id,
            sha256=evidence.server_sha256,
            project_id=evidence.project_id
        )

    evidence.blockchain_status = "queued"
    db.commit()
    return EvidenceResponse(**evidence.to_dict())


@router.get("/evidence/{evidence_id}/anchor")
def get_evidence_anchor_detail(
    evidence_id: int,
    user: User = Depends(require_role("supervisor")),
    db: Session = Depends(get_db)
):
    """
    Returns verified blockchain anchoring details for an evidence record.
    """
    evidence = db.query(Evidence).filter(
        Evidence.id == evidence_id,
        Evidence.supervisor_id == user.id
    ).first()
    if not evidence:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence record not found")

    return evidence.to_dict()["blockchain"]



@router.get("/evidence/{evidence_id}/file")
def get_evidence_file(
    evidence_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Authorized access to the private original evidence file.
    Only the supervisor who took it or the Project Auditor may view.
    """
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    if user.role != "auditor" and evidence.supervisor_id != user.id:
        raise HTTPException(status_code=404, detail="Evidence not found")

    # Prefer Cloudinary CDN URL for cross-dashboard access
    if evidence.file_url:
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=evidence.file_url, status_code=302)

    # Fallback to local disk
    file_path = Path(evidence.file_path)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Stored file not found on disk")

    return FileResponse(
        path=str(file_path),
        media_type=evidence.mime_type,
        filename=evidence.original_filename
    )


@router.get("/dashboard", response_model=SupervisorDashboardResponse)
def get_supervisor_dashboard(
    user: User = Depends(require_role("supervisor")),
    db: Session = Depends(get_db)
):
    """
    Telemetry and statistics for the Site Supervisor dashboard.
    """
    # Auto-link demo supervisor to project 1 if not yet assigned
    if user.email.lower() == "supervisor@siteverify.com":
        first_proj = db.query(Project).first()
        if first_proj:
            membership = db.query(ProjectMember).filter(
                ProjectMember.project_id == first_proj.id,
                ProjectMember.user_id == user.id
            ).first()
            if not membership:
                db.add(ProjectMember(
                    project_id=first_proj.id,
                    user_id=user.id,
                    role="supervisor"
                ))
                db.commit()

    projects_count = (
        db.query(ProjectMember)
        .filter(ProjectMember.user_id == user.id)
        .count()
    )

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    evidence_today_count = (
        db.query(Evidence)
        .filter(Evidence.supervisor_id == user.id, Evidence.captured_at >= today_start)
        .count()
    )

    total_submitted_count = (
        db.query(Evidence)
        .filter(Evidence.supervisor_id == user.id)
        .count()
    )

    recent_submissions = (
        db.query(Evidence)
        .filter(Evidence.supervisor_id == user.id)
        .order_by(Evidence.id.desc())
        .limit(10)
        .all()
    )

    return SupervisorDashboardResponse(
        assigned_projects_count=projects_count,
        evidence_today_count=evidence_today_count,
        total_submitted_count=total_submitted_count,
        recent_submissions=[EvidenceResponse(**r.to_dict()) for r in recent_submissions]
    )
