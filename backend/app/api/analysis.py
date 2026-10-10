from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.project import Project
from app.services.alerts import raise_alert
from app.checks.exif_gps_analyzer import analyze_exif_gps

router = APIRouter(prefix="/api/v1", tags=["Analysis"])

# Fallback project registry for legacy demonstration keys
DEMO_PROJECTS = {
    "project-001": {
        "latitude": 12.9716,
        "longitude": 77.5946,
        "site_radius_m": 200.0,
        "max_capture_age_hours": 24.0,
    }
}

UPLOAD_DIRECTORY = Path("uploads")


@router.get("/projects/{project_id}/evidence/{file_name}/exif-gps")
def get_exif_gps_report(
    project_id: str,
    file_name: str,
    db: Session = Depends(get_db),
):
    # Retrieve authoritative project from backend database (Requirement 2 & 10)
    db_project = None
    if project_id.isdigit():
        db_project = db.query(Project).filter(Project.id == int(project_id)).first()
    else:
        db_project = db.query(Project).filter(Project.name.ilike(f"%{project_id}%")).first()

    if db_project:
        site_lat = db_project.centroid_lat if db_project.centroid_lat is not None else 28.6280
        site_lng = db_project.centroid_lng if db_project.centroid_lng is not None else 77.3649
        site_radius = db_project.site_radius_m if (db_project.site_radius_m and db_project.site_radius_m > 0) else 200.0
        max_capture_age = 48.0
        project_obj = db_project
    elif project_id in DEMO_PROJECTS:
        demo = DEMO_PROJECTS[project_id]
        site_lat = demo["latitude"]
        site_lng = demo["longitude"]
        site_radius = demo.get("site_radius_m", 200.0)
        max_capture_age = demo.get("max_capture_age_hours", 24.0)
        project_obj = None
    else:
        raise HTTPException(status_code=404, detail="Project not found")


    # Prevent directory traversal; only allow a filename.
    if Path(file_name).name != file_name:
        raise HTTPException(status_code=400, detail="Invalid filename")

    file_path = UPLOAD_DIRECTORY / file_name

    if not file_path.is_file():
        # Check backend/uploads as well in case running from root
        alt_path = Path("backend") / "uploads" / file_name
        if alt_path.is_file():
            file_path = alt_path
        else:
            raise HTTPException(status_code=404, detail="Evidence file not found")

    try:
        report = analyze_exif_gps(
            file_path,
            site_latitude=site_lat,
            site_longitude=site_lng,
            uploaded_at=datetime.now(timezone.utc),
            site_radius_m=site_radius,
            max_capture_age_hours=max_capture_age,
        )

        # If breached outside permitted radius, create a HIGH severity verification alert (Requirement 5)
        if project_obj and report.get("gps_verification", {}).get("alert_required"):
            try:
                raise_alert(
                    db,
                    project_id=project_obj.id,
                    stage_id=None,
                    photo_id=None,
                    type="GEOFENCE_BREACH",
                    severity="high",
                    explanation=report["gps_verification"]["explanation"],
                    evidence={
                        "gps_verification": report["gps_verification"],
                        "filename": file_name,
                        "project_id": project_obj.id,
                        "disclaimer": report.get("disclaimer"),
                    }
                )
            except Exception:
                pass

        return report

    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=422,
            detail="Unable to read evidence file",
        ) from exc

