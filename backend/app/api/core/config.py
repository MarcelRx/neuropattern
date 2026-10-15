"""
Configuration Module

Manages all application settings using Pydantic Settings.
Loads configuration from environment variables and .env files.
"""

import json
import logging
import os

from dotenv import load_dotenv
from pydantic import model_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)
load_dotenv()


def _parse_cors_origins() -> list[str]:
    """Parse CORS_ORIGINS from environment variable.

    Supports multiple formats:
    - JSON array: '["http://localhost:3000", "http://127.0.0.1:3000"]'
    - Comma-separated: 'http://localhost:3000,http://127.0.0.1:3000'
    - Single value: 'http://localhost:3000'
    """
    raw = os.getenv("CORS_ORIGINS", "")

    if not raw or not raw.strip():
        return ["http://localhost:3000", "http://127.0.0.1:3000"]

    raw = raw.strip()

    # Try JSON parsing first (for quoted arrays)
    if raw.startswith("[") and raw.endswith("]"):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if item]
            return [str(parsed)]
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse CORS_ORIGINS as JSON: {raw}")

    # Fall back to comma-separated string
    if "," in raw:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    # Single origin
    return [raw]


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application Info
    APP_NAME: str = "NeuroPattern LifeTracker"
    VERSION: str = "2.5.0"

    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS Configuration — use a plain str field to avoid pydantic-settings auto-parsing
    # We parse it manually in the property below
    _cors_origins_raw: str = ""

    # JWT Security
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    SECRET_KEY: str = "dev-secret-change-in-production"
    JWT_SECRET_KEY: str = "dev-jwt-secret-change-in-production"

    # MongoDB Configuration
    DB_HOST: str = "mongodb"
    DB_PORT: str = "27017"
    DB_NAME: str = "neuropattern"
    DB_USER: str = ""
    DB_PASSWORD: str = ""

    # AI Services
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-specdec"
    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_VOICE_ID: str = "BpjGufoPiobT79j2vtj4"
    ELEVENLABS_MODEL_ID: str = "eleven_multilingual_v2"

    # Email Configuration
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "noreply@neuropattern.app"
    FRONTEND_URL: str = "http://localhost:8000"
    BACKEND_URL: str = "http://localhost:8000"

    # Environment
    ENVIRONMENT: str = "development"

    @property
    def CORS_ORIGINS(self) -> list[str]:
        """Generate CORS origins list from environment."""
        return _parse_cors_origins()

    @property
    def MONGODB_URL(self) -> str:
        """Generate MongoDB connection URL."""
        uri = os.getenv("MONGODB_URI", "")
        if uri:
            return uri

        if self.DB_USER and self.DB_PASSWORD:
            return f"mongodb://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?authSource={self.DB_NAME}"
        return f"mongodb://{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def DATABASE_NAME(self) -> str:
        """Return database name."""
        return self.DB_NAME

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        """Validate that production secrets are not using development placeholders."""
        if self.ENVIRONMENT != "production":
            return self

        # Known insecure development placeholders
        insecure_placeholders = {
            "dev-secret-change-in-production",
            "dev-jwt-secret-change-in-production",
            "changeme",
            "your_secret_key_here",
            "your_jwt_secret_key_here",
            "dev-jwt-secret",
            "dev-secret",
        }

        errors = []

        # Check SECRET_KEY
        if not self.SECRET_KEY or self.SECRET_KEY in insecure_placeholders:
            errors.append("SECRET_KEY must be set to a secure value in production")

        # Check JWT_SECRET_KEY
        if not self.JWT_SECRET_KEY or self.JWT_SECRET_KEY in insecure_placeholders:
            errors.append("JWT_SECRET_KEY must be set to a secure value in production")

        # Check database credentials (if using auth)
        if (
            self.DB_USER
            and self.DB_PASSWORD
            and (self.DB_PASSWORD in insecure_placeholders or len(self.DB_PASSWORD) < 16)
        ):
            errors.append("DB_PASSWORD must be set to a secure value in production")

        # If errors found, raise ValidationError
        if errors:
            raise ValueError("Production configuration validation failed: " + "; ".join(errors))

        return self

    model_config = {
        "case_sensitive": True,
        "ignored_types": (property,),
    }


# Global settings instance
settings = Settings()
