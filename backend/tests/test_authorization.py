"""
Integration tests for authorization and data isolation.

These tests require a local MongoDB instance and use a dedicated test
database. They verify database query isolation and JWT validation.
"""

from datetime import UTC, datetime

import pytest
import pytest_asyncio
from app.api.core import security
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
        # Use a separate client configured for the local test database.
        DatabaseManager._client = None

        db = DatabaseManager.get_db()
        test_client = DatabaseManager._client

        await db.command("ping")
        yield db

    finally:
        try:
            if test_client is not None and test_client is not original_client:
                test_client.close()
        finally:
            DatabaseManager._client = original_client
            restore_test_mongodb(original_state)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_user_cannot_access_another_users_logs(test_db):
    """Verify that user-scoped queries cannot expose another user's logs."""
    user_a_id = ObjectId()
    user_b_id = ObjectId()
    now = datetime.now(UTC)

    await test_db.users.insert_many(
        [
            {
                "_id": user_a_id,
                "email": f"{user_a_id}@example.com",
                "password_hash": security.get_password_hash("passwordA"),
                "full_name": "User A",
                "created_at": now,
                "is_verified": True,
            },
            {
                "_id": user_b_id,
                "email": f"{user_b_id}@example.com",
                "password_hash": security.get_password_hash("passwordB"),
                "full_name": "User B",
                "created_at": now,
                "is_verified": True,
            },
        ]
    )

    log_b_result = await test_db.logs.insert_one(
        {
            "user_id": user_b_id,
            "score": 85,
            "mood": "excited",
            "summary": "User B's log entry",
            "timestamp": now,
        }
    )
    log_b_id = log_b_result.inserted_id

    await test_db.logs.insert_one(
        {
            "user_id": user_a_id,
            "score": 75,
            "mood": "happy",
            "summary": "User A's log entry",
            "timestamp": now,
        }
    )

    logs_for_a = await test_db.logs.find({"user_id": user_a_id}).to_list(length=100)

    assert len(logs_for_a) == 1
    assert logs_for_a[0]["user_id"] == user_a_id
    assert logs_for_a[0]["summary"] == "User A's log entry"

    log_b_as_a = await test_db.logs.find_one({"_id": log_b_id, "user_id": user_a_id})
    assert log_b_as_a is None

    log_b_correct = await test_db.logs.find_one({"_id": log_b_id, "user_id": user_b_id})
    assert log_b_correct is not None
    assert log_b_correct["summary"] == "User B's log entry"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_user_can_retrieve_own_logs(test_db):
    """Verify that a user can retrieve their own logs."""
    user_id = ObjectId()
    now = datetime.now(UTC)

    await test_db.users.insert_one(
        {
            "_id": user_id,
            "email": f"{user_id}@example.com",
            "password_hash": security.get_password_hash("testpass"),
            "full_name": "Test User",
            "created_at": now,
            "is_verified": True,
        }
    )

    await test_db.logs.insert_many(
        [
            {
                "user_id": user_id,
                "score": 75,
                "mood": "happy",
                "summary": "Log entry 1",
                "timestamp": now,
            },
            {
                "user_id": user_id,
                "score": 85,
                "mood": "excited",
                "summary": "Log entry 2",
                "timestamp": now,
            },
        ]
    )

    user_logs = (
        await test_db.logs.find({"user_id": user_id}).sort("timestamp", -1).to_list(length=100)
    )

    assert len(user_logs) == 2
    assert all(log["user_id"] == user_id for log in user_logs)
    assert {log["summary"] for log in user_logs} == {
        "Log entry 1",
        "Log entry 2",
    }


@pytest.mark.integration
@pytest.mark.asyncio
async def test_clear_logs_only_affects_authenticated_user(test_db):
    """Verify that deleting one user's logs leaves another user's logs intact."""
    user_a_id = ObjectId()
    user_b_id = ObjectId()
    now = datetime.now(UTC)

    await test_db.users.insert_many(
        [
            {
                "_id": user_a_id,
                "email": f"{user_a_id}@example.com",
                "password_hash": security.get_password_hash("passwordA"),
                "full_name": "User A",
                "created_at": now,
                "is_verified": True,
            },
            {
                "_id": user_b_id,
                "email": f"{user_b_id}@example.com",
                "password_hash": security.get_password_hash("passwordB"),
                "full_name": "User B",
                "created_at": now,
                "is_verified": True,
            },
        ]
    )

    await test_db.logs.insert_many(
        [
            {
                "user_id": user_a_id,
                "score": 75,
                "mood": "happy",
                "summary": "User A's log",
                "timestamp": now,
            },
            {
                "user_id": user_b_id,
                "score": 85,
                "mood": "excited",
                "summary": "User B's log",
                "timestamp": now,
            },
        ]
    )

    result = await test_db.logs.delete_many({"user_id": user_a_id})
    assert result.deleted_count == 1

    b_logs = await test_db.logs.find({"user_id": user_b_id}).to_list(length=100)

    assert len(b_logs) == 1
    assert b_logs[0]["summary"] == "User B's log"

    a_logs = await test_db.logs.find({"user_id": user_a_id}).to_list(length=100)

    assert a_logs == []


@pytest.mark.integration
@pytest.mark.asyncio
async def test_token_validation_rejects_invalid_token(test_db):
    """Verify that an invalid JWT token is rejected."""

    class MockRequest:
        def __init__(self):
            self.headers = {"authorization": "Bearer invalid_token_12345"}

    with pytest.raises(HTTPException) as exc_info:
        await security.get_current_user(
            MockRequest(),
            "invalid_token_12345",
            test_db,
        )

    assert exc_info.value.status_code == 401


@pytest.mark.integration
@pytest.mark.asyncio
async def test_token_validation_rejects_missing_token(test_db):
    """Verify that missing credentials are rejected."""

    class MockRequest:
        def __init__(self):
            self.headers = {}

    with pytest.raises(HTTPException) as exc_info:
        await security.get_current_user(
            MockRequest(),
            None,
            test_db,
        )

    assert exc_info.value.status_code == 401


@pytest.mark.integration
@pytest.mark.asyncio
async def test_token_validation_rejects_nonexistent_user(test_db):
    """Verify that a valid-format token for an unknown user is rejected."""
    fake_user_id = str(ObjectId())
    token = security.create_access_token(data={"sub": fake_user_id})

    class MockRequest:
        def __init__(self):
            self.headers = {"authorization": f"Bearer {token}"}

    with pytest.raises(HTTPException) as exc_info:
        await security.get_current_user(
            MockRequest(),
            token,
            test_db,
        )

    assert exc_info.value.status_code == 401
