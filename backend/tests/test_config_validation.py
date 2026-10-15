"""
Tests for production configuration validation.
"""

import os

import pytest
from app.api.core.config import Settings


def test_development_allows_placeholder_secrets():
    """Verify that development environment allows placeholder secrets."""
    os.environ["ENVIRONMENT"] = "development"
    os.environ["SECRET_KEY"] = "dev-secret-change-in-production"
    os.environ["JWT_SECRET_KEY"] = "dev-jwt-secret-change-in-production"

    settings = Settings()
    assert settings.ENVIRONMENT == "development"
    assert settings.SECRET_KEY == "dev-secret-change-in-production"
    assert settings.JWT_SECRET_KEY == "dev-jwt-secret-change-in-production"


def test_production_rejects_placeholder_secrets():
    """Verify that production environment rejects placeholder secrets."""
    os.environ["ENVIRONMENT"] = "production"
    os.environ["SECRET_KEY"] = "dev-secret-change-in-production"
    os.environ["JWT_SECRET_KEY"] = "dev-jwt-secret-change-in-production"

    with pytest.raises(ValueError) as exc_info:
        Settings()

    assert "SECRET_KEY must be set to a secure value" in str(exc_info.value)
    assert "JWT_SECRET_KEY must be set to a secure value" in str(exc_info.value)


def test_production_accepts_secure_secrets():
    """Verify that production environment accepts secure secrets."""
    os.environ["ENVIRONMENT"] = "production"
    os.environ["SECRET_KEY"] = "a" * 64  # 64-character secure secret
    os.environ["JWT_SECRET_KEY"] = "b" * 64  # 64-character secure secret

    settings = Settings()
    assert settings.ENVIRONMENT == "production"
    assert settings.SECRET_KEY == "a" * 64
    assert settings.JWT_SECRET_KEY == "b" * 64


def test_production_rejects_empty_secrets():
    """Verify that production environment rejects empty secrets."""
    os.environ["ENVIRONMENT"] = "production"
    os.environ["SECRET_KEY"] = ""
    os.environ["JWT_SECRET_KEY"] = ""

    with pytest.raises(ValueError) as exc_info:
        Settings()

    assert "SECRET_KEY must be set to a secure value" in str(exc_info.value)
    assert "JWT_SECRET_KEY must be set to a secure value" in str(exc_info.value)


def test_production_rejects_short_db_password():
    """Verify that production environment rejects short database passwords."""
    os.environ["ENVIRONMENT"] = "production"
    os.environ["SECRET_KEY"] = "a" * 64
    os.environ["JWT_SECRET_KEY"] = "b" * 64
    os.environ["DB_USER"] = "appuser"
    os.environ["DB_PASSWORD"] = "short"  # Too short

    with pytest.raises(ValueError) as exc_info:
        Settings()

    assert "DB_PASSWORD must be set to a secure value" in str(exc_info.value)


def test_production_accepts_secure_db_password():
    """Verify that production environment accepts secure database passwords."""
    os.environ["ENVIRONMENT"] = "production"
    os.environ["SECRET_KEY"] = "a" * 64
    os.environ["JWT_SECRET_KEY"] = "b" * 64
    os.environ["DB_USER"] = "appuser"
    os.environ["DB_PASSWORD"] = "c" * 32  # Secure password

    settings = Settings()
    assert settings.DB_PASSWORD == "c" * 32


def test_production_does_not_validate_db_password_without_user():
    """Verify that production environment only validates DB_PASSWORD when DB_USER is set."""
    os.environ["ENVIRONMENT"] = "production"
    os.environ["SECRET_KEY"] = "a" * 64
    os.environ["JWT_SECRET_KEY"] = "b" * 64
    os.environ["DB_USER"] = ""  # No user set
    os.environ["DB_PASSWORD"] = "short"  # Should not be validated

    settings = Settings()
    assert settings.DB_PASSWORD == "short"  # No error raised


def test_production_rejects_changeme_placeholder():
    """Verify that production environment rejects 'changeme' placeholder."""
    os.environ["ENVIRONMENT"] = "production"
    os.environ["SECRET_KEY"] = "changeme"
    os.environ["JWT_SECRET_KEY"] = "b" * 64

    with pytest.raises(ValueError) as exc_info:
        Settings()

    assert "SECRET_KEY must be set to a secure value" in str(exc_info.value)
