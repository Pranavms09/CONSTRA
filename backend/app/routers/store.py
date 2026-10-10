import os
import re
import uuid
import hashlib
import json
from decimal import Decimal
from datetime import datetime, date, timezone
from typing import Optional, List
from PIL import Image

from fastapi import (
    APIRouter, Depends, HTTPException, UploadFile, File,
    BackgroundTasks, Query, status, Header
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db, SessionLocal
from app.config import settings
from app.auth.deps import require_role, get_current_user
from app.models.user import User
from app.models.audit_log import AuditLog
from app.models.project import Project, Stage, ProjectSettings
from app.models.material import Material, Vendor
from app.models.challan import Challan, ChallanItem, MaterialIssue
from app.models.alert import Alert

from app.repositories.store_repo import (
    ensure_project_access, get_user_projects, get_project_stages,
    get_materials_with_units, get_vendors, list_challans,
    list_material_issues, list_store_user_alerts
)
from app.schemas.store import (
    ProjectResponse, StageResponse, MaterialResponse, VendorResponse,
    ChallanUploadResponse, ChallanDetailResponse, ChallanUpdateDraftRequest,
    ChallanConfirmRequest, ChallanConfirmResponse, ChallanItemSchema,
    MaterialIssueCreateRequest, MaterialIssueResponse,
    IssuePreviewRequest, IssuePreviewResponse, StockSummaryItem,
    BoqStatusItem, AlertResponse, PaginatedList, ReconcileSummaryItem
)
from app.services.store.units import to_base, get_allowed_units
from app.services.store.ocr import OcrService
from app.services.store.parser import parse_challan_text
from app.services.store.reconcile import reconcile_challan
from app.services.store.anomaly import assess_issue, preview_issue
from app.services.store.stock import get_project_stock_summary, get_boq_status
from app.services.alerts import raise_alert

router = APIRouter(prefix="/store", tags=["store"])


def log_audit(db: Session, actor_id: int, action: str, entity: str, entity_id: str, detail: dict = None):
    try:
        entry = AuditLog(
            actor_id=actor_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            detail=json.dumps(detail) if detail else None
        )
        db.add(entry)
        db.commit()
    except Exception:
        db.rollback()


# --- Background OCR Worker ---
def run_ocr_background(challan_id: int):
    db: Session = SessionLocal()
    try:
        challan = db.query(Challan).filter(Challan.id == challan_id).first()
        if not challan:
            return

        ocr_svc = OcrService()
        result = ocr_svc.process(challan.file_path)

        challan.ocr_raw_text = result.get("raw_text", "")
        fields = result.get("fields", {})
        confidences = result.get("confidence_per_field", {})

        # Compute average confidence
        conf_values = [v for v in confidences.values() if isinstance(v, (int, float))]
        challan.ocr_confidence = Decimal(str(sum(conf_values) / len(conf_values))) if conf_values else Decimal("70.0")

        # Fill fields if detected
        if fields.get("challan_no"):
            challan.challan_no = fields["challan_no"]
        if fields.get("vendor"):
            challan.vendor_name_raw = fields["vendor"]
            # Check direct or fuzzy vendor match
            vendor = db.query(Vendor).filter(func.lower(Vendor.name) == fields["vendor"].lower().strip()).first()
            if vendor:
                challan.vendor_id = vendor.id
            else:
                from rapidfuzz import process, fuzz
                all_vendors = db.query(Vendor).all()
                if all_vendors:
                    v_match = process.extractOne(
                        fields["vendor"],
                        [v.name for v in all_vendors],
                        scorer=fuzz.token_set_ratio
                    )
                    if v_match and v_match[1] >= 75:
                        challan.vendor_id = next(v.id for v in all_vendors if v.name == v_match[0])

        if fields.get("date"):
            try:
                challan.challan_date = datetime.strptime(fields["date"], "%Y-%m-%d").date()
            except Exception:
                pass

        # Populate draft items
        from app.services.store.ocr import normalize_unit
        db.query(ChallanItem).filter(ChallanItem.challan_id == challan.id).delete()
        raw_items = fields.get("items", [])
        for item in raw_items:
            mat_name = item.get("material", "").strip()
            mat_id = item.get("material_id")
            if not mat_id and mat_name:
                mat_obj = db.query(Material).filter(func.lower(Material.name) == mat_name.lower()).first()
                if mat_obj:
                    mat_id = mat_obj.id
                else:
                    from rapidfuzz import process, fuzz
                    all_materials = db.query(Material).all()
                    if all_materials:
                        norm = re.sub(r"[-_/]", " ", mat_name)
                        norm = re.sub(r"\bcmt\b", "cement", norm, flags=re.IGNORECASE)
                        norm = re.sub(r"\brbr\b", "rebar", norm, flags=re.IGNORECASE)
                        norm = re.sub(r"\bbars?\b", "rebar", norm, flags=re.IGNORECASE)
                        best = process.extractOne(
                            norm,
                            [m.name for m in all_materials],
                            scorer=fuzz.token_set_ratio
                        )
                        if best and best[1] >= 65:
                            matched_mat = next(m for m in all_materials if m.name == best[0])
                            mat_id = matched_mat.id
                            if not item.get("field_confidence"):
                                item["field_confidence"] = float(best[1])

            qty = Decimal(str(item.get("qty", 0)))
            unit = normalize_unit(item.get("unit", "bag").strip())
            qty_base = Decimal("0")
            if mat_id:
                try:
                    qty_base = to_base(db, mat_id, unit, qty)
                except Exception:
                    qty_base = qty

            c_item = ChallanItem(
                challan_id=challan.id,
                material_id=mat_id,
                material_name_raw=mat_name,
                qty=qty,
                unit=unit,
                qty_base=qty_base,
                field_confidence=Decimal(str(item.get("field_confidence", 75.0)))
            )
            db.add(c_item)

        challan.status = "draft"
        challan.failure_reason = None
        challan.version += 1
        db.commit()
    except Exception as e:
        db.rollback()
        fail_challan = db.query(Challan).filter(Challan.id == challan_id).first()
        if fail_challan:
            fail_challan.status = "failed"
            fail_challan.failure_reason = f"OCR engine could not read document: {str(e)}"
            fail_challan.version += 1
            db.commit()
    finally:
        db.close()


def challan_to_detail_response(c: Challan) -> ChallanDetailResponse:
    item_schemas = []
    for it in c.items:
        item_schemas.append(ChallanItemSchema(
            id=it.id,
            material_id=it.material_id,
            material_name=it.material.name if it.material else (it.material_name_raw or ""),
            stage_id=it.stage_id,
            stage_name=it.stage.name if it.stage else None,
            material_name_raw=it.material_name_raw,
            qty=float(it.qty),
            unit=it.unit,
            qty_base=float(it.qty_base) if it.qty_base is not None else None,
            field_confidence=float(it.field_confidence) if it.field_confidence is not None else None,
        ))

    return ChallanDetailResponse(
        id=c.id,
        project_id=c.project_id,
        vendor_id=c.vendor_id,
        vendor_name=c.vendor.name if c.vendor else None,
        vendor_name_raw=c.vendor_name_raw,
        challan_no=c.challan_no,
        challan_date=c.challan_date,
        uploaded_by=c.uploaded_by,
        uploader_name=c.uploader.full_name if c.uploader else None,
        file_path=c.file_path,
        file_url=f"/store/files/{c.id}",
        sha256=c.sha256,
        ocr_raw_text=c.ocr_raw_text,
        ocr_confidence=float(c.ocr_confidence) if c.ocr_confidence is not None else None,
        reviewed=c.reviewed,
        status=c.status,
        failure_reason=c.failure_reason,
        version=c.version,
        uploaded_at=c.uploaded_at,
        items=item_schemas,
    )


# --- 1. Projects and Reference Endpoints ---

@router.get("/projects", response_model=List[ProjectResponse])
def get_my_projects(
    user: User = Depends(require_role("store_incharge")),
    db: Session = Depends(get_db)
):
    projects = get_user_projects(db, user.id, user.role)
    return [ProjectResponse.model_validate(p) for p in projects]


@router.get("/projects/{pid}/stages", response_model=List[StageResponse])
def get_stages(
    pid: int,
    user: User = Depends(require_role("store_incharge")),
    db: Session = Depends(get_db)
):
    ensure_project_access(db, user.id, pid, user.role)
    stages = get_project_stages(db, pid)
    return [
        StageResponse(
            id=s.id,
            project_id=s.project_id,
            name=s.name,
            order=s.order,
            status=s.status,
            verified_progress=float(s.verified_progress)
        )
        for s in stages
    ]


@router.get("/materials", response_model=List[MaterialResponse])
def list_materials(
    user: User = Depends(require_role("store_incharge")),
    db: Session = Depends(get_db)
):
    data = get_materials_with_units(db)
    return [MaterialResponse(**m) for m in data]


@router.get("/vendors", response_model=List[VendorResponse])
def list_vendors(
    user: User = Depends(require_role("store_incharge")),
    db: Session = Depends(get_db)
):
    vendors = get_vendors(db)
    return [VendorResponse.model_validate(v) for v in vendors]


@router.get("/projects/{pid}/materials", response_model=List[MaterialResponse])
def list_project_materials(
    pid: int,
    user: User = Depends(require_role("store_incharge")),
    db: Session = Depends(get_db)
):
    ensure_project_access(db, user.id, pid, user.role)
    data = get_materials_with_units(db)
    return [MaterialResponse(**m) for m in data]


@router.get("/projects/{pid}/vendors", response_model=List[VendorResponse])
def list_project_vendors(
    pid: int,
    user: User = Depends(require_role("store_incharge")),
    db: Session = Depends(get_db)
):
    ensure_project_access(db, user.id, pid, user.role)
    vendors = get_vendors(db)
    return [VendorResponse.model_validate(v) for v in vendors]


# --- 2. Challan Ingestion & OCR Endpoints ---

@router.post("/projects/{pid}/challans", response_model=ChallanUploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_challan(
    pid: int,
    bg_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: User = Depends(require_role("store_incharge")),
    db: Session = Depends(get_db)
):
    ensure_project_access(db, user.id, pid, user.role)

    # 1. Size Validation
    contents = await file.read()
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_MB} MB."
        )

    # 2. Magic Bytes Validation
    is_jpeg = contents.startswith(b"\xff\xd8\xff")
    is_png = contents.startswith(b"\x89PNG\r\n\x1a\n")
    is_pdf = contents.startswith(b"%PDF-")

    if not (is_jpeg or is_png or is_pdf):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unsupported file format. Please upload a genuine JPEG, PNG, or PDF challan document."
        )

    # 3. Image Dimension Limits
    if is_jpeg or is_png:
        try:
            import io
            with Image.open(io.BytesIO(contents)) as img:
                w, h = img.size
                if w > 12000 or h > 12000:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="Image dimensions exceed maximum allowed 12000px limit."
                    )
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Unable to read image bytes."
            )

    # 4. Storage & Hash Calculation
    sha256_hash = hashlib.sha256(contents).hexdigest()
    ext = ".pdf" if is_pdf else (".jpg" if is_jpeg else ".png")
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    stored_name = f"challan_{uuid.uuid4().hex}{ext}"
    stored_path = os.path.join(settings.UPLOAD_DIR, stored_name)

    with open(stored_path, "wb") as f:
        f.write(contents)

    # 5. Create Challan in processing state
    challan = Challan(
        project_id=pid,
        challan_no=f"PENDING-{uuid.uuid4().hex[:6].upper()}",
        uploaded_by=user.id,
        file_path=stored_path,
        sha256=sha256_hash,
        status="processing",
        reviewed=False,
        version=1
    )
    db.add(challan)
    db.commit()
    db.refresh(challan)

    log_audit(db, user.id, "upload_challan", "challan", str(challan.id), {"sha256": sha256_hash, "project_id": pid})

    # 6. Queue background OCR task
    bg_tasks.add_task(run_ocr_background, challan.id)

    return ChallanUploadResponse(id=challan.id, status=challan.status)


@router.post("/projects/{pid}/challans/manual", response_model=ChallanDetailResponse)
def create_manual_challan_draft(
    pid: int,
    user: User = Depends(require_role("store_incharge")),
    db: Session = Depends(get_db)
):
    """Fallback endpoint creating an empty draft for manual field input."""
    ensure_project_access(db, user.id, pid, user.role)
    challan = Challan(
        project_id=pid,
        challan_no=f"MANUAL-{uuid.uuid4().hex[:6].upper()}",
        uploaded_by=user.id,
        file_path="",
        sha256="manual_" + uuid.uuid4().hex,
        status="draft",
        reviewed=False,
        version=1
    )
    db.add(challan)
    db.commit()
    db.refresh(challan)
    return challan_to_detail_response(challan)


@router.get("/challans/{id}", response_model=ChallanDetailResponse)
@router.get("/deliveries/{id}", response_model=ChallanDetailResponse)
def get_challan(
    id: int,
    user: User = Depends(require_role("store_incharge")),
    db: Session = Depends(get_db)
):
    challan = db.query(Challan).filter(Challan.id == id).first()
    if not challan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challan not found")

    ensure_project_access(db, user.id, challan.project_id, user.role)
    return challan_to_detail_response(challan)


@router.put("/challans/{id}", response_model=ChallanDetailResponse)
@router.patch("/challans/{id}", response_model=ChallanDetailResponse)
def update_challan_draft(
    id: int,
    body: ChallanUpdateDraftRequest,
    user: User = Depends(require_role("store_incharge")),
    db: Session = Depends(get_db)
):
    challan = db.query(Challan).filter(Challan.id == id).first()
    if not challan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challan not found")

    ensure_project_access(db, user.id, challan.project_id, user.role)

    if challan.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot edit challan in status '{challan.status}'. Only draft challans can be edited."
        )

    # Optimistic Locking
    if challan.version != body.version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Conflict: Challan was modified by another request. Please refresh to continue."
        )

    challan.challan_no = body.challan_no.strip()
    challan.vendor_id = body.vendor_id
    challan.vendor_name_raw = body.vendor_name_raw
    challan.challan_date = body.challan_date

    # Replace items
    db.query(ChallanItem).filter(ChallanItem.challan_id == challan.id).delete()
    for item in body.items:
        dec_qty = Decimal(str(item.qty))
        qty_base = dec_qty
        if item.material_id:
            try:
                qty_base = to_base(db, item.material_id, item.unit, dec_qty)
            except Exception:
                qty_base = dec_qty

        c_item = ChallanItem(
            challan_id=challan.id,
            material_id=item.material_id,
            stage_id=item.stage_id,
            material_name_raw=item.material_name_raw,
            qty=dec_qty,
            unit=item.unit,
            qty_base=qty_base,
            field_confidence=Decimal(str(item.field_confidence or 100.0))
        )
        db.add(c_item)

    challan.version += 1
    db.commit()
    db.refresh(challan)

    log_audit(db, user.id, "edit_challan", "challan", str(challan.id))
    return challan_to_detail_response(challan)


@router.post("/challans/{id}/confirm", response_model=ChallanConfirmResponse)
def confirm_challan(
    id: int,
    body: Optional[ChallanConfirmRequest] = None,
    user: User = Depends(require_role("store_incharge")),
    db: Session = Depends(get_db)
):
    challan = db.query(Challan).filter(Challan.id == id).first()
    if not challan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challan not found")

    ensure_project_access(db, user.id, challan.project_id, user.role)

    # Optimistic Locking
    if body and body.version is not None and challan.version != body.version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Conflict: Challan was modified by another request. Please refresh to continue."
        )

    # Validation rules before confirmation
    errors = []
    if not challan.challan_no or challan.challan_no.startswith("PENDING-"):
        errors.append("Challan number is required.")

    if not challan.items:
        errors.append("At least one delivery line item is required.")

    for idx, item in enumerate(challan.items, start=1):
        if not item.material_id:
            errors.append(f"Line item {idx} must be matched to a registered material.")
        if item.qty <= Decimal("0"):
            errors.append(f"Line item {idx} quantity must be greater than 0.")
        if item.material_id:
            try:
                item.qty_base = to_base(db, item.material_id, item.unit, item.qty)
            except HTTPException as e:
                errors.append(f"Line item {idx}: {e.detail}")

    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "VALIDATION_ERROR", "message": "; ".join(errors)}
        )

    # If new vendor and project allows, create vendor
    if not challan.vendor_id and challan.vendor_name_raw:
        settings = db.query(ProjectSettings).filter(ProjectSettings.project_id == challan.project_id).first()
        if settings and settings.allow_new_vendors:
            new_v = Vendor(name=challan.vendor_name_raw.strip(), is_approved=False)
            db.add(new_v)
            db.commit()
            db.refresh(new_v)
            challan.vendor_id = new_v.id

    # Check for duplicate challan number constraint
    if challan.vendor_id:
        existing_dup = (
            db.query(Challan)
            .filter(
                Challan.vendor_id == challan.vendor_id,
                Challan.challan_no == challan.challan_no,
                Challan.status == "confirmed",
                Challan.id != challan.id
            )
            .first()
        )
        if existing_dup:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Challan #{challan.challan_no} has already been confirmed for this vendor (ID: {existing_dup.id})."
            )

    challan.status = "confirmed"
    challan.reviewed = True
    challan.version += 1
    db.commit()
    db.refresh(challan)

    # Blockchain anchoring hook: enqueue confirmed challan hash (fail-safe)
    from app.services.chain_hooks import enqueue_anchor
    enqueue_anchor(
        entity="challan",
        entity_id=str(challan.id),
        sha256=challan.sha256,
        project_id=str(challan.project_id) if challan.project_id else None,
    )

    # Run Reconciliation & Generate Alerts
    reconcile_results = reconcile_challan(db, challan)

    # Fetch alerts created for this challan
    alerts = db.query(Alert).filter(Alert.challan_id == challan.id).all()
    alert_schemas = [
        AlertResponse(
            id=a.id,
            project_id=a.project_id,
            stage_id=a.stage_id,
            challan_id=a.challan_id,
            issue_id=a.issue_id,
            type=a.type,
            severity=a.severity,
            status=a.status,
            explanation=a.explanation,
            evidence=json.loads(a.evidence) if a.evidence else None,
            auditor_comment=a.auditor_comment,
            created_at=a.created_at
        )
        for a in alerts
    ]

    log_audit(db, user.id, "confirm_challan", "challan", str(challan.id), {"items_count": len(challan.items)})

    return ChallanConfirmResponse(
        challan=challan_to_detail_response(challan),
        reconcile_summary=[ReconcileSummaryItem(**item) for item in reconcile_results],
        alerts_created=alert_schemas
    )


@router.get("/projects/{pid}/challans", response_model=PaginatedList)
def get_project_challans(
    pid: int,
    status: Optional[str] = None,
    vendor_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(require_role("store_incharge")),
    db: Session = Depends(get_db)
):
    ensure_project_access(db, user.id, pid, user.role)
    items, total = list_challans(db, pid, status, vendor_id, start_date, end_date, search, page, limit)
    pages = (total + limit - 1) // limit if limit > 0 else 1
    return PaginatedList(
        items=[challan_to_detail_response(c) for c in items],
        total=total,
        page=page,
        limit=limit,
        pages=pages
    )


@router.get("/files/{challan_id}")
def download_challan_file(
    challan_id: int,
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    auth_header = authorization
    if not auth_header and token:
        auth_header = f"Bearer {token}" if not token.startswith("Bearer ") else token

    if not auth_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required"
        )

    user = get_current_user(authorization=auth_header, db=db)
    if user.role != "store_incharge":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    challan = db.query(Challan).filter(Challan.id == challan_id).first()
    if not challan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challan not found")

    ensure_project_access(db, user.id, challan.project_id, user.role)

    if not os.path.exists(challan.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Physical evidence file not found on server")

    ext = os.path.splitext(challan.file_path)[1].lower()
    if ext == ".pdf":
        media_type = "application/pdf"
    elif ext == ".png":
        media_type = "image/png"
    elif ext in [".jpg", ".jpeg"]:
        media_type = "image/jpeg"
    else:
        media_type = "application/octet-stream"

    return FileResponse(
        challan.file_path,
        media_type=media_type,
        content_disposition_type="inline",
        filename=os.path.basename(challan.file_path)
    )


# --- 3. Material Issue Endpoints ---

@router.post("/issue-preview", response_model=IssuePreviewResponse)
def get_issue_preview(
    body: IssuePreviewRequest,
    user: User = Depends(require_role("store_incharge")),
    db: Session = Depends(get_db)
):
    """Evaluates proposed drawdown and returns expected progress ratio & z-score check."""
    stage = db.query(Stage).filter(Stage.id == body.stage_id).first()
    if not stage:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stage not found")

    ensure_project_access(db, user.id, stage.project_id, user.role)

    qty_base = to_base(db, body.material_id, body.unit, Decimal(str(body.qty)))
    result = preview_issue(db, body.stage_id, body.material_id, qty_base)
    return IssuePreviewResponse(
        is_anomalous=result.is_anomalous,
        level=result.level,
        reasons=result.reasons,
        numbers=result.numbers
    )


@router.post("/stages/{sid}/material-issues", response_model=MaterialIssueResponse, status_code=status.HTTP_201_CREATED)
def log_material_issue(
    sid: int,
    body: MaterialIssueCreateRequest,
    user: User = Depends(require_role("store_incharge")),
    db: Session = Depends(get_db)
):
    stage = db.query(Stage).filter(Stage.id == sid).first()
    if not stage:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stage not found")

    ensure_project_access(db, user.id, stage.project_id, user.role)

    material = db.query(Material).filter(Material.id == body.material_id).first()
    if not material:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found")

    qty_base = to_base(db, body.material_id, body.unit, Decimal(str(body.qty)))

    # Evaluate Anomaly
    settings = db.query(ProjectSettings).filter(ProjectSettings.project_id == stage.project_id).first()
    eval_result = assess_issue(db, stage, material, qty_base, settings)

    # Save Issue Record (Never block store work!)
    issue = MaterialIssue(
        stage_id=sid,
        material_id=body.material_id,
        qty=Decimal(str(body.qty)),
        unit=body.unit.strip(),
        qty_base=qty_base,
        issued_by=user.id,
        issued_to=body.issued_to.strip(),
        note=body.note,
        anomaly_flag=eval_result.is_anomalous
    )
    db.add(issue)
    db.commit()
    db.refresh(issue)

    # If flagged, raise an alert
    if eval_result.is_anomalous:
        severity = "high" if eval_result.level == "alert" else "medium"
        explanation = "; ".join(eval_result.reasons) or "Unusual consumption detected for verified progress."
        raise_alert(
            db,
            project_id=stage.project_id,
            stage_id=stage.id,
            issue_id=issue.id,
            type="consumption_anomaly",
            severity=severity,
            explanation=explanation,
            evidence=eval_result.numbers
        )

    log_audit(db, user.id, "issue_material", "material_issue", str(issue.id), {
        "material": material.name,
        "qty": float(issue.qty),
        "unit": issue.unit,
        "anomaly": issue.anomaly_flag
    })

    return MaterialIssueResponse(
        id=issue.id,
        stage_id=stage.id,
        stage_name=stage.name,
        material_id=material.id,
        material_name=material.name,
        qty=float(issue.qty),
        unit=issue.unit,
        qty_base=float(issue.qty_base),
        issued_by=user.id,
        issuer_name=user.full_name,
        issued_to=issue.issued_to,
        note=issue.note,
        anomaly_flag=issue.anomaly_flag,
        issued_at=issue.issued_at,
        anomaly_reasons=eval_result.reasons if eval_result.is_anomalous else None
    )


@router.get("/projects/{pid}/material-issues", response_model=PaginatedList)
def get_project_material_issues(
    pid: int,
    stage_id: Optional[int] = None,
    material_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(require_role("store_incharge")),
    db: Session = Depends(get_db)
):
    ensure_project_access(db, user.id, pid, user.role)
    items, total = list_material_issues(db, pid, stage_id, material_id, start_date, end_date, page, limit)
    pages = (total + limit - 1) // limit if limit > 0 else 1

    resp_items = [
        MaterialIssueResponse(
            id=iss.id,
            stage_id=iss.stage_id,
            stage_name=iss.stage.name if iss.stage else "",
            material_id=iss.material_id,
            material_name=iss.material.name if iss.material else "",
            qty=float(iss.qty),
            unit=iss.unit,
            qty_base=float(iss.qty_base),
            issued_by=iss.issued_by,
            issuer_name=iss.issuer.full_name if iss.issuer else "",
            issued_to=iss.issued_to,
            note=iss.note,
            anomaly_flag=iss.anomaly_flag,
            issued_at=iss.issued_at
        )
        for iss in items
    ]

    return PaginatedList(items=resp_items, total=total, page=page, limit=limit, pages=pages)


# --- 4. Stock, BOQ Status, and Alerts Endpoints ---

@router.get("/projects/{pid}/stock-summary", response_model=List[StockSummaryItem])
def get_stock_summary(
    pid: int,
    user: User = Depends(require_role("store_incharge")),
    db: Session = Depends(get_db)
):
    ensure_project_access(db, user.id, pid, user.role)
    data = get_project_stock_summary(db, pid)
    return [StockSummaryItem(**row) for row in data]


@router.get("/projects/{pid}/boq-status", response_model=List[BoqStatusItem])
def get_project_boq_status(
    pid: int,
    user: User = Depends(require_role("store_incharge")),
    db: Session = Depends(get_db)
):
    ensure_project_access(db, user.id, pid, user.role)
    data = get_boq_status(db, pid)
    return [BoqStatusItem(**row) for row in data]


@router.get("/projects/{pid}/alerts", response_model=List[AlertResponse])
def get_my_alerts(
    pid: int,
    user: User = Depends(require_role("store_incharge")),
    db: Session = Depends(get_db)
):
    ensure_project_access(db, user.id, pid, user.role)
    alerts = list_store_user_alerts(db, pid, user.id)
    return [
        AlertResponse(
            id=a.id,
            project_id=a.project_id,
            stage_id=a.stage_id,
            challan_id=a.challan_id,
            issue_id=a.issue_id,
            type=a.type,
            severity=a.severity,
            status=a.status,
            explanation=a.explanation,
            evidence=json.loads(a.evidence) if a.evidence else None,
            auditor_comment=a.auditor_comment,
            created_at=a.created_at
        )
        for a in alerts
    ]
