from decimal import Decimal
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.material import Material, BoqItem, UnitConversion
from app.models.challan import Challan, ChallanItem, MaterialIssue
from app.models.project import Stage


def get_project_stock_summary(db: Session, project_id: int) -> List[Dict[str, Any]]:
    """
    Computes stock balances per material across a project:
    - received: Total base units delivered from confirmed challans.
    - issued: Total base units disbursed through material issues.
    - in_stock: received - issued.
    - planned: Total planned base units in BOQ.
    - friendly unit conversion and negative stock indicator.
    """
    materials = db.query(Material).all()
    summary = []

    for mat in materials:
        # 1. Received from confirmed challans
        recv_val = (
            db.query(func.coalesce(func.sum(ChallanItem.qty_base), 0))
            .join(Challan, ChallanItem.challan_id == Challan.id)
            .filter(
                Challan.project_id == project_id,
                Challan.status == "confirmed",
                ChallanItem.material_id == mat.id
            )
            .scalar()
        )
        received = Decimal(str(recv_val or 0))

        # 2. Issued across all project stages
        issue_val = (
            db.query(func.coalesce(func.sum(MaterialIssue.qty_base), 0))
            .join(Stage, MaterialIssue.stage_id == Stage.id)
            .filter(
                Stage.project_id == project_id,
                MaterialIssue.material_id == mat.id
            )
            .scalar()
        )
        issued = Decimal(str(issue_val or 0))

        # 3. Stock on hand
        in_stock = received - issued
        is_negative = in_stock < Decimal("0.0")

        # 4. Planned in BOQ
        plan_val = (
            db.query(func.coalesce(func.sum(BoqItem.planned_qty_base), 0))
            .filter(
                BoqItem.project_id == project_id,
                BoqItem.material_id == mat.id
            )
            .scalar()
        )
        planned = Decimal(str(plan_val or 0))

        # 5. Display unit conversion (pick common unit like bag for cement, tonne for steel)
        common_conv = (
            db.query(UnitConversion)
            .filter(
                UnitConversion.material_id == mat.id,
                func.lower(UnitConversion.unit) != mat.base_unit.lower()
            )
            .first()
        )

        display_unit = mat.base_unit
        display_in_stock = float(in_stock)
        display_received = float(received)
        display_issued = float(issued)
        display_planned = float(planned)

        if common_conv and common_conv.factor_to_base > 0:
            factor = float(common_conv.factor_to_base)
            display_unit = common_conv.unit
            display_in_stock = round(float(in_stock) / factor, 2)
            display_received = round(float(received) / factor, 2)
            display_issued = round(float(issued) / factor, 2)
            display_planned = round(float(planned) / factor, 2)

        summary.append({
            "material_id": mat.id,
            "material_name": mat.name,
            "base_unit": mat.base_unit,
            "received_base": float(received),
            "issued_base": float(issued),
            "in_stock_base": float(in_stock),
            "planned_base": float(planned),
            "display_unit": display_unit,
            "display_received": display_received,
            "display_issued": display_issued,
            "display_in_stock": display_in_stock,
            "display_planned": display_planned,
            "negative": is_negative,
        })

    return summary


def get_boq_status(db: Session, project_id: int) -> List[Dict[str, Any]]:
    """Delivered vs Planned BOQ status per material."""
    materials = db.query(Material).all()
    results = []

    for mat in materials:
        recv_val = (
            db.query(func.coalesce(func.sum(ChallanItem.qty_base), 0))
            .join(Challan, ChallanItem.challan_id == Challan.id)
            .filter(
                Challan.project_id == project_id,
                Challan.status == "confirmed",
                ChallanItem.material_id == mat.id
            )
            .scalar()
        )
        delivered = float(recv_val or 0)

        plan_val = (
            db.query(func.coalesce(func.sum(BoqItem.planned_qty_base), 0))
            .filter(
                BoqItem.project_id == project_id,
                BoqItem.material_id == mat.id
            )
            .scalar()
        )
        planned = float(plan_val or 0)

        ratio_pct = round((delivered / planned) * 100, 1) if planned > 0 else 0.0

        results.append({
            "material_id": mat.id,
            "material_name": mat.name,
            "base_unit": mat.base_unit,
            "delivered": delivered,
            "planned": planned,
            "ratio_pct": ratio_pct,
            "over_limit": delivered > planned,
        })

    return results
