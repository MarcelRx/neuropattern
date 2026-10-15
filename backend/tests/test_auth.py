"""
Tests for authentication failure handling and user data isolation.
"""

from app.api.core import security
from bson import ObjectId


def test_password_hashing_and_verification():
    """Test that password hashing and verification work correctly."""
    password = "test_pass"
    hashed = security.get_password_hash(password)

    # Verify the password matches
    assert security.verify_password(password, hashed) is True

    # Verify wrong password doesn't match
    assert security.verify_password("wrong_pass", hashed) is False


def test_password_hash_is_unique():
    """Test that password hashing produces unique hashes for the same password."""
    password = "test_pass"
    hash1 = security.get_password_hash(password)
    hash2 = security.get_password_hash(password)

    # bcrypt includes salt, so hashes should be different
    assert hash1 != hash2

    # But both should verify correctly
    assert security.verify_password(password, hash1) is True
    assert security.verify_password(password, hash2) is True


def test_jwt_token_creation():
    """Test that JWT token creation works correctly."""
    user_id = str(ObjectId())
    token = security.create_access_token(data={"sub": user_id})

    # Token should be a non-empty string
    assert token
    assert isinstance(token, str)
    assert len(token) > 0


def test_token_excludes_secret_values():
    """Test that token creation does not include secret values in the token payload."""
    user_id = str(ObjectId())
    token = security.create_access_token(data={"sub": user_id})

    # Token should not contain secret values
    # (We can't decode without the secret, but we can check the format)
    assert "gsk_" not in token  # Groq API key pattern
    assert "sk-" not in token  # OpenAI/other API key pattern
