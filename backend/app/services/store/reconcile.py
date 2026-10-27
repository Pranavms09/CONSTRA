from decimal import Decimal
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.challan import Challan, ChallanItem
from app.models.material import Material, Vendor, BoqItem
from app.models.project import Project, ProjectSettings, Stage
from app.services.alerts import raise_alert
from app.services.store.units import to_base


def reconcile_challan(db: Session, challan: Challan) -> List[Dict[str, Any]]:
    """
    Reconciles a confirmed challan against project BOQ limits, duplicate rules, and vendor approvals.
    Creates or updates alerts via raise_alert.
    Returns material-wise reconciliation summary.
    """
    project = db.query(Project).filter(Project.id == challan.project_id).first()
    settings = db.query(ProjectSettings).filter(ProjectSettings.project_id == challan.project_id).first()
    tolerance_pct = Decimal(str(settings.boq_tolerance_pct if settings else 5.0))

    # --- Extra Check A: Duplicate File SHA-256 in Project ---
    dup_file = (
        db.query(Challan)
        .filter(
            Challan.project_id == challan.project_id,
            Challan.sha256 == challan.sha256,
            Challan.id != challan.id
        )
        .first()
    )
    if dup_file:
        raise_alert(
            db,
            project_id=challan.project_id,
            challan_id=challan.id,
            type="duplicate_challan",
            severity="high",
            explanation=f"Exact duplicate delivery file uploaded. Matches earlier Challan #{dup_file.challan_no}.",
            evidence={
                "sha256": challan.sha256,
                "current_challan_id": challan.id,
                "duplicate_challan_id": dup_file.id
            }
        )

    # --- Extra Check B: Duplicate Challan Number for Vendor ---
    if challan.vendor_id:
        dup_no = (
            db.query(Challan)
            .filter(
                Challan.vendor_id == challan.vendor_id,
                Challan.challan_no == challan.challan_no,
                Challan.id != challan.id
            )
            .first()
        )
        if dup_no:
            raise_alert(
                db,
                project_id=challan.project_id,
                challan_id=challan.id,
                type="duplicate_challan",
                severity="high",
                explanation=f"Challan #{challan.challan_no} has already been registered for this vendor.",
                evidence={
                    "vendor_id": challan.vendor_id,
                    "challan_no": challan.challan_no,
                    "duplicate_challan_id": dup_no.id
                }
            )

    # --- Extra Check C: Challan Date Outside Project Dates ---
    if challan.challan_date and project:
        if project.start_date and challan.challan_date < project.start_date:
            raise_alert(
                db,
                project_id=challan.project_id,
                challan_id=challan.id,
                type="challan_date_invalid",
                severity="medium",
                explanation=f"Challan date ({challan.challan_date}) is prior to project start date ({project.start_date}).",
                evidence={"challan_date": str(challan.challan_date), "start_date": str(project.start_date)}
            )
        elif project.end_date and challan.challan_date > project.end_date:
            raise_alert(
                db,
                project_id=challan.project_id,
                challan_id=challan.id,
                type="challan_date_invalid",
                severity="medium",
                explanation=f"Challan date ({challan.challan_date}) is after project scheduled end date ({project.end_date}).",
                evidence={"challan_date": str(challan.challan_date), "end_date": str(project.end_date)}
            )

    # --- Extra Check D: Vendor Status ---
    if challan.vendor_id:
        vendor = db.query(Vendor).filter(Vendor.id == challan.vendor_id).first()
        if vendor and not vendor.is_approved:
            raise_alert(
                db,
                project_id=challan.project_id,
                challan_id=challan.id,
                type="unapproved_vendor",
                severity="medium",
                explanation=f"Vendor '{vendor.name}' is not on the approved supplier allowlist.",
                evidence={"vendor_id": vendor.id, "vendor_name": vendor.name}
            )
    elif challan.vendor_name_raw:
        raise_alert(
            db,
            project_id=challan.project_id,
            challan_id=challan.id,
            type="unapproved_vendor",
            severity="medium",
            explanation=f"Delivery from unverified new vendor '{challan.vendor_name_raw}'.",
            evidence={"vendor_name_raw": challan.vendor_name_raw}
        )

    # --- BOQ Reconciliation per Material ---
    summary_list = []
    # Collect unique materials in this challan
    material_ids = {item.material_id for item in challan.items if item.material_id}

    for mat_id in material_ids:
        material = db.query(Material).filter(Material.id == mat_id).first()
        if not material:
            continue

        # 1. Total delivered in base units across all confirmed challans in this project
        delivered_query = (
            db.query(func.coalesce(func.sum(ChallanItem.qty_base), 0))
            .join(Challan, ChallanItem.challan_id == Challan.id)
            .filter(
                Challan.project_id == challan.project_id,
                Challan.status == "confirmed",
                ChallanItem.material_id == mat_id
            )
        )
        total_delivered = Decimal(str(delivered_query.scalar() or 0))

        # 2. Planned BOQ for this material in project
        boq_query = (
            db.query(func.coalesce(func.sum(BoqItem.planned_qty_base), 0))
            .filter(
                BoqItem.project_id == challan.project_id,
                BoqItem.material_id == mat_id
            )
        )
        total_planned = Decimal(str(boq_query.scalar() or 0))

        # 3. Variance Calculation
        if total_planned == 0:
            variance_pct = Decimal("100.0")
            item_status = "over"
            raise_alert(
                db,
                project_id=challan.project_id,
                challan_id=challan.id,
                type="boq_over_delivery",
                severity="high",
                explanation=f"Material '{material.name}' has no allocation in the Bill of Quantities (BOQ).",
                evidence={
                    "material": material.name,
                    "delivered": float(total_delivered),
                    "planned": 0.0,
                    "variance_pct": 100.0,
                    "tolerance_pct": float(tolerance_pct),
                    "challan_id": challan.id
                }
            )
        else:
            variance_pct = ((total_delivered - total_planned) / total_planned) * Decimal("100")

            if variance_pct > tolerance_pct:
                item_status = "over"
                raise_alert(
                    db,
                    project_id=challan.project_id,
                    challan_id=challan.id,
                    type="boq_over_delivery",
                    severity="high",
                    explanation=(
                        f"Delivered quantity of {material.name} ({total_delivered:.1f} {material.base_unit}) "
                        f"exceeds BOQ planned limit ({total_planned:.1f} {material.base_unit}) "
                        f"by {variance_pct:.1f}% (tolerance: {tolerance_pct}%)."
                    ),
                    evidence={
                        "material": material.name,
                        "delivered": float(total_delivered),
                        "planned": float(total_planned),
                        "variance_pct": float(variance_pct),
                        "tolerance_pct": float(tolerance_pct),
                        "challan_id": challan.id
                    }
                )
            elif variance_pct < -tolerance_pct:
                # Under-delivery alert ONLY if stage is completed
                item_status = "under"
            else:
                item_status = "ok"

        summary_list.append({
            "material_id": material.id,
            "material_name": material.name,
            "base_unit": material.base_unit,
            "delivered": float(total_delivered),
            "planned": float(total_planned),
            "variance_pct": round(float(variance_pct), 2),
            "status": item_status,
        })

    return summary_list
