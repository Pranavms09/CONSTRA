import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./siteverify.db"
    FIREBASE_SERVICE_ACCOUNT_PATH: str = "backend/secrets/firebase-service-account.json"
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
    ANTHROPIC_API_KEY: Optional[str] = None

    # Cloudinary CDN for Evidence Image Storage
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None

    # Blockchain Anchoring Settings
    CHAIN_MODE: str = "fake"  # fake | real
    RPC_URL: Optional[str] = None
    CHAIN_ID: Optional[int] = None
    CONTRACT_ADDRESS: Optional[str] = None
    ANCHOR_PRIVATE_KEY: Optional[str] = None  # throwaway testnet wallet ONLY
    EXPLORER_TX_URL: Optional[str] = "https://sepolia.etherscan.io/tx/"
    EXPLORER_ADDRESS_URL: Optional[str] = "https://sepolia.etherscan.io/address/"
    ANCHOR_BATCH_SIZE: int = 20
    ANCHOR_BATCH_INTERVAL_SEC: int = 20
    ANCHOR_MAX_RETRIES: int = 5
    SHOW_CHAIN_COPY: bool = False

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def validate_chain_configuration(self):
        if self.CHAIN_MODE.lower() == "real":
            missing = []
            if not self.RPC_URL or not self.RPC_URL.strip():
                missing.append("RPC_URL")
            if not self.CHAIN_ID:
                missing.append("CHAIN_ID")
            if not self.CONTRACT_ADDRESS or not self.CONTRACT_ADDRESS.strip():
                missing.append("CONTRACT_ADDRESS")
            if not self.ANCHOR_PRIVATE_KEY or not self.ANCHOR_PRIVATE_KEY.strip():
                missing.append("ANCHOR_PRIVATE_KEY")
            if missing:
                raise ValueError(
                    f"Blockchain configuration error: CHAIN_MODE is 'real' but missing: {', '.join(missing)}"
                )

    @property
    def masked_private_key(self) -> str:
        if not self.ANCHOR_PRIVATE_KEY:
            return ""
        val = self.ANCHOR_PRIVATE_KEY.strip()
        if len(val) <= 8:
            return "****"
        return f"{val[:4]}...{val[-4:]}"

    @property
    def masked_rpc_url(self) -> str:
        if not self.RPC_URL:
            return ""
        from urllib.parse import urlparse
        try:
            parsed = urlparse(self.RPC_URL.strip())
            return f"{parsed.scheme}://{parsed.netloc}/***masked***" if parsed.netloc else "***masked***"
        except Exception:
            return "***masked***"


settings = Settings()
settings.validate_chain_configuration()


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
