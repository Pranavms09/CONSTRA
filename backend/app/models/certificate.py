from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base


class ClearanceCertificate(Base):
    """
    Cryptographically verifiable construction milestone clearance certificate.
    Generated only upon successful auditor approval when all verification criteria are satisfied.
    """
    __tablename__ = "clearance_certificates"

    id = Column(Integer, primary_key=True, index=True)
    certificate_number = Column(String(100), unique=True, nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    stage_id = Column(Integer, ForeignKey("stages.id", ondelete="CASCADE"), nullable=False)
    claim_id = Column(String(100), nullable=True)
    auditor_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    verdict = Column(String(50), nullable=False, default="CLEARED")
    verdict_note = Column(Text, nullable=True)
    evidence_hashes = Column(Text, nullable=True)  # JSON-encoded array of SHA-256 hashes
    verification_summary = Column(Text, nullable=True)  # JSON-encoded verification outcomes
    certificate_hash = Column(String(64), nullable=False, index=True)  # SHA-256 seal of entire cert
    issued_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    project = relationship("Project")
    stage = relationship("Stage")
    auditor = relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "certificate_number": self.certificate_number,
            "project_id": self.project_id,
            "stage_id": self.stage_id,
            "claim_id": self.claim_id,
            "auditor_id": self.auditor_id,
            "auditor_name": self.auditor.full_name if self.auditor else None,
            "auditor_email": self.auditor.email if self.auditor else None,
            "verdict": self.verdict,
            "verdict_note": self.verdict_note,
            "evidence_hashes": self.evidence_hashes,
            "verification_summary": self.verification_summary,
            "certificate_hash": self.certificate_hash,
            "issued_at": self.issued_at.isoformat() if self.issued_at else None,
        }
