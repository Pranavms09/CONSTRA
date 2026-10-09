from typing import List, Optional, Any, Dict
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, Field


class ProjectResponse(BaseModel):
    id: int
    name: str
    site_address: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    site_radius_m: float

    model_config = {"from_attributes": True}


class StageResponse(BaseModel):
    id: int
    project_id: int
    name: str
    order: int
    status: str
    verified_progress: float

    model_config = {"from_attributes": True}


class MaterialResponse(BaseModel):
    id: int
    name: str
    base_unit: str
    description: Optional[str] = None
    allowed_units: List[str]


class VendorResponse(BaseModel):
    id: int
    name: str
    is_approved: bool

    model_config = {"from_attributes": True}


class ChallanItemSchema(BaseModel):
    id: Optional[int] = None
    material_id: Optional[int] = None
    material_name: Optional[str] = None
    stage_id: Optional[int] = None
    stage_name: Optional[str] = None
    material_name_raw: Optional[str] = None
    qty: float
    unit: str
    qty_base: Optional[float] = None
    field_confidence: Optional[float] = None


class ChallanUploadResponse(BaseModel):
    id: int
    status: str
    message: str = "Challan uploaded successfully and is being processed."


class ChallanDetailResponse(BaseModel):
    id: int
    project_id: int
    vendor_id: Optional[int] = None
    vendor_name: Optional[str] = None
    vendor_name_raw: Optional[str] = None
    challan_no: str
    challan_date: Optional[date] = None
    uploaded_by: int
    uploader_name: Optional[str] = None
    file_path: str
    file_url: str
    sha256: str
    ocr_raw_text: Optional[str] = None
    ocr_confidence: Optional[float] = None
    reviewed: bool
    status: str
    failure_reason: Optional[str] = None
    version: int
    uploaded_at: datetime
    items: List[ChallanItemSchema]


class ChallanUpdateDraftRequest(BaseModel):
    version: int
    vendor_id: Optional[int] = None
    vendor_name_raw: Optional[str] = None
    challan_no: str
    challan_date: Optional[date] = None
    items: List[ChallanItemSchema]


class ChallanConfirmRequest(BaseModel):
    version: int


class ReconcileSummaryItem(BaseModel):
    material_id: int
    material_name: str
    base_unit: str
    delivered: float
    planned: float
    variance_pct: float
    status: str  # ok, over, under


class AlertResponse(BaseModel):
    id: int
    project_id: int
    stage_id: Optional[int] = None
    challan_id: Optional[int] = None
    issue_id: Optional[int] = None
    type: str
    severity: str
    status: str
    explanation: str
    evidence: Optional[Any] = None
    auditor_comment: Optional[str] = None
    created_at: datetime


class ChallanConfirmResponse(BaseModel):
    challan: ChallanDetailResponse
    reconcile_summary: List[ReconcileSummaryItem]
    alerts_created: List[AlertResponse]


class MaterialIssueCreateRequest(BaseModel):
    stage_id: Optional[int] = None
    material_id: int
    qty: float
    unit: str
    issued_to: str
    note: Optional[str] = None


class MaterialIssueResponse(BaseModel):
    id: int
    stage_id: int
    stage_name: str
    material_id: int
    material_name: str
    qty: float
    unit: str
    qty_base: float
    issued_by: int
    issuer_name: str
    issued_to: str
    note: Optional[str] = None
    anomaly_flag: bool
    issued_at: datetime
    anomaly_reasons: Optional[List[str]] = None


class IssuePreviewRequest(BaseModel):
    stage_id: int
    material_id: int
    qty: float
    unit: str


class IssuePreviewResponse(BaseModel):
    is_anomalous: bool
    level: str  # ok, warn, alert
    reasons: List[str]
    numbers: Dict[str, Any]


class StockSummaryItem(BaseModel):
    material_id: int
    material_name: str
    base_unit: str
    received_base: float
    issued_base: float
    in_stock_base: float
    planned_base: float
    display_unit: str
    display_received: float
    display_issued: float
    display_in_stock: float
    display_planned: float
    negative: bool


class BoqStatusItem(BaseModel):
    material_id: int
    material_name: str
    base_unit: str
    delivered: float
    planned: float
    ratio_pct: float
    over_limit: bool


class PaginatedList(BaseModel):
    items: List[Any]
    total: int
    page: int
    limit: int
    pages: int
