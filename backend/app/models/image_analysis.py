from datetime import datetime, timezone
import json
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base


class ImageAnalysis(Base):
    """
    Persistent store for AI-generated image analyses.
    Ensures backend provenance and immutability of AI-generated descriptions
    and authoritative GPS geofence verification outcomes.
    """
    __tablename__ = "image_analyses"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=False)
    file_hash = Column(String(64), nullable=True, index=True)
    description = Column(Text, nullable=False)
    model = Column(String(100), nullable=False, default="gemini-2.5-flash")
    source = Column(String(50), nullable=False, default="backend_gemini_vision")
    uploaded_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    stage_id = Column(Integer, ForeignKey("stages.id", ondelete="SET NULL"), nullable=True, index=True)
    gps_status = Column(String(50), nullable=True)  # PASS, FLAGGED, REVIEW
    gps_latitude = Column(Float, nullable=True)
    gps_longitude = Column(Float, nullable=True)
    gps_distance_m = Column(Float, nullable=True)
    verification_result = Column(Text, nullable=True)  # JSON-encoded verification result
    alert_id = Column(Integer, ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    project = relationship("Project")
    stage = relationship("Stage")
    alert = relationship("Alert")

    def to_dict(self):
        parsed_verification = None
        if self.verification_result:
            try:
                parsed_verification = json.loads(self.verification_result)
            except Exception:
                parsed_verification = None

        return {
            "id": self.id,
            "filename": self.filename,
            "content_type": self.content_type,
            "file_size": self.file_size,
            "file_hash": self.file_hash,
            "description": self.description,
            "model": self.model,
            "source": self.source,
            "uploaded_by_id": self.uploaded_by_id,
            "project_id": self.project_id,
            "stage_id": self.stage_id,
            "gps_status": self.gps_status,
            "gps_latitude": self.gps_latitude,
            "gps_longitude": self.gps_longitude,
            "gps_distance_m": self.gps_distance_m,
            "gps_verification": parsed_verification,
            "alert_id": self.alert_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

