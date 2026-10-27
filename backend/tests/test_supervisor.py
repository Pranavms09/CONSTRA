import io
import hashlib
from datetime import datetime, timezone
from PIL import Image
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal, engine, Base
from app.models.user import User
from app.models.project import Project, ProjectMember, Stage
from app.models.evidence import Evidence
from app.models.alert import Alert


from app.services.firestore_db import set_firestore_client
from tests.chain.mock_firestore import MockFirestoreClient


@pytest.fixture(autouse=True)
def setup_mock_firestore():
    mock = MockFirestoreClient()
    set_firestore_client(mock)
    yield mock
    set_firestore_client(None)


@pytest.fixture(autouse=True)
def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        proj = db.query(Project).filter(Project.id == 1).first()
        if not proj:
            proj = Project(
                id=1,
                name="Pune Vidyarthi Griha's College of Engineering, Nashik",
                site_address="206, Dindori Road, Mhasrul, Nashik, Maharashtra 422004",
                centroid_lat=20.03639,
                centroid_lng=73.79959,
                site_radius_m=500.0,
            )
            db.add(proj)
            db.flush()
        stg = db.query(Stage).filter(Stage.id == 1).first()
        if not stg:
            stg = Stage(
                id=1,
                project_id=1,
                name="STAGE #02: STRUCTURAL SLAB CONCRETE CASTING & REBAR BINDING",
                order=2,
                status="in_progress",
            )
            db.add(stg)
        db.commit()
    finally:
        db.close()
    yield



@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_dummy_jpeg():
    img = Image.new("RGB", (100, 100), color=(252, 188, 24))  # signal yellow
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_supervisor_role_restriction(client):
    """Store in-charge and Auditor should be forbidden from accessing supervisor endpoints."""
    # Store keeper
    resp = client.get("/supervisor/projects", headers={"Authorization": "Bearer demo-store"})
    assert resp.status_code == 403

    # Auditor
    resp = client.get("/supervisor/projects", headers={"Authorization": "Bearer demo-auditor"})
    assert resp.status_code == 403

    # Anonymous (missing required header returns 422 in FastAPI or 401)
    resp = client.get("/supervisor/projects")
    assert resp.status_code in [401, 403, 422]


def test_supervisor_projects_and_stages(client):
    """Supervisor can list assigned projects and stages."""
    resp = client.get("/supervisor/projects", headers={"Authorization": "Bearer demo-supervisor"})
    assert resp.status_code == 200
    projects = resp.json()
    assert len(projects) > 0
    project_id = projects[0]["id"]

    stages_resp = client.get(f"/supervisor/projects/{project_id}/stages", headers={"Authorization": "Bearer demo-supervisor"})
    assert stages_resp.status_code == 200
    stages = stages_resp.json()
    assert len(stages) > 0
    assert "name" in stages[0]
    assert "status" in stages[0]


def test_submit_evidence_within_radius_and_idempotency(client):
    """Supervisor submits evidence within site radius, server calculates SHA-256 and validates integrity."""
    img_bytes = create_dummy_jpeg()
    sha256_hash = hashlib.sha256(img_bytes).hexdigest()
    device_id = f"dev-test-{int(datetime.now().timestamp())}"

    # Project centroid is 20.03639, 73.79959
    files = {"file": ("test_site_evidence.jpg", img_bytes, "image/jpeg")}
    data = {
        "device_evidence_id": device_id,
        "project_id": 1,
        "stage_id": 1,
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 20.0364,  # ~2 meters away
        "longitude": 73.7996,
        "accuracy_m": 4.5,
        "client_sha256": sha256_hash,
        "notes": "Foundation rebar inspection"
    }

    resp = client.post(
        "/supervisor/evidence",
        files=files,
        data=data,
        headers={"Authorization": "Bearer demo-supervisor"}
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["device_evidence_id"] == device_id
    assert body["server_sha256"] == sha256_hash
    assert body["hash_matched"] is True
    assert body["is_within_radius"] is True
    assert body["radius_warning"] is False
    assert body["status"] == "VERIFIED_SUBMITTED"

    # Test Idempotency: submitting same device_evidence_id returns existing record without error
    retry_resp = client.post(
        "/supervisor/evidence",
        files=files,
        data=data,
        headers={"Authorization": "Bearer demo-supervisor"}
    )
    assert retry_resp.status_code == 200
    assert retry_resp.json()["id"] == body["id"]


def test_submit_evidence_out_of_radius_creates_alert(client, db_session):
    """Submitting evidence far from site triggers radius_warning and creates GEOFENCE_VIOLATION alert."""
    img_bytes = create_dummy_jpeg()
    sha256_hash = hashlib.sha256(img_bytes).hexdigest()
    device_id = f"dev-far-{int(datetime.now().timestamp())}"

    # Lat 21.5000 is ~160 km away from Nashik site (20.0364)
    files = {"file": ("out_of_site.jpg", img_bytes, "image/jpeg")}
    data = {
        "device_evidence_id": device_id,
        "project_id": 1,
        "stage_id": 1,
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 21.5000,
        "longitude": 73.7996,
        "accuracy_m": 5.0,
        "client_sha256": sha256_hash,
        "notes": "Testing geofence alert"
    }

    resp = client.post(
        "/supervisor/evidence",
        files=files,
        data=data,
        headers={"Authorization": "Bearer demo-supervisor"}
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["is_within_radius"] is False
    assert body["radius_warning"] is True
    assert body["distance_to_site_m"] > 1000.0

    # Verify Alert was created in database
    alert = db_session.query(Alert).filter(
        Alert.type == "GEOFENCE_VIOLATION",
        Alert.photo_id == body["id"]
    ).first()
    assert alert is not None
    assert alert.severity == "medium"


def test_submit_evidence_hash_mismatch(client, db_session):
    """If client claims incorrect hash, server detects mismatch and records alert."""
    img_bytes = create_dummy_jpeg()
    device_id = f"dev-tamper-{int(datetime.now().timestamp())}"

    files = {"file": ("tampered.jpg", img_bytes, "image/jpeg")}
    data = {
        "device_evidence_id": device_id,
        "project_id": 1,
        "stage_id": 1,
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 20.03639,
        "longitude": 73.79959,
        "accuracy_m": 3.0,
        "client_sha256": "0" * 64,  # Fake hash
        "notes": "Tampered test"
    }

    resp = client.post(
        "/supervisor/evidence",
        files=files,
        data=data,
        headers={"Authorization": "Bearer demo-supervisor"}
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["hash_matched"] is False
    assert body["status"] == "HASH_MISMATCH_SUSPICIOUS"

    # Verify Alert in DB
    alert = db_session.query(Alert).filter(
        Alert.type == "HASH_MISMATCH",
        Alert.photo_id == body["id"]
    ).first()
    assert alert is not None
    assert alert.severity == "critical"


def test_supervisor_history_and_dashboard(client):
    """Supervisor can retrieve submission history and dashboard metrics."""
    resp = client.get("/supervisor/evidence", headers={"Authorization": "Bearer demo-supervisor"})
    assert resp.status_code == 200
    evidence_list = resp.json()
    assert isinstance(evidence_list, list)

    dash_resp = client.get("/supervisor/dashboard", headers={"Authorization": "Bearer demo-supervisor"})
    assert dash_resp.status_code == 200
    dash = dash_resp.json()
    assert "assigned_projects_count" in dash
    assert "evidence_today_count" in dash
    assert "total_submitted_count" in dash
    assert "recent_submissions" in dash
