from typing import Optional, Dict, Any
from pydantic import BaseModel


class ImageAnalysisResponse(BaseModel):
    status: str
    description: str
    filename: str
    id: Optional[int] = None
    file_size: Optional[int] = None
    file_hash: Optional[str] = None
    file_url: Optional[str] = None
    is_duplicate: bool = False
    duplicate_of_id: Optional[int] = None
    exif_gps: Optional[dict] = None
    gps_verification: Optional[Dict[str, Any]] = None
    project_id: Optional[int] = None
    stage_id: Optional[int] = None
    alert_id: Optional[int] = None
    model: str
    source: str
    created_at: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    app: str
    gemini_configured: bool
    model: Optional[str] = None

