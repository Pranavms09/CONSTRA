from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean, Text, ForeignKey,
    DateTime, Date, UniqueConstraint, func
)
from sqlalchemy.orm import relationship
from app.database import Base


class Challan(Base):
    __tablename__ = "challans"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True)
    vendor_name_raw = Column(String(255), nullable=True)
    challan_no = Column(String(100), nullable=False)
    challan_date = Column(Date, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    file_path = Column(String(500), nullable=False)
    sha256 = Column(String(64), nullable=False, index=True)
    ocr_raw_text = Column(Text, nullable=True)
    ocr_confidence = Column(Numeric(5, 2), nullable=True)
    reviewed = Column(Boolean, default=False, nullable=False)
    status = Column(String(20), default="processing", nullable=False)  # processing, draft, confirmed, failed
    failure_reason = Column(Text, nullable=True)
    version = Column(Integer, default=1, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("vendor_id", "challan_no", name="uq_vendor_challan_no"),
    )

    vendor = relationship("Vendor")
    uploader = relationship("User")
    items = relationship("ChallanItem", back_populates="challan", cascade="all, delete-orphan")


class ChallanItem(Base):
    __tablename__ = "challan_items"

    id = Column(Integer, primary_key=True, index=True)
    challan_id = Column(Integer, ForeignKey("challans.id", ondelete="CASCADE"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id", ondelete="SET NULL"), nullable=True)
    stage_id = Column(Integer, ForeignKey("stages.id", ondelete="SET NULL"), nullable=True)
    material_name_raw = Column(String(255), nullable=True)
    qty = Column(Numeric(14, 4), nullable=False)
    unit = Column(String(50), nullable=False)
    qty_base = Column(Numeric(14, 4), nullable=False)
    field_confidence = Column(Numeric(5, 2), nullable=True)

    challan = relationship("Challan", back_populates="items")
    material = relationship("Material")
    stage = relationship("Stage")


class MaterialIssue(Base):
    __tablename__ = "material_issues"

    id = Column(Integer, primary_key=True, index=True)
    stage_id = Column(Integer, ForeignKey("stages.id", ondelete="RESTRICT"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id", ondelete="RESTRICT"), nullable=False)
    qty = Column(Numeric(14, 4), nullable=False)
    unit = Column(String(50), nullable=False)
    qty_base = Column(Numeric(14, 4), nullable=False)
    issued_by = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    issued_to = Column(String(255), nullable=False)
    note = Column(Text, nullable=True)
    anomaly_flag = Column(Boolean, default=False, nullable=False)
    issued_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    stage = relationship("Stage")
    material = relationship("Material")
    issuer = relationship("User")
