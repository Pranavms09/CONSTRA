import pytest
from decimal import Decimal
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models.project import Project, ProjectSettings, Stage
from app.models.material import Material, UnitConversion, Vendor, BoqItem
from app.models.challan import Challan, ChallanItem
from app.models.alert import Alert
from app.services.store.reconcile import reconcile_challan

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    # Project with 5% tolerance
    proj = Project(
        name="Test Commercial Tower",
        start_date=date(2024, 1, 1),
        end_date=date(2025, 12, 31),
    )
    session.add(proj)
    session.flush()

    settings = ProjectSettings(
        project_id=proj.id,
        boq_tolerance_pct=Decimal("5.0"),
        allow_new_vendors=1,
    )
    session.add(settings)

    # Vendor: approved & unapproved
    v1 = Vendor(name="UltraTech Approved", is_approved=True)
    v2 = Vendor(name="Shady Traders", is_approved=False)
    session.add_all([v1, v2])
    session.flush()

    # Material: Cement with planned BOQ of 10,000 kg
    cement = Material(name="OPC 53 Cement", base_unit="kg")
    session.add(cement)
    session.flush()

    stg = Stage(project_id=proj.id, name="Foundation", order=1, verified_progress=Decimal("1.0"))
    session.add(stg)
    session.flush()

    boq = BoqItem(
        project_id=proj.id,
        stage_id=stg.id,
        material_id=cement.id,
        planned_qty=Decimal("10000"),
        unit="kg",
        planned_qty_base=Decimal("10000"),
    )
    session.add(boq)
    session.commit()

    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


def test_reconcile_within_tolerance(db):
    proj = db.query(Project).first()
    vendor = db.query(Vendor).filter(Vendor.name == "UltraTech Approved").first()
    cement = db.query(Material).first()

    # Challan with 10,200 kg delivered (within 5% tolerance of 10,000 kg)
    ch = Challan(
        project_id=proj.id,
        vendor_id=vendor.id,
        challan_no="CH-001",
        challan_date=date(2024, 6, 1),
        uploaded_by=1,
        file_path="/uploads/ch1.png",
        sha256="abc1",
        status="confirmed",
    )
    db.add(ch)
    db.flush()

    item = ChallanItem(
        challan_id=ch.id,
        material_id=cement.id,
        qty=Decimal("10200"),
        unit="kg",
        qty_base=Decimal("10200"),
    )
    db.add(item)
    db.commit()

    reconcile_summary = reconcile_challan(db, ch)
    assert len(reconcile_summary) == 1
    assert reconcile_summary[0]["status"] == "ok"
    assert reconcile_summary[0]["variance_pct"] == 2.0

    # No alerts raised
    alerts = db.query(Alert).filter(Alert.project_id == proj.id).all()
    assert len(alerts) == 0


def test_reconcile_over_delivery_raises_alert(db):
    proj = db.query(Project).first()
    vendor = db.query(Vendor).filter(Vendor.name == "UltraTech Approved").first()
    cement = db.query(Material).first()

    # Challan with 12,000 kg delivered (+20% > 5% tolerance)
    ch = Challan(
        project_id=proj.id,
        vendor_id=vendor.id,
        challan_no="CH-002",
        challan_date=date(2024, 6, 1),
        uploaded_by=1,
        file_path="/uploads/ch2.png",
        sha256="abc2",
        status="confirmed",
    )
    db.add(ch)
    db.flush()

    item = ChallanItem(
        challan_id=ch.id,
        material_id=cement.id,
        qty=Decimal("12000"),
        unit="kg",
        qty_base=Decimal("12000"),
    )
    db.add(item)
    db.commit()

    summary = reconcile_challan(db, ch)
    assert summary[0]["status"] == "over"

    alert = db.query(Alert).filter(Alert.project_id == proj.id, Alert.type == "boq_over_delivery").first()
    assert alert is not None
    assert alert.severity == "high"
    assert "exceeds BOQ planned limit" in alert.explanation


def test_reconcile_unapproved_vendor(db):
    proj = db.query(Project).first()
    unapproved = db.query(Vendor).filter(Vendor.name == "Shady Traders").first()
    cement = db.query(Material).first()

    ch = Challan(
        project_id=proj.id,
        vendor_id=unapproved.id,
        challan_no="CH-003",
        challan_date=date(2024, 6, 1),
        uploaded_by=1,
        file_path="/uploads/ch3.png",
        sha256="abc3",
        status="confirmed",
    )
    db.add(ch)
    db.flush()

    item = ChallanItem(
        challan_id=ch.id,
        material_id=cement.id,
        qty=Decimal("1000"),
        unit="kg",
        qty_base=Decimal("1000"),
    )
    db.add(item)
    db.commit()

    reconcile_challan(db, ch)

    alert = db.query(Alert).filter(Alert.project_id == proj.id, Alert.type == "unapproved_vendor").first()
    assert alert is not None
    assert "Shady Traders" in alert.explanation


def test_reconcile_duplicate_challan_sha256(db):
    proj = db.query(Project).first()
    vendor = db.query(Vendor).filter(Vendor.name == "UltraTech Approved").first()

    ch1 = Challan(
        project_id=proj.id,
        vendor_id=vendor.id,
        challan_no="CH-100",
        uploaded_by=1,
        file_path="/uploads/ch100.png",
        sha256="identical_hash_123",
        status="confirmed",
    )
    ch2 = Challan(
        project_id=proj.id,
        vendor_id=vendor.id,
        challan_no="CH-101",
        uploaded_by=1,
        file_path="/uploads/ch101.png",
        sha256="identical_hash_123",
        status="confirmed",
    )
    db.add_all([ch1, ch2])
    db.commit()

    reconcile_challan(db, ch2)

    alert = db.query(Alert).filter(Alert.project_id == proj.id, Alert.type == "duplicate_challan").first()
    assert alert is not None
    assert "Exact duplicate delivery file" in alert.explanation
