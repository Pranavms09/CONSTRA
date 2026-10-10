from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class SupervisorProjectResponse(BaseModel):
    id: int
    name: str
    site_address: Optional[str] = None
    centroid_lat: Optional[float] = None
    centroid_lng: Optional[float] = None
    site_radius_m: float = 200.0


class SupervisorStageResponse(BaseModel):
    id: int
    project_id: int
    name: str
    order: int
    status: str
    verified_progress: float


class EvidenceResponse(BaseModel):
    id: int
    device_evidence_id: str
    project_id: int
    stage_id: int
    project_name: Optional[str] = None
    stage_name: Optional[str] = None
    supervisor_id: int
    supervisor_name: Optional[str] = None
    file_url: Optional[str] = None
    original_filename: str
    file_size: int
    mime_type: str
    client_sha256: str
    server_sha256: str
    hash_matched: bool
    captured_at: str
    server_received_at: str
    latitude: float
    longitude: float
    accuracy_m: float
    distance_to_site_m: Optional[float] = None
    is_within_radius: bool
    radius_warning: bool
    blockchain_tx: Optional[str] = None
    blockchain_status: str
    status: str
    notes: Optional[str] = None


class SupervisorDashboardResponse(BaseModel):
    assigned_projects_count: int
    evidence_today_count: int
    total_submitted_count: int
    recent_submissions: List[EvidenceResponse]
