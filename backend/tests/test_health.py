from app.api.core.config import settings


def test_settings_load():
    """Verifies that the backend settings initialize correctly in the CI environment."""
    assert settings.APP_NAME == "NeuroPattern LifeTracker"
    assert settings.VERSION is not None
    assert settings.ENVIRONMENT in ["development", "production", "testing"]
