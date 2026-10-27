import pytest
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models.project import Project, ProjectSettings, Stage
from app.models.material import Material, BoqItem
from app.models.challan import MaterialIssue
from app.services.store.anomaly import assess_issue, preview_issue, calculate_zscore

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

    proj = Project(name="Test Tower")
    session.add(proj)
    session.flush()

    settings = ProjectSettings(
        project_id=proj.id,
        expected_usage_tolerance=Decimal("0.15"),
        zscore_limit=Decimal("2.5"),
    )
    session.add(settings)

    # Stage at 40% verified progress
    stage = Stage(
        project_id=proj.id,
        name="Stage 1 - Columns",
        order=1,
        verified_progress=Decimal("0.40"),
    )
    session.add(stage)

    # Material & BOQ: 10,000 kg planned
    cement = Material(name="OPC 53 Cement", base_unit="kg")
    session.add(cement)
    session.flush()

    boq = BoqItem(
        project_id=proj.id,
        stage_id=stage.id,
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


def test_anomaly_method_a_within_limits(db):
    stage = db.query(Stage).first()
    cement = db.query(Material).first()
    settings = db.query(ProjectSettings).first()

    # Progress 40% of 10,000 = 4,000 kg expected.
    # 15% tolerance allows up to 4,600 kg.
    # Propose issuing 3,500 kg:
    result = assess_issue(db, stage, cement, Decimal("3500"), settings)
    assert result.is_anomalous is False
    assert result.level == "ok"
    assert result.numbers["cumulative_total"] == 3500.0


def test_anomaly_method_a_excess_drawdown(db):
    stage = db.query(Stage).first()
    cement = db.query(Material).first()
    settings = db.query(ProjectSettings).first()

    # Propose issuing 6,000 kg (expected is 4,000, max allowed is 4,600)
    result = assess_issue(db, stage, cement, Decimal("6000"), settings)
    assert result.is_anomalous is True
    assert result.level in ["warn", "alert"]
    assert any("Issued more than expected" in r for r in result.reasons)


def test_calculate_zscore():
    # Less than 5 points returns 0
    z, mean, std = calculate_zscore([10.0, 12.0, 11.0], 50.0)
    assert z == 0.0

    # 5 uniform historical days of 100 kg
    hist = [100.0, 102.0, 98.0, 101.0, 99.0]
    z, mean, std = calculate_zscore(hist, 500.0)
    assert z > 5.0  # Massive spike


def test_preview_issue_uncommitted(db):
    stage = db.query(Stage).first()
    cement = db.query(Material).first()

    # Call preview_issue
    preview = preview_issue(db, stage.id, cement.id, Decimal("5000"))
    assert preview.is_anomalous is True

    # Ensure no issues were actually added to db
    count = db.query(MaterialIssue).count()
    assert count == 0
