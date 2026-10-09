from sqlalchemy import Column, Integer, String, Numeric, Boolean, Text, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from app.database import Base


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    base_unit = Column(String(50), nullable=False)  # e.g., 'kg'
    description = Column(Text, nullable=True)

    conversions = relationship("UnitConversion", back_populates="material", cascade="all, delete-orphan")


class UnitConversion(Base):
    __tablename__ = "unit_conversions"

    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id", ondelete="CASCADE"), nullable=False)
    unit = Column(String(50), nullable=False)  # e.g., 'bag', 'tonne', 'kg'
    factor_to_base = Column(Numeric(14, 4), nullable=False)  # e.g., 50.0 for bag -> 50 kg

    material = relationship("Material", back_populates="conversions")


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    is_approved = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class BoqItem(Base):
    __tablename__ = "boq_items"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    stage_id = Column(Integer, ForeignKey("stages.id", ondelete="SET NULL"), nullable=True)
    material_id = Column(Integer, ForeignKey("materials.id", ondelete="CASCADE"), nullable=False)
    planned_qty = Column(Numeric(14, 4), nullable=False)
    unit = Column(String(50), nullable=False)
    planned_qty_base = Column(Numeric(14, 4), nullable=False)

    material = relationship("Material")
