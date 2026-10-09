from typing import Optional
from pydantic import BaseModel


class ImageAnalysisResponse(BaseModel):
    status: str
    description: str
    filename: str
    id: Optional[int] = None
    file_size: Optional[int] = None
    file_hash: Optional[str] = None
    model: str
    source: str
    created_at: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    app: str
    gemini_configured: bool
    model: Optional[str] = None
