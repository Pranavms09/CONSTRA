import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./siteverify.db"
    FIREBASE_SERVICE_ACCOUNT_PATH: str = "./secrets/firebase-service-account.json"
    FIREBASE_PROJECT_ID: str = "constra-b561b"
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    BOOTSTRAP_ADMIN_EMAIL: Optional[str] = None
    SECRET_KEY: str = "siteverify-secret-key-2025-constra-apex"
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Store Module Settings
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_MB: int = 10
    OCR_MODE: str = "real"  # real | fake
    TESSERACT_CMD: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    ANTHROPIC_API_KEY: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()


def get_gemini_api_key() -> Optional[str]:
    """
    Returns the latest GEMINI_API_KEY from environment or directly from .env,
    allowing hot-reloading when .env is edited without requiring a server restart.
    """
    if os.environ.get("GEMINI_API_KEY"):
        val = os.environ.get("GEMINI_API_KEY", "").strip()
        if val and val != "your_actual_api_key":
            return val

    # Dynamic check of .env files
    for env_path in [".env", "backend/.env", "../backend/.env"]:
        if os.path.exists(env_path):
            try:
                from dotenv import dotenv_values
                env_vals = dotenv_values(env_path)
                val = env_vals.get("GEMINI_API_KEY")
                if val and val.strip() and val.strip() != "your_actual_api_key":
                    return val.strip()
            except Exception:
                pass

    if settings.GEMINI_API_KEY:
        val = settings.GEMINI_API_KEY.strip()
        if val and val != "your_actual_api_key":
            return val

    return None
