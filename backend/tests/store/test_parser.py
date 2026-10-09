import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models.material import Material
from app.services.store.parser import (
    extract_challan_number,
    extract_date,
    extract_vendor_name,
    extract_items,
    parse_challan_text,
)

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
    cement = Material(name="OPC 53 Cement", base_unit="kg")
    steel = Material(name="TMT Steel Rebar 12mm", base_unit="kg")
    session.add_all([cement, steel])
    session.commit()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


def test_extract_challan_number():
    sample1 = "Delivery Challan No: CH-2024-0881\nDate: 12/10/2024"
    ch1, conf1 = extract_challan_number(sample1)
    assert ch1 == "CH-2024-0881"
    assert conf1 > 70.0

    sample2 = "Invoice No: INV-88910\nRecipient: Site A"
    ch2, conf2 = extract_challan_number(sample2)
    assert ch2 == "INV-88910"

    sample3 = "Random memo without challan or code"
    ch3, conf3 = extract_challan_number(sample3)
    assert ch3 is None


def test_extract_date():
    s1 = "Date: 14/10/2024"
    d1, _ = extract_date(s1)
    assert d1 == "2024-10-14"

    s2 = "Invoice Date: 2024-11-20"
    d2, _ = extract_date(s2)
    assert d2 == "2024-11-20"

    s3 = "Challan Dated: 25-Oct-2024"
    d3, _ = extract_date(s3)
    assert d3 == "2024-10-25"


def test_extract_vendor_name():
    s1 = "Vendor: UltraTech Building Solutions\nChallan: CH-101"
    v1, conf1 = extract_vendor_name(s1)
    assert "UltraTech Building Solutions" in v1
    assert conf1 > 70.0

    s2 = "Supplier - Shree Cement Traders\nDate: 10/10/2024"
    v2, _ = extract_vendor_name(s2)
    assert "Shree Cement Traders" in v2


def test_extract_items():
    raw_lines = """
    1. OPC 53 Cement: 200 bags
    2. TMT Steel Rebar 12mm: 3 tonnes
    """
    items, conf = extract_items(raw_lines)
    assert len(items) == 2
    assert items[0]["qty"] == 200.0
    assert items[0]["unit"] == "bag"
    assert items[1]["qty"] == 3.0
    assert items[1]["unit"] == "tonne"


def test_parse_challan_text_with_db_fuzzy(db):
    text = """
    Vendor: UltraTech Building Solutions
    Challan No: CH-2024-999
    Date: 15/10/2024

    OPC-53 Cmt Grade: 150 bags
    TMT Steel Rebar 12mm Fe500: 5 tonnes
    """
    parsed = parse_challan_text(text, db=db)
    fields = parsed["fields"]
    assert fields["challan_no"] == "CH-2024-999"
    assert fields["date"] == "2024-10-15"
    assert len(fields["items"]) == 2

    # Cement fuzzy match
    cement_item = fields["items"][0]
    assert cement_item["material"] == "OPC 53 Cement"
    assert cement_item["material_id"] is not None
    assert cement_item["qty"] == 150.0

    # Steel fuzzy match
    steel_item = fields["items"][1]
    assert steel_item["material"] == "TMT Steel Rebar 12mm"
    assert steel_item["material_id"] is not None
    assert steel_item["qty"] == 5.0
