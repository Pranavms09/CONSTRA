from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, Boolean, func
from sqlalchemy.orm import relationship
from app.database import Base


class Evidence(Base):
    """
    Append-only evidence submissions captured exclusively via the Site Supervisor Android Camera.
    Stores device telemetry, calculated hash, server-recalculated hash, and geofence evaluation.
    """
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True)
    device_evidence_id = Column(String(100), unique=True, index=True, nullable=False)
    
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    stage_id = Column(Integer, ForeignKey("stages.id", ondelete="CASCADE"), nullable=False, index=True)
    supervisor_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    file_path = Column(String(500), nullable=False)
    file_url = Column(String(1000), nullable=True)  # Cloudinary CDN URL
    original_filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(50), nullable=False, default="image/jpeg")
    
    # Cryptographic hashes
    client_sha256 = Column(String(64), nullable=False)
    server_sha256 = Column(String(64), nullable=False, index=True)
    hash_matched = Column(Boolean, default=True, nullable=False)
    
    # Telemetry
    captured_at = Column(DateTime(timezone=True), nullable=False)
    server_received_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy_m = Column(Float, nullable=False)
    
    # Geofence validation results
    distance_to_site_m = Column(Float, nullable=True)
    is_within_radius = Column(Boolean, default=True, nullable=False)
    radius_warning = Column(Boolean, default=False, nullable=False)
    
    # Blockchain anchor tracking
    blockchain_tx = Column(String(100), nullable=True)
    blockchain_status = Column(String(50), default="queued", nullable=False) # queued, submitted, confirmed, failed, simulated
    blockchain_block_number = Column(Integer, nullable=True)
    blockchain_network = Column(String(50), default="sepolia", nullable=False)
    blockchain_chain_id = Column(Integer, default=11155111, nullable=False)

    # AI Construction Vision Analysis
    ai_status = Column(String(50), default="pending", nullable=False) # pending, analyzing, completed, failed
    ai_summary = Column(Text, nullable=True)
    ai_report = Column(Text, nullable=True)
    ai_structured_result = Column(Text, nullable=True)
    ai_analyzed_at = Column(DateTime(timezone=True), nullable=True)
    ai_model = Column(String(100), default="gemini-2.5-flash", nullable=True)

    # Submission status
    status = Column(String(50), default="VERIFIED_SUBMITTED", nullable=False)
    notes = Column(Text, nullable=True)

    project = relationship("Project")
    stage = relationship("Stage")
    supervisor = relationship("User")

    def to_dict(self):
        import json
        from app.config import settings

        # Parse AI structured result
        structured = None
        if self.ai_structured_result:
            try:
                structured = json.loads(self.ai_structured_result)
            except Exception:
                structured = None

        # Build real explorer URL
        is_real_tx = bool(
            self.blockchain_tx
            and not self.blockchain_tx.startswith("0xSIM")
            and not self.blockchain_tx.startswith("0xFAKE")
        )
        explorer_url = f"{settings.EXPLORER_TX_URL}{self.blockchain_tx}" if is_real_tx and settings.EXPLORER_TX_URL else None

        # Standardized sub-objects
        ai_block = {
            "status": self.ai_status or "pending",
            "summary": self.ai_summary,
            "report": self.ai_report,
            "structured_result": structured,
            "analyzed_at": self.ai_analyzed_at.isoformat() if self.ai_analyzed_at else None,
            "model": self.ai_model or settings.GEMINI_MODEL,
            "version": "1.0.0",
            "error": self.ai_report if self.ai_status == "failed" else None,
        }

        chain_block = {
            "status": self.blockchain_status or "queued",
            "network": self.blockchain_network or "sepolia",
            "chain_id": self.blockchain_chain_id or 11155111,
            "transaction_hash": self.blockchain_tx if is_real_tx else (self.blockchain_tx if self.blockchain_status == "simulated" else None),
            "block_number": self.blockchain_block_number,
            "explorer_url": explorer_url,
            "anchored_at": None,
            "contract_address": settings.CONTRACT_ADDRESS,
            "last_error": None,
        }

        return {
            "id": self.id,
            "device_evidence_id": self.device_evidence_id,
            "project_id": self.project_id,
            "stage_id": self.stage_id,
            "project_name": self.project.name if self.project else None,
            "stage_name": self.stage.name if self.stage else None,
            "supervisor_id": self.supervisor_id,
            "supervisor_name": self.supervisor.full_name if self.supervisor else None,
            "file_url": self.file_url,
            "original_filename": self.original_filename,
            "file_size": self.file_size,
            "mime_type": self.mime_type,
            "client_sha256": self.client_sha256,
            "server_sha256": self.server_sha256,
            "hash_matched": self.hash_matched,
            "captured_at": self.captured_at.isoformat() if self.captured_at else None,
            "server_received_at": self.server_received_at.isoformat() if self.server_received_at else None,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "accuracy_m": self.accuracy_m,
            "distance_to_site_m": self.distance_to_site_m,
            "is_within_radius": self.is_within_radius,
            "radius_warning": self.radius_warning,
            "blockchain_tx": self.blockchain_tx,
            "blockchain_status": self.blockchain_status,
            "status": self.status,
            "notes": self.notes,
            # Extended fields
            "ai_analysis": ai_block,
            "blockchain": chain_block,
        }

