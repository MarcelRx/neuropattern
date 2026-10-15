"""
Tests for database connection lifecycle and cleanup.

Verifies that database connections are properly managed and don't leak.
"""

from datetime import UTC, datetime

import pytest
from app.database import DatabaseManager
from bson import ObjectId
from tests.test_database_helpers import (
    configure_test_mongodb,
    restore_test_mongodb,
)


async def configure_test_database():
    """Configure a safe test database and preserve the original client."""
    original_state = configure_test_mongodb()
    original_client = DatabaseManager._client
    DatabaseManager._client = None
    return original_state, original_client


async def restore_database_configuration(original_state, original_client):
    """Close the test client and restore the original configuration."""
    test_client = DatabaseManager._client

    try:
        if test_client is not None and test_client is not original_client:
            await DatabaseManager.close_connection()
    finally:
        DatabaseManager._client = original_client
        restore_test_mongodb(original_state)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_database_singleton():
    """Verify repeated calls return the same client instance."""
    original_state, original_client = await configure_test_database()

    try:
        client1 = DatabaseManager.get_client()
        client2 = DatabaseManager.get_client()

        assert client1 is client2
    finally:
        await restore_database_configuration(original_state, original_client)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_database_connection_cleanup():
    """Verify closing the database connection resets the singleton."""
    original_state, original_client = await configure_test_database()

    try:
        client = DatabaseManager.get_client()

        assert client is not None
        assert DatabaseManager._client is client

        await DatabaseManager.close_connection()

        assert DatabaseManager._client is None
    finally:
        await restore_database_configuration(original_state, original_client)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_database_test_isolation():
    """Verify test data is stored in and removed from the test database."""
    original_state, original_client = await configure_test_database()
    user_id = ObjectId()

    try:
        db = DatabaseManager.get_db()
        await db.command("ping")

        await db.users.insert_one(
            {
                "_id": user_id,
                "email": f"{user_id}@example.com",
                "password_hash": "test-hash",
                "full_name": "Test User",
                "created_at": datetime.now(UTC),
                "is_verified": True,
            }
        )

        user = await db.users.find_one({"_id": user_id})
        assert user is not None
        assert user["email"] == f"{user_id}@example.com"

        result = await db.users.delete_one({"_id": user_id})
        assert result.deleted_count == 1

        user_after = await db.users.find_one({"_id": user_id})
        assert user_after is None
    finally:
        await restore_database_configuration(original_state, original_client)
