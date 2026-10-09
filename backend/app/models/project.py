from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Numeric, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    site_address = Column(String(255), nullable=True)
    centroid_lat = Column(Float, nullable=True)
    centroid_lng = Column(Float, nullable=True)
    site_radius_m = Column(Float, default=200.0, nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    settings = relationship("ProjectSettings", back_populates="project", uselist=False, cascade="all, delete-orphan")
    stages = relationship("Stage", back_populates="project", cascade="all, delete-orphan")


class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), nullable=False)

    project = relationship("Project", back_populates="members")
    user = relationship("User")


class ProjectSettings(Base):
    __tablename__ = "project_settings"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), unique=True, nullable=False)
    boq_tolerance_pct = Column(Numeric(5, 2), default=5.0, nullable=False)
    expected_usage_tolerance = Column(Numeric(5, 2), default=0.15, nullable=False)
    zscore_limit = Column(Numeric(5, 2), default=2.5, nullable=False)
    allow_new_vendors = Column(Integer, default=1, nullable=False)  # boolean flag

    project = relationship("Project", back_populates="settings")


class Stage(Base):
    __tablename__ = "stages"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    order = Column(Integer, default=1, nullable=False)
    status = Column(String(50), default="PENDING", nullable=False)
    verified_progress = Column(Numeric(5, 4), default=0.0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project = relationship("Project", back_populates="stages")
