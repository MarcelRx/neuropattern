from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

from app.api.core.security import get_current_user
from app.database import get_db
from app.main import app
from bson import ObjectId
from fastapi.testclient import TestClient


def test_get_logs_scoped_to_current_user():
    user_id = ObjectId()
    log = {
        "_id": ObjectId(),
        "timestamp": datetime.now(UTC),
        "score": 85,
        "mood": "excited",
        "summary": "Current user log",
        "sentiment": "positive",
    }

    cursor = MagicMock()
    cursor.sort.return_value.to_list = AsyncMock(return_value=[log])

    db = MagicMock()
    db.logs.find.return_value = cursor

    async def current_user():
        return {"_id": user_id}

    app.dependency_overrides[get_current_user] = current_user
    app.dependency_overrides[get_db] = lambda: db

    try:
        response = TestClient(app).get("/api/v1/logs")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()[0]["summary"] == "Current user log"
    db.logs.find.assert_called_once_with({"user_id": user_id})


def test_clear_logs_scoped_to_current_user():
    user_id = ObjectId()

    db = MagicMock()
    db.logs.delete_many = AsyncMock(return_value=SimpleNamespace(deleted_count=2))

    async def current_user():
        return {"_id": user_id}

    app.dependency_overrides[get_current_user] = current_user
    app.dependency_overrides[get_db] = lambda: db

    try:
        response = TestClient(app).delete("/api/v1/logs/clear")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"message": "Successfully deleted 2 logs."}
    db.logs.delete_many.assert_awaited_once_with({"user_id": user_id})
