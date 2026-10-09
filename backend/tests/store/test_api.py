import io
import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models.user import User
from app.models.project import Project, ProjectMember, ProjectSettings, Stage
from app.models.material import Material, UnitConversion, Vendor, BoqItem
from app.models.challan import Challan, ChallanItem
from app.main import app

# In-memory database for API test suite
engine = create_engine(
    "sqlite:///:memory:",
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


STORE_HEADERS = {"Authorization": "Bearer demo-store"}


@pytest.fixture
def client(setup_db):
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Create Storekeeper user
    store_user = User(
        email="store@siteverify.com",
        full_name="Bob Storekeeper",
        role="store_incharge",
        is_active=True,
        firebase_uid="uid_store",
        auth_provider="demo",
    )
    db.add(store_user)
    db.flush()

    # Project 1: User is a member
    proj = Project(name="Project Alpha", site_address="Zone 1")
    db.add(proj)
    db.flush()

    settings = ProjectSettings(
        project_id=proj.id,
        boq_tolerance_pct=Decimal("5.0"),
        expected_usage_tolerance=Decimal("0.15"),
        zscore_limit=Decimal("2.5"),
    )
    db.add(settings)

    member = ProjectMember(project_id=proj.id, user_id=store_user.id, role="store_incharge")
    db.add(member)

    # Project 2: User is NOT a member
    proj2 = Project(name="Project Secret Beta")
    db.add(proj2)
    db.flush()

    # Stage
    stage = Stage(project_id=proj.id, name="Foundation", order=1, verified_progress=Decimal("0.5"))
    db.add(stage)
    db.flush()

    # Vendor & Material
    vendor = Vendor(name="UltraTech Building Solutions", is_approved=True)
    db.add(vendor)
    db.flush()

    cement = Material(name="OPC 53 Cement", base_unit="kg")
    db.add(cement)
    db.flush()

    u1 = UnitConversion(material_id=cement.id, unit="bag", factor_to_base=Decimal("50.0"))
    u2 = UnitConversion(material_id=cement.id, unit="kg", factor_to_base=Decimal("1.0"))
    db.add_all([u1, u2])

    boq = BoqItem(
        project_id=proj.id,
        stage_id=stage.id,
        material_id=cement.id,
        planned_qty=Decimal("10000"),
        unit="kg",
        planned_qty_base=Decimal("10000"),
    )
    db.add(boq)
    db.commit()

    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)


def test_list_projects(client):
    res = client.get("/store/projects", headers=STORE_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["name"] == "Project Alpha"


def test_project_access_denied_returns_404(client):
    # Project 2 exists, but storekeeper is not a member -> must return 404
    res = client.get("/store/projects/2/stock-summary", headers=STORE_HEADERS)
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_stock_summary(client):
    res = client.get("/store/projects/1/stock-summary", headers=STORE_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    item = next(m for m in data if m["material_name"] == "OPC 53 Cement")
    assert item["received_base"] == 0.0
    assert item["issued_base"] == 0.0
    assert item["in_stock_base"] == 0.0


def test_upload_challan_and_review_flow(client, monkeypatch):
    # Set OCR_MODE to fake and patch SessionLocal to use test database
    from app.config import settings
    from PIL import Image
    monkeypatch.setattr(settings, "OCR_MODE", "fake")
    monkeypatch.setattr("app.routers.store.SessionLocal", TestingSessionLocal)

    # 1. Upload Challan with genuine image bytes
    buf = io.BytesIO()
    Image.new("RGB", (200, 200), color="white").save(buf, format="PNG")
    file_content = buf.getvalue()

    files = {"file": ("test_challan.png", io.BytesIO(file_content), "image/png")}
    res = client.post("/store/projects/1/challans", headers=STORE_HEADERS, files=files)
    assert res.status_code == 202
    data = res.json()
    challan_id = data["id"]

    # Retrieve processed challan
    get_res = client.get(f"/store/challans/{challan_id}", headers=STORE_HEADERS)
    assert get_res.status_code == 200
    challan_detail = get_res.json()
    assert challan_detail["status"] == "draft"
    version = challan_detail["version"]

    # 2. Patch Review (update challan number & line items)
    patch_payload = {
        "version": version,
        "challan_no": "CH-EDITED-001",
        "challan_date": "2024-06-15",
        "items": [
            {
                "material_id": 1,
                "qty": 50.0,
                "unit": "bag"
            }
        ]
    }
    patch_res = client.patch(f"/store/challans/{challan_id}", headers=STORE_HEADERS, json=patch_payload)
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["challan_no"] == "CH-EDITED-001"
    assert len(updated["items"]) == 1
    assert updated["items"][0]["qty_base"] == 2500.0  # 50 bags * 50 = 2500 kg

    # 3. Optimistic Locking Test (submitting with stale version returns 409)
    stale_payload = {
        "version": version,  # Old version
        "challan_no": "CH-CONFLICT",
        "items": [],
    }
    conflict_res = client.patch(f"/store/challans/{challan_id}", headers=STORE_HEADERS, json=stale_payload)
    assert conflict_res.status_code == 409

    # 4. Confirm Challan
    confirm_res = client.post(f"/store/challans/{challan_id}/confirm", headers=STORE_HEADERS)
    assert confirm_res.status_code == 200
    confirm_data = confirm_res.json()
    assert confirm_data["challan"]["status"] == "confirmed"
    assert "reconcile_summary" in confirm_data

    # 5. Check Stock Summary shows received stock
    stock_res = client.get("/store/projects/1/stock-summary", headers=STORE_HEADERS)
    assert stock_res.status_code == 200
    stock_data = stock_res.json()
    cement_stock = next(m for m in stock_data if m["material_name"] == "OPC 53 Cement")
    assert cement_stock["received_base"] == 2500.0
    assert cement_stock["in_stock_base"] == 2500.0


def test_issue_material_and_anomaly_handling(client):
    # 1. Preview issue: stage 1, cement 1, qty 7000 kg (planned 10,000, 50% verified progress -> expected 5000)
    preview_payload = {
        "stage_id": 1,
        "material_id": 1,
        "qty": 7000.0,
        "unit": "kg",
    }
    prev_res = client.post("/store/issue-preview", headers=STORE_HEADERS, json=preview_payload)
    assert prev_res.status_code == 200
    prev_data = prev_res.json()
    assert prev_data["is_anomalous"] is True

    # 2. Issue Material: Even though anomalous, system logs the issue and returns anomaly_flag=True
    issue_payload = {
        "material_id": 1,
        "qty": 7000.0,
        "unit": "kg",
        "issued_to": "Subcontractor Foreman John",
        "note": "Urgent slab pouring",
    }
    issue_res = client.post("/store/stages/1/material-issues", headers=STORE_HEADERS, json=issue_payload)
    assert issue_res.status_code == 201
    issue_data = issue_res.json()
    assert issue_data["anomaly_flag"] is True
    assert issue_data["anomaly_reasons"] is not None

    # 3. Check alerts endpoint returns the raised anomaly alert
    alerts_res = client.get("/store/projects/1/alerts", headers=STORE_HEADERS)
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()
    assert len(alerts) >= 1
    assert any("Issued more than expected" in a["explanation"] for a in alerts)
