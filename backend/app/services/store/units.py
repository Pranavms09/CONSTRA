from decimal import Decimal
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.material import Material, UnitConversion


def to_base(db: Session, material_id: int, unit: str, qty) -> Decimal:
    """
    Converts a material quantity from a given unit to its base unit using unit_conversions.
    Always uses Decimal arithmetic.
    Raises HTTP 422 if the unit is unknown for that material.
    """
    if qty is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Quantity cannot be empty"
        )

    try:
        dec_qty = Decimal(str(qty))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid numeric quantity '{qty}'"
        )

    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Material with ID {material_id} not found"
        )

    clean_unit = unit.strip().lower()
    base_unit = material.base_unit.strip().lower()

    if clean_unit == base_unit:
        return dec_qty

    conversion = (
        db.query(UnitConversion)
        .filter(
            UnitConversion.material_id == material_id,
            func.lower(UnitConversion.unit) == clean_unit
        )
        .first()
    )

    if not conversion:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown unit '{unit}' for {material.name}"
        )

    factor = Decimal(str(conversion.factor_to_base))
    return dec_qty * factor


def from_base(db: Session, material_id: int, target_unit: str, qty_base) -> Decimal:
    """
    Converts a material quantity in base unit to target unit.
    """
    dec_qty_base = Decimal(str(qty_base))
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Material with ID {material_id} not found"
        )

    clean_target = target_unit.strip().lower()
    if clean_target == material.base_unit.strip().lower():
        return dec_qty_base

    conversion = (
        db.query(UnitConversion)
        .filter(
            UnitConversion.material_id == material_id,
            func.lower(UnitConversion.unit) == clean_target
        )
        .first()
    )

    if not conversion or conversion.factor_to_base == 0:
        return dec_qty_base

    factor = Decimal(str(conversion.factor_to_base))
    return dec_qty_base / factor


def get_allowed_units(db: Session, material_id: int) -> list[str]:
    """
    Returns all allowed units for a given material including base_unit.
    """
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        return []

    conversions = (
        db.query(UnitConversion.unit)
        .filter(UnitConversion.material_id == material_id)
        .all()
    )
    units = [material.base_unit]
    for (u,) in conversions:
        if u.lower() != material.base_unit.lower():
            units.append(u)
    return units
