import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./siteverify.db"
    FIREBASE_SERVICE_ACCOUNT_PATH: str = "./secrets/firebase-service-account.json"
    FIREBASE_PROJECT_ID: str = "constra-b561b"
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    BOOTSTRAP_ADMIN_EMAIL: Optional[str] = None

    # Store Module Settings
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_MB: int = 10
    OCR_MODE: str = "real"  # real | fake
    TESSERACT_CMD: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
