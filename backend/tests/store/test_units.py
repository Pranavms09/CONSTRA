import pytest
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models.material import Material, UnitConversion
from app.services.store.units import to_base, from_base, get_allowed_units

# In-memory SQLite for test
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

    # Create test material: Cement
    cement = Material(name="OPC 53 Cement", base_unit="kg")
    session.add(cement)
    session.flush()

    c1 = UnitConversion(material_id=cement.id, unit="bag", factor_to_base=Decimal("50.0"))
    c2 = UnitConversion(material_id=cement.id, unit="tonne", factor_to_base=Decimal("1000.0"))
    session.add_all([c1, c2])
    session.commit()

    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


def test_to_base_conversions(db):
    cement = db.query(Material).filter(Material.name == "OPC 53 Cement").first()

    # 10 bags -> 500 kg
    res_bags = to_base(db, cement.id, "bag", 10)
    assert res_bags == Decimal("500.0")

    # 2.5 tonnes -> 2500 kg
    res_tonne = to_base(db, cement.id, "tonne", "2.5")
    assert res_tonne == Decimal("2500.0")

    # 100 kg -> 100 kg (base unit directly)
    res_kg = to_base(db, cement.id, "kg", Decimal("100.0"))
    assert res_kg == Decimal("100.0")


def test_to_base_unknown_unit_raises_422(db):
    cement = db.query(Material).filter(Material.name == "OPC 53 Cement").first()
    with pytest.raises(HTTPException) as excinfo:
        to_base(db, cement.id, "litres", 10)
    assert excinfo.value.status_code == 422
    assert "Unknown unit 'litres' for OPC 53 Cement" in excinfo.value.detail


def test_from_base_conversions(db):
    cement = db.query(Material).filter(Material.name == "OPC 53 Cement").first()

    # 500 kg to bags -> 10 bags
    assert from_base(db, cement.id, "bag", 500) == Decimal("10")
    # 2500 kg to tonne -> 2.5 tonnes
    assert from_base(db, cement.id, "tonne", 2500) == Decimal("2.5")
    # 100 kg to kg -> 100 kg
    assert from_base(db, cement.id, "kg", 100) == Decimal("100")


def test_get_allowed_units(db):
    cement = db.query(Material).filter(Material.name == "OPC 53 Cement").first()
    allowed = get_allowed_units(db, cement.id)
    assert "kg" in allowed
    assert "bag" in allowed
    assert "tonne" in allowed
