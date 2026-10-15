"""
Integration tests for logs API endpoints with real database and authentication.

These tests require a running local MongoDB instance and use a dedicated
test database. They verify API behavior, authentication, and data isolation.
"""

from datetime import UTC, datetime

import pytest
import pytest_asyncio
from app.api.core import security
from app.api.v1.endpoints.logs import clear_logs, get_logs
from app.database import DatabaseManager
from bson import ObjectId
from fastapi import HTTPException
from tests.test_database_helpers import (
    configure_test_mongodb,
    restore_test_mongodb,
)


@pytest_asyncio.fixture
async def test_db():
    """Provide a safe test database and restore the original connection."""
    original_state = configure_test_mongodb()
    original_client = DatabaseManager._client
    test_client = None

    try:
        # Never reuse an application client for integration tests.
        DatabaseManager._client = None

        db = DatabaseManager.get_db()
        test_client = DatabaseManager._client

        await db.command("ping")
        yield db

    except Exception as exc:
        if test_client is None:
            pytest.fail(
                f"Local MongoDB is not available for integration tests: {exc}",
                pytrace=True,
            )
        raise

    finally:
        try:
            # Close only the client created for this test fixture.
            if test_client is not None and test_client is not original_client:
                test_client.close()
        finally:
            DatabaseManager._client = original_client
            restore_test_mongodb(original_state)


@pytest_asyncio.fixture
async def test_user(test_db):
    """Create a test user and remove only that user's data afterward."""
    user_id = ObjectId()
    user_data = {
        "_id": user_id,
        "email": f"{user_id}@example.com",
        "password_hash": security.get_password_hash("testpass123"),
        "full_name": "Test User",
        "created_at": datetime.now(UTC),
        "is_verified": True,
    }

    await test_db.users.insert_one(user_data)
    token = security.create_access_token(data={"sub": str(user_id)})

    try:
        yield {"user": user_data, "token": token}
    finally:
        await test_db.logs.delete_many({"user_id": user_id})
        await test_db.users.delete_one({"_id": user_id})


@pytest_asyncio.fixture
async def test_user_b(test_db):
    """Create a second test user and remove only that user's data afterward."""
    user_id = ObjectId()
    user_data = {
        "_id": user_id,
        "email": f"{user_id}@example.com",
        "password_hash": security.get_password_hash("testpass456"),
        "full_name": "Test User B",
        "created_at": datetime.now(UTC),
        "is_verified": True,
    }

    await test_db.users.insert_one(user_data)
    token = security.create_access_token(data={"sub": str(user_id)})

    try:
        yield {"user": user_data, "token": token}
    finally:
        await test_db.logs.delete_many({"user_id": user_id})
        await test_db.users.delete_one({"_id": user_id})


@pytest.mark.integration
@pytest.mark.asyncio
async def test_get_logs_authenticated(test_db, test_user):
    """Verify that an authenticated user can retrieve their own logs."""
    log_data = {
        "user_id": test_user["user"]["_id"],
        "score": 85,
        "mood": "excited",
        "summary": "Test log entry",
        "timestamp": datetime.now(UTC),
    }
    await test_db.logs.insert_one(log_data)

    logs = await get_logs(current_user=test_user["user"], db=test_db)

    assert len(logs) == 1
    assert logs[0]["summary"] == "Test log entry"
    assert logs[0]["score"] == 85


@pytest.mark.integration
@pytest.mark.asyncio
async def test_get_logs_empty(test_db, test_user):
    """Verify that an empty list is returned when the user has no logs."""
    logs = await get_logs(current_user=test_user["user"], db=test_db)

    assert logs == []


@pytest.mark.integration
@pytest.mark.asyncio
async def test_get_logs_user_isolation(test_db, test_user, test_user_b):
    """Verify that User A cannot retrieve User B's logs."""
    log_b = {
        "user_id": test_user_b["user"]["_id"],
        "score": 75,
        "mood": "happy",
        "summary": "User B's log",
        "timestamp": datetime.now(UTC),
    }
    await test_db.logs.insert_one(log_b)

    logs = await get_logs(current_user=test_user["user"], db=test_db)

    assert logs == []


@pytest.mark.integration
@pytest.mark.asyncio
async def test_clear_logs_authenticated(test_db, test_user):
    """Verify that an authenticated user can clear their own logs."""
    user_id = test_user["user"]["_id"]

    for i in range(3):
        await test_db.logs.insert_one(
            {
                "user_id": user_id,
                "score": 80 + i,
                "mood": "happy",
                "summary": f"Log entry {i}",
                "timestamp": datetime.now(UTC),
            }
        )

    result = await clear_logs(current_user=test_user["user"], db=test_db)

    assert "Successfully deleted 3 logs" in result["message"]

    logs = await test_db.logs.find({"user_id": user_id}).to_list(length=100)
    assert logs == []


@pytest.mark.integration
@pytest.mark.asyncio
async def test_clear_logs_user_isolation(test_db, test_user, test_user_b):
    """Verify that clearing User A's logs preserves User B's logs."""
    user_a_id = test_user["user"]["_id"]
    user_b_id = test_user_b["user"]["_id"]

    await test_db.logs.insert_one(
        {
            "user_id": user_a_id,
            "score": 85,
            "mood": "excited",
            "summary": "User A's log",
            "timestamp": datetime.now(UTC),
        }
    )

    await test_db.logs.insert_one(
        {
            "user_id": user_b_id,
            "score": 75,
            "mood": "happy",
            "summary": "User B's log",
            "timestamp": datetime.now(UTC),
        }
    )

    result = await clear_logs(current_user=test_user["user"], db=test_db)

    assert "Successfully deleted 1 log" in result["message"]

    b_logs = await test_db.logs.find({"user_id": user_b_id}).to_list(length=100)
    assert len(b_logs) == 1
    assert b_logs[0]["summary"] == "User B's log"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_clear_logs_empty(test_db, test_user):
    """Verify that clearing logs with no records returns 404."""
    with pytest.raises(HTTPException) as exc_info:
        await clear_logs(current_user=test_user["user"], db=test_db)

    assert exc_info.value.status_code == 404
    assert "No logs found" in str(exc_info.value.detail)
