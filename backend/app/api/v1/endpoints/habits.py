
from app.api.core import security as auth
from app.api.models.models import HabitResponse
from app.database import get_db
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter()


@router.get("/habits", response_model=list[HabitResponse])
async def get_habits(
    current_user: dict = Depends(auth.get_current_user),
    db = Depends(get_db)
):
    """Get all habits for current user with computed progress fields."""
    cursor = db.habits.find({"user_id": current_user["_id"]})
    habits = await cursor.to_list(length=50)

    result = []
    for habit in habits:
        history = habit.get("history", [])
        # Only calculate progress based on the last 7 days
        weekly_history = history[-7:] if len(history) >= 7 else history
        completed = len([h for h in weekly_history if h])

        # Progress relative to 7 days
        progress = min(100, int((completed / 7) * 100)) if weekly_history else 0

        result.append({
            "id": str(habit["_id"]),
            "name": habit["name"],
            "icon": habit["icon"],
            "goal": habit["goal"],
            "color": habit["color"],
            "history": history,
            "currentValue": completed,
            "progress": progress
        })

    return result


@router.post("/habits/{habit_id}/toggle")
async def toggle_habit(
    habit_id: str,
    current_user: dict = Depends(auth.get_current_user),
    db = Depends(get_db)
):
    """Toggle the last day of habit history."""
    try:
        habit = await db.habits.find_one({
            "_id": ObjectId(habit_id),
            "user_id": current_user["_id"]
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid habit ID")

    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")

    history = list(habit.get("history", [False]))
    if not history:
        history = [False]

    history[-1] = not history[-1]
    await db.habits.update_one({"_id": habit["_id"]}, {"$set": {"history": history}})
    return {"status": "success", "history": history}
