from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from app.database import Base


class ImageAnalysis(Base):
    """
    Persistent store for AI-generated image analyses.
    Ensures backend provenance and immutability of AI-generated descriptions.
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
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self):
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
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
