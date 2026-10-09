from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from app.checks.exif_gps_analyzer import analyze_exif_gps

router = APIRouter(prefix="/api/v1", tags=["Analysis"])

# DEMO ONLY: replace this with your database-backed project lookup.
DEMO_PROJECTS = {
    "project-001": {
        "latitude": 12.9716,
        "longitude": 77.5946,
        "site_radius_m": 200,
        "max_capture_age_hours": 24,
    }
}

# DEMO ONLY: replace this with authorized database evidence records.
UPLOAD_DIRECTORY = Path("uploads")


@router.get("/projects/{project_id}/evidence/{file_name}/exif-gps")
def get_exif_gps_report(
    project_id: str,
    file_name: str,
):
    project = DEMO_PROJECTS.get(project_id)

    if not project:
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
            site_latitude=project["latitude"],
            site_longitude=project["longitude"],
            uploaded_at=datetime.now(timezone.utc),
            site_radius_m=project["site_radius_m"],
            max_capture_age_hours=project["max_capture_age_hours"],
        )
        return report

    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=422,
            detail="Unable to read evidence file",
        ) from exc
