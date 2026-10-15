
from app.api.core import security as auth
from app.api.models.models import LogResponse
from app.database import get_db
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter()


@router.get("/logs", response_model=list[LogResponse])
async def get_logs(
    current_user: dict = Depends(auth.get_current_user),
    db = Depends(get_db)
):
    """Get all life logs/check-ins for current user."""
    cursor = db.logs.find({"user_id": current_user["_id"]}).sort("timestamp", -1)
    logs = await cursor.to_list(length=100)

    return [
        {
            "id": str(log["_id"]),
            "timestamp": log["timestamp"].isoformat() if log.get("timestamp") else None,
            "score": log["score"],
            "mood": log["mood"],
            "summary": log["summary"],
            "sentiment": log.get("sentiment"),
        }
        for log in logs
    ]


@router.delete("/logs/clear")
async def clear_logs(
    current_user: dict = Depends(auth.get_current_user),
    db = Depends(get_db)
):
    """Clear all logs for the current user."""
    result = await db.logs.delete_many({"user_id": current_user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No logs found to delete")
    return {"message": f"Successfully deleted {result.deleted_count} logs."}
