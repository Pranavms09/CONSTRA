from typing import List, Optional, Tuple
from datetime import date
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from fastapi import HTTPException, status

from app.models.project import Project, ProjectMember, Stage
from app.models.material import Material, UnitConversion, Vendor
from app.models.challan import Challan, ChallanItem, MaterialIssue
from app.models.alert import Alert


def is_project_member(db: Session, user_id: int, project_id: int, user_role: str = "") -> bool:
    """
    Checks if a user is authorized for a project.
    Auditors have global access; site roles must have project_members rows.
    """
    if user_role == "auditor":
        proj = db.query(Project).filter(Project.id == project_id).first()
        return proj is not None

    member = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id
        )
        .first()
    )
    return member is not None


def ensure_project_access(db: Session, user_id: int, project_id: int, user_role: str = "") -> Project:
    """Returns project or raises 404 (not 403) to prevent IDOR disclosure."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if not is_project_member(db, user_id, project_id, user_role):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    return project


def get_user_projects(db: Session, user_id: int, user_role: str = "") -> List[Project]:
    if user_role == "auditor":
        return db.query(Project).order_by(Project.id.asc()).all()

    return (
        db.query(Project)
        .join(ProjectMember, Project.id == ProjectMember.project_id)
        .filter(ProjectMember.user_id == user_id)
        .order_by(Project.id.asc())
        .all()
    )


def get_project_stages(db: Session, project_id: int) -> List[Stage]:
    return (
        db.query(Stage)
        .filter(Stage.project_id == project_id)
        .order_by(Stage.order.asc(), Stage.id.asc())
        .all()
    )


def get_materials_with_units(db: Session) -> List[dict]:
    materials = db.query(Material).order_by(Material.name.asc()).all()
    out = []
    for m in materials:
        conversions = (
            db.query(UnitConversion.unit)
            .filter(UnitConversion.material_id == m.id)
            .all()
        )
        units = [m.base_unit]
        for (u,) in conversions:
            if u.lower() != m.base_unit.lower():
                units.append(u)
        out.append({
            "id": m.id,
            "name": m.name,
            "base_unit": m.base_unit,
            "description": m.description,
            "allowed_units": units
        })
    return out


def get_vendors(db: Session) -> List[Vendor]:
    return db.query(Vendor).order_by(Vendor.name.asc()).all()


def list_challans(
    db: Session,
    project_id: int,
    status_filter: Optional[str] = None,
    vendor_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20
) -> Tuple[List[Challan], int]:
    query = db.query(Challan).filter(Challan.project_id == project_id)

    if status_filter:
        query = query.filter(Challan.status == status_filter)
    if vendor_id:
        query = query.filter(Challan.vendor_id == vendor_id)
    if start_date:
        query = query.filter(Challan.challan_date >= start_date)
    if end_date:
        query = query.filter(Challan.challan_date <= end_date)
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Challan.challan_no.ilike(search_pattern),
                Challan.vendor_name_raw.ilike(search_pattern)
            )
        )

    total = query.count()
    items = (
        query.order_by(Challan.uploaded_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return items, total


def list_material_issues(
    db: Session,
    project_id: int,
    stage_id: Optional[int] = None,
    material_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    page: int = 1,
    limit: int = 20
) -> Tuple[List[MaterialIssue], int]:
    query = (
        db.query(MaterialIssue)
        .join(Stage, MaterialIssue.stage_id == Stage.id)
        .filter(Stage.project_id == project_id)
    )

    if stage_id:
        query = query.filter(MaterialIssue.stage_id == stage_id)
    if material_id:
        query = query.filter(MaterialIssue.material_id == material_id)
    if start_date:
        query = query.filter(func.date(MaterialIssue.issued_at) >= start_date)
    if end_date:
        query = query.filter(func.date(MaterialIssue.issued_at) <= end_date)

    total = query.count()
    items = (
        query.order_by(MaterialIssue.issued_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return items, total


def list_store_user_alerts(db: Session, project_id: int, user_id: int) -> List[Alert]:
    """
    Returns alerts linked to challans or issues uploaded/issued by this store user.
    """
    return (
        db.query(Alert)
        .outerjoin(Challan, Alert.challan_id == Challan.id)
        .outerjoin(MaterialIssue, Alert.issue_id == MaterialIssue.id)
        .filter(
            Alert.project_id == project_id,
            or_(
                Challan.uploaded_by == user_id,
                MaterialIssue.issued_by == user_id
            )
        )
        .order_by(Alert.created_at.desc())
        .all()
    )
