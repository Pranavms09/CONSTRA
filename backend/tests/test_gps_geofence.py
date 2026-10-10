import io
import math
import os
import json
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from PIL import Image, ExifTags

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app.models.user import User
from app.models.project import Project, ProjectMember
from app.models.alert import Alert
from app.models.image_analysis import ImageAnalysis
from app.checks.exif_gps_analyzer import (
    haversine_distance_m,
    verify_gps_geofence,
    extract_gps,
    extract_gps_with_reason,
    analyze_exif_gps,
    SECURITY_DISCLAIMER,
)

from sqlalchemy.pool import StaticPool

# Test in-memory SQLite database
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

client = TestClient(app)



def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def decimal_to_dms(deg_float: float):
    """Convert decimal degrees into (degrees, minutes, seconds) tuple."""
    deg = int(abs(deg_float))
    min_float = (abs(deg_float) - deg) * 60.0
    minute = int(min_float)
    sec = (min_float - minute) * 60.0
    return (float(deg), float(minute), round(sec, 4))


def create_jpeg_with_gps(lat: float, lon: float, filename: str = "test_img.jpg") -> bytes:
    """Create a genuine JPEG with EXIF GPS tags using Pillow."""
    img = Image.new("RGB", (64, 64), color="blue")
    exif = img.getexif()
    gps_ifd = exif.get_ifd(ExifTags.IFD.GPSInfo)

    lat_dms = decimal_to_dms(lat)
    lon_dms = decimal_to_dms(lon)

    gps_ifd[1] = "N" if lat >= 0 else "S"
    gps_ifd[2] = lat_dms
    gps_ifd[3] = "E" if lon >= 0 else "W"
    gps_ifd[4] = lon_dms

    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    return buf.getvalue()


def create_jpeg_without_gps() -> bytes:
    """Create a genuine JPEG without any GPS metadata."""
    img = Image.new("RGB", (64, 64), color="green")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db

    db = TestingSessionLocal()
    # Create project with registered centroid and 200m permitted radius
    project = Project(
        id=1,
        name="Sector 62 Commercial Tower",
        site_address="Sector 62, Noida",
        centroid_lat=28.6280,
        centroid_lng=77.3649,
        site_radius_m=200.0,
    )
    db.add(project)

    # Demo users
    supervisor = User(
        id=1,
        email="supervisor@siteverify.com",
        full_name="Alice Supervisor",
        role="supervisor",
        is_active=True,
        firebase_uid="uid_supervisor",
    )
    auditor = User(
        id=2,
        email="auditor@siteverify.com",
        full_name="Carol Auditor",
        role="auditor",
        is_active=True,
        firebase_uid="uid_auditor",
    )
    db.add_all([supervisor, auditor])
    db.flush()

    db.add(ProjectMember(project_id=1, user_id=1, role="supervisor"))
    db.add(ProjectMember(project_id=1, user_id=2, role="auditor"))
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.pop(get_db, None)


# ---------------------------------------------------------------------------
# 1. Haversine Distance & Boundary Calculations
# ---------------------------------------------------------------------------

def test_haversine_distance_identical_points():
    """Distance between identical coordinates must be 0 metres."""
    dist = haversine_distance_m(28.6280, 77.3649, 28.6280, 77.3649)
    assert dist == 0.0


def test_haversine_distance_known_baseline():
    """Distance between Noida site and Delhi Connaught Place (~15km)."""
    dist = haversine_distance_m(28.6280, 77.3649, 28.6315, 77.2167)
    assert 14000 < dist < 15000


def test_boundary_distance_calculations():
    """
    Test exact boundary-distance calculations:
    - Points <= 200m must return PASS
    - Points > 200m must return FLAGGED
    """
    center_lat = 28.6280
    center_lng = 77.3649
    site_radius = 200.0

    # Approx 1 degree latitude = 111,000 metres
    # 100 metres north: delta_lat = 100 / 111000 ~= 0.0009009
    lat_inside = center_lat + (100.0 / 111000.0)
    dist_inside = haversine_distance_m(lat_inside, center_lng, center_lat, center_lng)
    assert dist_inside < site_radius

    # 199 metres north: right inside boundary
    lat_boundary_in = center_lat + (195.0 / 111000.0)
    dist_boundary_in = haversine_distance_m(lat_boundary_in, center_lng, center_lat, center_lng)
    assert dist_boundary_in <= site_radius

    # 205 metres north: just outside boundary
    lat_boundary_out = center_lat + (205.0 / 111000.0)
    dist_boundary_out = haversine_distance_m(lat_boundary_out, center_lng, center_lat, center_lng)
    assert dist_boundary_out > site_radius


# ---------------------------------------------------------------------------
# 2. Image Inside the Geofence
# ---------------------------------------------------------------------------

def test_image_inside_geofence(tmp_path):
    """Photo within 200m radius must return PASS and not raise alert."""
    # Create image ~50m from project centroid
    img_bytes = create_jpeg_with_gps(28.6283, 77.3651)
    img_file = tmp_path / "inside_photo.jpg"
    img_file.write_bytes(img_bytes)

    res = verify_gps_geofence(
        img_file,
        project_latitude=28.6280,
        project_longitude=77.3649,
        permitted_radius_m=200.0,
    )

    assert res["status"] == "PASS"
    assert res["gps_status"] == "PASS"
    assert res["distance_m"] < 200.0
    assert res["alert_required"] is False
    assert res["extracted_coordinates"] is not None
    assert "within the permitted 200.0m radius" in res["explanation"]
    assert "Metadata-based location verification" in res["security_disclaimer"]


@patch("app.services.gemini_service.get_gemini_api_key", return_value="dummy_key")
@patch("app.services.gemini_service.genai.Client")
def test_supervisor_upload_inside_geofence(mock_client, mock_key, tmp_path):
    """Uploading photo inside geofence stores PASS verification and raises no alert."""
    mock_resp = MagicMock()
    mock_resp.text = "Column foundation reinforced concrete verified."
    mock_client.return_value.models.generate_content.return_value = mock_resp

    img_bytes = create_jpeg_with_gps(28.6282, 77.3650)
    sup_headers = {"Authorization": "Bearer demo-supervisor"}

    response = client.post(
        "/api/analyze-image",
        headers=sup_headers,
        data={"project_id": 1},
        files={"file": ("inside_milestone.jpg", io.BytesIO(img_bytes), "image/jpeg")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["gps_verification"]["status"] == "PASS"
    assert data["gps_verification"]["distance_m"] < 200.0
    assert data["alert_id"] is None

    # Verify database persistence
    db = TestingSessionLocal()
    analysis = db.query(ImageAnalysis).filter(ImageAnalysis.id == data["id"]).first()
    assert analysis is not None
    assert analysis.gps_status == "PASS"
    assert analysis.project_id == 1
    assert analysis.gps_distance_m < 200.0
    assert analysis.alert_id is None
    db.close()


# ---------------------------------------------------------------------------
# 3. Image Outside the Geofence (Breach & HIGH Alert Generation)
# ---------------------------------------------------------------------------

def test_image_outside_geofence(tmp_path):
    """Photo outside 200m radius must return FLAGGED and mark alert_required=True."""
    # Coordinates in Delhi (~15km away)
    img_bytes = create_jpeg_with_gps(28.6315, 77.2167)
    img_file = tmp_path / "outside_photo.jpg"
    img_file.write_bytes(img_bytes)

    res = verify_gps_geofence(
        img_file,
        project_latitude=28.6280,
        project_longitude=77.3649,
        permitted_radius_m=200.0,
    )

    assert res["status"] == "FLAGGED"
    assert res["gps_status"] == "FLAGGED"
    assert res["distance_m"] > 200.0
    assert res["alert_required"] is True
    assert res["severity"] == "high"
    assert "GEOFENCE BREACH" in res["explanation"]


@patch("app.services.gemini_service.get_gemini_api_key", return_value="dummy_key")
@patch("app.services.gemini_service.genai.Client")
def test_supervisor_upload_outside_geofence_creates_high_alert(mock_client, mock_key):
    """Uploading photo outside geofence generates HIGH severity verification alert."""
    mock_resp = MagicMock()
    mock_resp.text = "Excavation trench visual inspection."
    mock_client.return_value.models.generate_content.return_value = mock_resp

    img_bytes = create_jpeg_with_gps(28.6500, 77.3900)  # ~3.4km away
    sup_headers = {"Authorization": "Bearer demo-supervisor"}

    response = client.post(
        "/api/analyze-image",
        headers=sup_headers,
        data={"project_id": 1, "stage_id": 3},
        files={"file": ("breached_milestone.jpg", io.BytesIO(img_bytes), "image/jpeg")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["gps_verification"]["status"] == "FLAGGED"
    assert data["gps_verification"]["alert_required"] is True
    assert data["alert_id"] is not None

    # Check alert stored in database with high severity
    db = TestingSessionLocal()
    alert = db.query(Alert).filter(Alert.id == data["alert_id"]).first()
    assert alert is not None
    assert alert.type == "GEOFENCE_BREACH"
    assert alert.severity == "high"
    assert alert.status == "open"
    assert "GEOFENCE BREACH" in alert.explanation

    # Check ImageAnalysis stored
    analysis = db.query(ImageAnalysis).filter(ImageAnalysis.id == data["id"]).first()
    assert analysis.gps_status == "FLAGGED"
    assert analysis.alert_id == alert.id
    db.close()


# ---------------------------------------------------------------------------
# 4. Missing GPS Metadata
# ---------------------------------------------------------------------------

def test_missing_gps_metadata(tmp_path):
    """Missing GPS metadata must return REVIEW without falsely passing location."""
    img_bytes = create_jpeg_without_gps()
    img_file = tmp_path / "no_gps.jpg"
    img_file.write_bytes(img_bytes)

    res = verify_gps_geofence(
        img_file,
        project_latitude=28.6280,
        project_longitude=77.3649,
        permitted_radius_m=200.0,
    )

    assert res["status"] == "REVIEW"
    assert res["gps_status"] == "REVIEW"
    assert res["extracted_coordinates"] is None
    assert res["distance_m"] is None
    assert res["alert_required"] is False
    assert "No EXIF GPS tags found" in res["explanation"]
    assert "Metadata-based location verification" in res["security_disclaimer"]


@patch("app.services.gemini_service.get_gemini_api_key", return_value="dummy_key")
@patch("app.services.gemini_service.genai.Client")
def test_supervisor_upload_missing_gps_returns_review(mock_client, mock_key):
    """Upload without GPS returns REVIEW and does not treat missing GPS as valid."""
    mock_resp = MagicMock()
    mock_resp.text = "Steel rebar mesh inspection."
    mock_client.return_value.models.generate_content.return_value = mock_resp

    img_bytes = create_jpeg_without_gps()
    sup_headers = {"Authorization": "Bearer demo-supervisor"}

    response = client.post(
        "/api/analyze-image",
        headers=sup_headers,
        data={"project_id": 1},
        files={"file": ("no_gps_photo.jpg", io.BytesIO(img_bytes), "image/jpeg")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["gps_verification"]["status"] == "REVIEW"
    assert data["gps_verification"]["extracted_coordinates"] is None
    assert data["gps_verification"]["distance_m"] is None
    assert data["alert_id"] is None


# ---------------------------------------------------------------------------
# 5. Invalid GPS Metadata
# ---------------------------------------------------------------------------

def test_invalid_gps_coordinates_out_of_range():
    """Latitude > 90° or longitude > 180° must return REVIEW and explain why."""
    mock_exif = {
        "GPSInfo": {
            ExifTags.GPSTAGS[1]: "N",
            ExifTags.GPSTAGS[2]: (120.0, 0.0, 0.0),  # Latitude 120° is invalid
            ExifTags.GPSTAGS[3]: "E",
            ExifTags.GPSTAGS[4]: (77.0, 20.0, 0.0),
        }
    }
    coords, reason = extract_gps_with_reason(mock_exif)
    assert coords is None
    assert "outside valid geographical range" in reason


def test_invalid_gps_hemisphere_reference():
    """Invalid hemisphere reference (e.g. 'X') must return REVIEW."""
    mock_exif = {
        "GPSInfo": {
            ExifTags.GPSTAGS[1]: "X",
            ExifTags.GPSTAGS[2]: (28.0, 0.0, 0.0),
            ExifTags.GPSTAGS[3]: "E",
            ExifTags.GPSTAGS[4]: (77.0, 0.0, 0.0),
        }
    }
    coords, reason = extract_gps_with_reason(mock_exif)
    assert coords is None
    assert "Invalid GPSLatitudeRef" in reason


def test_invalid_gps_zero_division():
    """Denominator = 0 in rational tags must be handled safely without crashing."""
    class RationalZero:
        numerator = 28
        denominator = 0

    mock_exif = {
        "GPSInfo": {
            ExifTags.GPSTAGS[1]: "N",
            ExifTags.GPSTAGS[2]: (RationalZero(), 0.0, 0.0),
            ExifTags.GPSTAGS[3]: "E",
            ExifTags.GPSTAGS[4]: (77.0, 0.0, 0.0),
        }
    }
    coords, reason = extract_gps_with_reason(mock_exif)
    assert coords is None
    assert "denominator: 0" in reason or "Invalid GPS metadata" in reason


# ---------------------------------------------------------------------------
# 6. Malformed Files & Error Handling
# ---------------------------------------------------------------------------

def test_malformed_file_handling(tmp_path):
    """Malformed non-image file must return REVIEW safely without unhandled exception."""
    bad_file = tmp_path / "corrupted.jpg"
    bad_file.write_bytes(b"\x00\x01\x02\x03CORRUPTED_BLOB_NOT_AN_IMAGE")

    res = verify_gps_geofence(
        bad_file,
        project_latitude=28.6280,
        project_longitude=77.3649,
        permitted_radius_m=200.0,
    )
    assert res["status"] == "REVIEW"
    assert "Unable to read image EXIF metadata" in res["explanation"]


# ---------------------------------------------------------------------------
# 7. Server-Side Project Authorization Enforcement
# ---------------------------------------------------------------------------

def test_project_authorization_enforced_on_server():
    """Supervisors attempting to upload to an unauthorized project are rejected with 403."""
    db = TestingSessionLocal()
    # Create project 99 where supervisor (user 1) is not a member
    unauth_project = Project(
        id=99,
        name="Restricted Government Bridge",
        centroid_lat=12.9716,
        centroid_lng=77.5946,
        site_radius_m=200.0,
    )
    db.add(unauth_project)
    db.commit()
    db.close()

    img_bytes = create_jpeg_with_gps(12.9716, 77.5946)
    sup_headers = {"Authorization": "Bearer demo-supervisor"}

    response = client.post(
        "/api/analyze-image",
        headers=sup_headers,
        data={"project_id": 99},
        files={"file": ("unauth_test.jpg", io.BytesIO(img_bytes), "image/jpeg")},
    )
    assert response.status_code == 403
    assert "not authorized for project ID 99" in response.json()["detail"]


# ---------------------------------------------------------------------------
# 8. Auditor Alert Review & Resolution with Mandatory Justification
# ---------------------------------------------------------------------------

def test_auditor_resolves_geofence_alert_with_mandatory_justification():
    """Auditor reviews and resolves geofence alert with recorded justification, actor, and timestamp."""
    db = TestingSessionLocal()
    alert = Alert(
        project_id=1,
        type="GEOFENCE_BREACH",
        severity="high",
        status="open",
        explanation="Photo GPS coordinates 28.6500, 77.3900 are 3400m from project centroid, exceeding permitted 200m radius.",
    )
    db.add(alert)
    db.commit()
    alert_id = alert.id
    db.close()

    aud_headers = {"Authorization": "Bearer demo-auditor"}

    # Attempt to resolve without justification -> 422
    res_fail = client.patch(
        f"/store/alerts/{alert_id}",
        headers=aud_headers,
        json={"status": "resolved", "justification": ""},
    )
    assert res_fail.status_code == 422

    # Attempt to resolve with too-short justification -> 422
    res_fail_short = client.patch(
        f"/store/alerts/{alert_id}",
        headers=aud_headers,
        json={"status": "resolved", "justification": "ok"},
    )
    assert res_fail_short.status_code == 422

    # Valid resolution with written justification -> 200 OK
    res_pass = client.patch(
        f"/store/alerts/{alert_id}",
        headers=aud_headers,
        json={
            "status": "resolved",
            "justification": "Off-site auxiliary precast fabrication yard verified by Chief Resident Engineer.",
        },
    )
    assert res_pass.status_code == 200
    data = res_pass.json()
    assert data["status"] == "resolved"
    assert "Carol Auditor" in data["auditor_comment"]
    assert "Off-site auxiliary precast" in data["auditor_comment"]

    # Verify resolution on /api/v1/alerts endpoint as well
    res_pass_v1 = client.patch(
        f"/api/v1/alerts/{alert_id}",
        headers=aud_headers,
        json={
            "status": "resolved",
            "justification": "Re-verified with physical surveyor boundary logbook.",
        },
    )
    assert res_pass_v1.status_code == 200
    assert res_pass_v1.json()["status"] == "resolved"
