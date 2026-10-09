from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from app.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    stage_id = Column(Integer, ForeignKey("stages.id", ondelete="SET NULL"), nullable=True, index=True)
    challan_id = Column(Integer, ForeignKey("challans.id", ondelete="SET NULL"), nullable=True, index=True)
    issue_id = Column(Integer, ForeignKey("material_issues.id", ondelete="SET NULL"), nullable=True, index=True)
    photo_id = Column(Integer, nullable=True)
    type = Column(String(100), nullable=False)
    severity = Column(String(20), nullable=False)  # low, medium, high, critical
    status = Column(String(20), default="open", nullable=False)  # open, acknowledged, resolved, escalated
    explanation = Column(Text, nullable=False)
    evidence = Column(Text, nullable=True)  # JSON-encoded dict
    auditor_comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    project = relationship("Project")
    stage = relationship("Stage")
    challan = relationship("Challan")
    issue = relationship("MaterialIssue")
