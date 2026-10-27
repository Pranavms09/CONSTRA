"""Seed script for Store In-Charge demo.
Idempotent and safe to run multiple times.
Populates:
- Demo store_incharge user (store@siteverify.com)
- 1 Demo Project ("Apex Tower — Commercial Block A")
- Project membership for storekeeper
- Project settings (tolerances, z-score threshold, allow new vendors)
- 3 Construction stages with verified progress (1.0, 1.0, 0.4)
- 2 Materials with unit conversions (OPC 53 Cement, TMT Steel Rebar 12mm)
- BOQ items for each stage
- 2 Vendors (1 approved, 1 unapproved)
"""

import sys
from pathlib import Path
from decimal import Decimal

# Ensure backend directory is in python path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import func
from app.database import SessionLocal, Base, engine
from app.models.user import User
from app.models.project import Project, ProjectMember, ProjectSettings, Stage
from app.models.material import Material, UnitConversion, Vendor, BoqItem


def seed_store_demo():
    db = SessionLocal()
    try:
        print("🌱 Seeding Store In-Charge demo data...")

        # 1. Store User
        store_email = "store@siteverify.com".lower()
        user = db.query(User).filter(func.lower(User.email) == store_email).first()
        if not user:
            user = User(
                email=store_email,
                full_name="Demo Storekeeper",
                role="store_incharge",
                is_active=True,
                firebase_uid="uid_store_incharge",
                auth_provider="demo",
            )
            db.add(user)
            db.flush()
            print(f"Created user: {user.email}")
        else:
            print(f"Existing user found: {user.email}")

        # 2. Project
        proj_name = "Pune Vidyarthi Griha's College of Engineering, Nashik"
        project = db.query(Project).filter(Project.name == proj_name).first()
        if not project:
            project = Project(
                name=proj_name,
                site_address="206, Dindori Road, Behind Reliance Petrol Pump, Mhasrul, Nashik, Maharashtra 422004",
                centroid_lat=20.03639,
                centroid_lng=73.79959,
                site_radius_m=500.0,
            )
            db.add(project)
            db.flush()
            print(f"Created project: {project.name} (id={project.id})")
        else:
            print(f"Existing project found: {project.name} (id={project.id})")

        # 3. Project Membership
        # Add Storekeeper
        member = (
            db.query(ProjectMember)
            .filter(ProjectMember.project_id == project.id, ProjectMember.user_id == user.id)
            .first()
        )
        if not member:
            member = ProjectMember(
                project_id=project.id,
                user_id=user.id,
                role="store_incharge",
            )
            db.add(member)
            db.flush()
            print(f"Assigned {user.email} to project {project.name}")

        # Add Supervisor
        sup_user = db.query(User).filter(func.lower(User.email) == "supervisor@siteverify.com").first()
        if sup_user:
            sup_member = (
                db.query(ProjectMember)
                .filter(ProjectMember.project_id == project.id, ProjectMember.user_id == sup_user.id)
                .first()
            )
            if not sup_member:
                db.add(ProjectMember(
                    project_id=project.id,
                    user_id=sup_user.id,
                    role="supervisor",
                ))
                db.flush()
                print(f"Assigned supervisor@siteverify.com to project {project.name}")

        # Add Auditor
        aud_user = db.query(User).filter(func.lower(User.email) == "auditor@siteverify.com").first()
        if aud_user:
            aud_member = (
                db.query(ProjectMember)
                .filter(ProjectMember.project_id == project.id, ProjectMember.user_id == aud_user.id)
                .first()
            )
            if not aud_member:
                db.add(ProjectMember(
                    project_id=project.id,
                    user_id=aud_user.id,
                    role="auditor",
                ))
                db.flush()
                print(f"Assigned auditor@siteverify.com to project {project.name}")

        # 4. Project Settings
        settings = db.query(ProjectSettings).filter(ProjectSettings.project_id == project.id).first()
        if not settings:
            settings = ProjectSettings(
                project_id=project.id,
                boq_tolerance_pct=Decimal("5.00"),
                expected_usage_tolerance=Decimal("0.15"),
                zscore_limit=Decimal("2.50"),
                allow_new_vendors=1,
            )
            db.add(settings)
            db.flush()
            print("Configured project settings (5% BOQ tolerance, 2.5 z-score threshold)")

        # 5. Stages
        stages_data = [
            ("Substructure / Foundation", 1, "COMPLETED", Decimal("1.0000")),
            ("Ground Floor RCC Slab", 2, "COMPLETED", Decimal("1.0000")),
            ("First Floor Columns & Beams", 3, "IN_PROGRESS", Decimal("0.4000")),
        ]
        stage_objs = {}
        for name, order, status, progress in stages_data:
            stg = (
                db.query(Stage)
                .filter(Stage.project_id == project.id, Stage.name == name)
                .first()
            )
            if not stg:
                stg = Stage(
                    project_id=project.id,
                    name=name,
                    order=order,
                    status=status,
                    verified_progress=progress,
                )
                db.add(stg)
                db.flush()
                print(f"Created stage: {name} (progress={progress})")
            else:
                setattr(stg, "order", order)
                setattr(stg, "status", status)
                setattr(stg, "verified_progress", progress)
                db.flush()
            stage_objs[order] = stg

        # 6. Materials & Conversions
        # Material 1: Cement
        cement = db.query(Material).filter(Material.name == "OPC 53 Cement").first()
        if not cement:
            cement = Material(
                name="OPC 53 Cement",
                base_unit="kg",
                description="Ordinary Portland Cement 53 Grade - ISI Certified",
            )
            db.add(cement)
            db.flush()
            print("Created material: OPC 53 Cement")

        cement_conversions = [
            ("kg", Decimal("1.0000")),
            ("bag", Decimal("50.0000")),
            ("tonne", Decimal("1000.0000")),
        ]
        for unit, factor in cement_conversions:
            conv = (
                db.query(UnitConversion)
                .filter(UnitConversion.material_id == cement.id, UnitConversion.unit == unit)
                .first()
            )
            if not conv:
                conv = UnitConversion(
                    material_id=cement.id,
                    unit=unit,
                    factor_to_base=factor,
                )
                db.add(conv)
                db.flush()

        # Material 2: Steel
        steel = db.query(Material).filter(Material.name == "TMT Steel Rebar 12mm").first()
        if not steel:
            steel = Material(
                name="TMT Steel Rebar 12mm",
                base_unit="kg",
                description="Thermo Mechanically Treated Rebar 12mm Fe500D",
            )
            db.add(steel)
            db.flush()
            print("Created material: TMT Steel Rebar 12mm")

        steel_conversions = [
            ("kg", Decimal("1.0000")),
            ("bundle", Decimal("50.0000")),
            ("tonne", Decimal("1000.0000")),
        ]
        for unit, factor in steel_conversions:
            conv = (
                db.query(UnitConversion)
                .filter(UnitConversion.material_id == steel.id, UnitConversion.unit == unit)
                .first()
            )
            if not conv:
                conv = UnitConversion(
                    material_id=steel.id,
                    unit=unit,
                    factor_to_base=factor,
                )
                db.add(conv)
                db.flush()

        # 7. BOQ Items
        boq_data = [
            # Stage 1: Foundation
            (stage_objs[1].id, cement.id, Decimal("10000.0000"), "kg", Decimal("10000.0000")),
            (stage_objs[1].id, steel.id, Decimal("4000.0000"), "kg", Decimal("4000.0000")),
            # Stage 2: Ground Floor Slab
            (stage_objs[2].id, cement.id, Decimal("15000.0000"), "kg", Decimal("15000.0000")),
            (stage_objs[2].id, steel.id, Decimal("6000.0000"), "kg", Decimal("6000.0000")),
            # Stage 3: First Floor
            (stage_objs[3].id, cement.id, Decimal("15000.0000"), "kg", Decimal("15000.0000")),
            (stage_objs[3].id, steel.id, Decimal("6000.0000"), "kg", Decimal("6000.0000")),
        ]

        for stg_id, mat_id, planned_qty, unit, planned_base in boq_data:
            boq = (
                db.query(BoqItem)
                .filter(
                    BoqItem.project_id == project.id,
                    BoqItem.stage_id == stg_id,
                    BoqItem.material_id == mat_id,
                )
                .first()
            )
            if not boq:
                boq = BoqItem(
                    project_id=project.id,
                    stage_id=stg_id,
                    material_id=mat_id,
                    planned_qty=planned_qty,
                    unit=unit,
                    planned_qty_base=planned_base,
                )
                db.add(boq)
                db.flush()
                print(f"Added BOQ item: stage={stg_id}, mat={mat_id}, qty={planned_qty} {unit}")

        # 8. Vendors
        vendors_data = [
            ("UltraTech Building Solutions", True),
            ("Shree Cement Traders", False),
        ]
        for vname, approved in vendors_data:
            vend = db.query(Vendor).filter(Vendor.name == vname).first()
            if not vend:
                vend = Vendor(name=vname, is_approved=approved)
                db.add(vend)
                db.flush()
                print(f"Added vendor: {vname} (approved={approved})")
            else:
                setattr(vend, "is_approved", approved)
                db.flush()

        # 9. Demo Alert on Stage 3 for approval blocker demonstration
        import json
        from app.models.alert import Alert
        existing_alert = db.query(Alert).filter(Alert.project_id == project.id).first()
        if not existing_alert:
            alert = Alert(
                project_id=project.id,
                stage_id=stage_objs[3].id,
                type="BOQ_QUANTITY_OVERRUN",
                severity="high",
                status="open",
                explanation="Delivery challan #CH-8821 contains OPC 53 Cement exceeding Stage 3 planned baseline by 12%. Requires auditor reconciliation.",
                evidence=json.dumps({
                    "material": "OPC 53 Cement",
                    "excess_qty": 1000,
                    "unit": "kg",
                    "variance_pct": 12.5
                })
            )
            db.add(alert)
            db.flush()
            print("Added demo alert on Stage 3")

        db.commit()
        print("✅ Demo store seeding complete!")

    except Exception as e:
        db.rollback()
        print(f"❌ Error during seeding: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_store_demo()
