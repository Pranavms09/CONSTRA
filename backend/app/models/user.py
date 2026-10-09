import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, func
from app.database import Base


class UserRole(str, enum.Enum):
    SUPERVISOR = "supervisor"
    STORE_INCHARGE = "store_incharge"
    AUDITOR = "auditor"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(
        Enum("supervisor", "store_incharge", "auditor", name="user_role"),
        nullable=False
    )
    password_hash = Column(String(255), nullable=True)
    firebase_uid = Column(String(128), unique=True, index=True, nullable=True)
    auth_provider = Column(String(20), nullable=False, default="google")
    is_active = Column(Boolean, default=True, nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    def to_dict(self):
        return {
            "id": self.id,
            "full_name": self.full_name,
            "email": self.email,
            "role": self.role,
        }
