import io
import json
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from PIL import Image

from app.database import Base, get_db
from app.models.user import User
from app.models.project import Project, ProjectMember, Stage
from app.models.material import Material, Vendor, BoqItem
from app.models.challan import Challan, ChallanItem
from app.models.alert import Alert
from app.models.audit_log import AuditLog
from app.models.certificate import ClearanceCertificate
from app.main import app

# Test SQLite in-memory DB
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


def create_sample_png() -> bytes:
    img = Image.new("RGB", (60, 60), color="navy")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture(autouse=True)
def setup_workflow_database():
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    db = TestingSessionLocal()

    # Pre-seed users
    supervisor = User(
        email="supervisor@siteverify.com",
        full_name="Alice Supervisor",
        role="supervisor",
        is_active=True,
        firebase_uid="uid_supervisor",
        auth_provider="demo"
    )
    store = User(
        email="store@siteverify.com",
        full_name="Bob Storekeeper",
        role="store_incharge",
        is_active=True,
        firebase_uid="uid_store_incharge",
        auth_provider="demo"
    )
    auditor = User(
        email="auditor@siteverify.com",
        full_name="Carol Auditor",
        role="auditor",
        is_active=True,
        firebase_uid="uid_auditor",
        auth_provider="demo"
    )
    db.add_all([supervisor, store, auditor])
    db.flush()

    # Seed Project 1
    proj = Project(
        name="Apex Tower — Commercial Block A",
        site_address="Sector 62, Noida, Uttar Pradesh",
        centroid_lat=28.6280,
        centroid_lng=77.3649,
        site_radius_m=350.0
    )
    db.add(proj)
    db.flush()

    # Project memberships
    db.add(ProjectMember(project_id=proj.id, user_id=supervisor.id, role="supervisor"))
    db.add(ProjectMember(project_id=proj.id, user_id=store.id, role="store_incharge"))
    db.add(ProjectMember(project_id=proj.id, user_id=auditor.id, role="auditor"))

    # Project settings
    from decimal import Decimal
    from app.models.project import ProjectSettings
    from app.models.material import UnitConversion

    settings = ProjectSettings(
        project_id=proj.id,
        boq_tolerance_pct=Decimal("5.0"),
        expected_usage_tolerance=Decimal("0.15"),
        zscore_limit=Decimal("2.5"),
    )
    db.add(settings)

    # Seed Stages
    stg1 = Stage(project_id=proj.id, name="Substructure / Foundation", order=1, status="COMPLETED", verified_progress=1.0)
    stg2 = Stage(project_id=proj.id, name="Ground Floor RCC Slab", order=2, status="COMPLETED", verified_progress=1.0)
    stg3 = Stage(project_id=proj.id, name="First Floor Columns & Beams", order=3, status="UNDER_REVIEW", verified_progress=0.4)
    db.add_all([stg1, stg2, stg3])
    db.flush()

    # Seed Material & Vendor
    cement = Material(name="OPC 53 Cement", base_unit="kg", description="53 Grade Cement")
    vendor = Vendor(name="UltraTech Building Solutions", is_approved=True)
    db.add_all([cement, vendor])
    db.flush()

    u1 = UnitConversion(material_id=cement.id, unit="bag", factor_to_base=Decimal("50.0"))
    u2 = UnitConversion(material_id=cement.id, unit="kg", factor_to_base=Decimal("1.0"))
    db.add_all([u1, u2])

    boq = BoqItem(
        project_id=proj.id,
        stage_id=stg3.id,
        material_id=cement.id,
        planned_qty=Decimal("15000.0"),
        unit="kg",
        planned_qty_base=Decimal("15000.0"),
    )
    db.add(boq)

    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)


# ---------------------------------------------------------------------------
# 1. Authentication & Role Separation Tests
# ---------------------------------------------------------------------------

def test_role_based_access_controls():
    """Verify separate authorization per role: Supervisor, Store, Auditor."""
    sup_headers = {"Authorization": "Bearer demo-supervisor"}
    store_headers = {"Authorization": "Bearer demo-store"}
    aud_headers = {"Authorization": "Bearer demo-auditor"}
    bad_headers = {"Authorization": "Bearer invalid-token"}

    # Ping endpoint access
    assert client.get("/supervisor/ping", headers=sup_headers).status_code == 200
    assert client.get("/supervisor/ping", headers=store_headers).status_code == 403
    assert client.get("/supervisor/ping", headers=aud_headers).status_code == 403
    assert client.get("/supervisor/ping", headers=bad_headers).status_code == 401

    assert client.get("/store/ping", headers=store_headers).status_code == 200
    assert client.get("/store/ping", headers=sup_headers).status_code == 403

    assert client.get("/auditor/ping", headers=aud_headers).status_code == 200
    assert client.get("/auditor/ping", headers=sup_headers).status_code == 403
    assert client.get("/auditor/ping", headers=store_headers).status_code == 403


# ---------------------------------------------------------------------------
# 2. Supervisor Workflow: Photo Upload, Hash, Geofence, Duplicate Detection
# ---------------------------------------------------------------------------

@patch("app.services.gemini_service.get_gemini_api_key", return_value="dummy_key")
@patch("app.services.gemini_service.genai.Client")
def test_supervisor_photo_upload_and_duplicate_detection(mock_client_class, mock_key):
    mock_resp = MagicMock()
    mock_resp.text = "Visual Inspection: Reinforced concrete casting verified with rebar spacing compliant."
    mock_client_class.return_value.models.generate_content.return_value = mock_resp

    sup_headers = {"Authorization": "Bearer demo-supervisor"}
    png_bytes = create_sample_png()

    # First Upload
    res1 = client.post(
        "/api/analyze-image",
        headers=sup_headers,
        files={"file": ("milestone_evidence.png", io.BytesIO(png_bytes), "image/png")}
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["status"] == "success"
    assert data1["file_url"].startswith("/uploads/")
    assert data1["is_duplicate"] is False
    assert len(data1["file_hash"]) == 64

    # Duplicate Upload of identical file
    res2 = client.post(
        "/api/analyze-image",
        headers=sup_headers,
        files={"file": ("milestone_evidence_copy.png", io.BytesIO(png_bytes), "image/png")}
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["is_duplicate"] is True
    assert data2["file_hash"] == data1["file_hash"]


# ---------------------------------------------------------------------------
# 3. Store In-Charge to Auditor: Challan Visibility Across Devices
# ---------------------------------------------------------------------------

def test_store_challan_created_and_visible_to_auditor():
    store_headers = {"Authorization": "Bearer demo-store"}
    aud_headers = {"Authorization": "Bearer demo-auditor"}

    # Store creates manual challan draft
    draft_res = client.post("/store/projects/1/challans/manual", headers=store_headers)
    assert draft_res.status_code == 200
    challan_id = draft_res.json()["id"]

    # Store reviews and updates draft fields
    patch_res = client.patch(
        f"/store/challans/{challan_id}",
        headers=store_headers,
        json={
            "version": 1,
            "challan_no": "CH-TEST-9901",
            "items": [
                {
                    "material_id": 1,
                    "stage_id": 3,
                    "qty": 50.0,
                    "unit": "bag"
                }
            ]
        }
    )
    assert patch_res.status_code == 200
    new_version = patch_res.json()["version"]

    # Store confirms challan
    confirm_res = client.post(
        f"/store/challans/{challan_id}/confirm",
        headers=store_headers,
        json={"version": new_version}
    )
    assert confirm_res.status_code == 200
    assert confirm_res.json()["challan"]["status"] == "confirmed"

    # Auditor retrieves challans list
    aud_res = client.get("/store/projects/1/challans", headers=aud_headers)
    assert aud_res.status_code == 200
    items = aud_res.json()["items"]
    assert any(c["id"] == challan_id for c in items)

    # Auditor accesses specific challan detail
    detail_res = client.get(f"/store/challans/{challan_id}", headers=aud_headers)
    assert detail_res.status_code == 200
    assert detail_res.json()["challan_no"] == "CH-TEST-9901"


# ---------------------------------------------------------------------------
# 4. Auditor Milestone Approval Backend Enforcement
# ---------------------------------------------------------------------------

def test_supervisor_and_store_cannot_approve_milestone():
    """Supervisors and storekeepers must be strictly blocked from submitting approvals."""
    claim_payload = {
        "id": "CLM-TEST-001",
        "claimant": "Alice Supervisor",
        "project_id": "1",
        "stage_id": 3,
        "files": [{"name": "specimen.jpg", "kind": "photo"}],
        "decisions": {}
    }
    client.post("/api/v1/claims", headers={"Authorization": "Bearer demo-supervisor"}, json=claim_payload)

    approval_payload = {
        "verdict": "agree",
        "verdictNote": "Approved by supervisor attempt",
        "decisions": {}
    }

    # Supervisor attempt -> 403 Forbidden
    res_sup = client.post(
        "/api/v1/claims/CLM-TEST-001/submit",
        headers={"Authorization": "Bearer demo-supervisor"},
        json=approval_payload
    )
    assert res_sup.status_code == 403

    # Storekeeper attempt -> 403 Forbidden
    res_store = client.post(
        "/api/v1/claims/CLM-TEST-001/submit",
        headers={"Authorization": "Bearer demo-store"},
        json=approval_payload
    )
    assert res_store.status_code == 403


def test_self_approval_prevention():
    """Approver cannot be the milestone submitter."""
    claim_payload = {
        "id": "CLM-SELF-001",
        "claimant": "Carol Auditor",
        "submitter_email": "auditor@siteverify.com",
        "project_id": "1",
        "stage_id": 3,
        "files": [{"name": "specimen.jpg", "kind": "photo"}]
    }
    client.post("/api/v1/claims", json=claim_payload)

    approval_payload = {
        "verdict": "agree",
        "verdictNote": "Self approval attempt",
        "decisions": {}
    }

    res = client.post(
        "/api/v1/claims/CLM-SELF-001/submit",
        headers={"Authorization": "Bearer demo-auditor"},
        json=approval_payload
    )
    assert res.status_code == 403
    assert "Self-approval violation" in res.json()["detail"]


def test_rejection_requires_mandatory_written_reason():
    """Rejection requires minimum written justification."""
    claim_payload = {
        "id": "CLM-REJECT-001",
        "claimant": "Alice Supervisor",
        "project_id": "1",
        "stage_id": 3,
        "files": [{"name": "specimen.jpg", "kind": "photo"}]
    }
    client.post("/api/v1/claims", json=claim_payload)

    # Empty reason -> 422
    res_fail = client.post(
        "/api/v1/claims/CLM-REJECT-001/submit",
        headers={"Authorization": "Bearer demo-auditor"},
        json={"verdict": "reject", "verdictNote": "", "decisions": {}}
    )
    assert res_fail.status_code == 422

    # Valid reason -> 200 and FLAGGED status
    res_pass = client.post(
        "/api/v1/claims/CLM-REJECT-001/submit",
        headers={"Authorization": "Bearer demo-auditor"},
        json={"verdict": "reject", "verdictNote": "Concrete curing specimen failed compression threshold test.", "decisions": {}}
    )
    assert res_pass.status_code == 200
    assert res_pass.json()["report"]["status"] == "FLAGGED"


def test_approval_blocked_by_critical_alert_and_resolved_workflow():
    """Approval is blocked if open critical alerts remain, and passes after resolution."""
    db = TestingSessionLocal()
    alert = Alert(
        project_id=1,
        stage_id=3,
        type="CRITICAL_SAFETY_DEFECT",
        severity="critical",
        status="open",
        explanation="Structural core honeycombing observed on column C-4."
    )
    db.add(alert)
    db.commit()
    alert_id = alert.id
    db.close()

    claim_payload = {
        "id": "CLM-BLOCK-001",
        "claimant": "Alice Supervisor",
        "project_id": "1",
        "stage_id": 3,
        "files": [{"name": "specimen.jpg", "kind": "photo", "sha256": "a"*64}],
        "decisions": {}
    }
    client.post("/api/v1/claims", json=claim_payload)

    # Attempt approval while critical alert is open -> 422 Blocked
    res_block = client.post(
        "/api/v1/claims/CLM-BLOCK-001/submit",
        headers={"Authorization": "Bearer demo-auditor"},
        json={"verdict": "agree", "verdictNote": "Attempting signoff", "decisions": {}}
    )
    assert res_block.status_code == 422
    data_block = res_block.json()
    assert any("critical/high severity alert" in b for b in data_block["detail"]["blockers"])

    # Auditor resolves the alert with recorded justification
    res_resolve = client.patch(
        f"/store/alerts/{alert_id}",
        headers={"Authorization": "Bearer demo-auditor"},
        json={
            "status": "resolved",
            "justification": "Field epoxy grouting completed and non-destructive ultrasonic rebound testing passed."
        }
    )
    assert res_resolve.status_code == 200
    assert res_resolve.json()["status"] == "resolved"

    # Now attempt approval again -> Success! Milestone CLEARED & Certificate issued
    res_approve = client.post(
        "/api/v1/claims/CLM-BLOCK-001/submit",
        headers={"Authorization": "Bearer demo-auditor"},
        json={"verdict": "agree", "verdictNote": "Approved following verified remedial epoxy grouting.", "decisions": {}}
    )
    assert res_approve.status_code == 200
    appr_data = res_approve.json()
    assert "Milestone CLEARED" in appr_data["message"]
    assert "certificate" in appr_data
    cert_num = appr_data["certificate"]["certificate_number"]

    # Verify certificate retrieval
    res_cert = client.get("/api/v1/claims/CLM-BLOCK-001/certificate")
    assert res_cert.status_code == 200
    assert res_cert.json()["certificate_number"] == cert_num
    assert res_cert.json()["verdict"] == "CLEARED"
