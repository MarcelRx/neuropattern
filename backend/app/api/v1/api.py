from app.api.v1.endpoints import auth, coach, habits, logs
from fastapi import APIRouter

api_router = APIRouter()

# Register sub-routers
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(coach.router, prefix="/coach", tags=["coach"])
api_router.include_router(habits.router, tags=["habits"])
api_router.include_router(logs.router, tags=["logs"])
