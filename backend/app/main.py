import os
import sys
from contextlib import asynccontextmanager

from app import database
from app.api.core import config
from app.api.v1.api import api_router
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validate production configuration at startup
    try:
        # This triggers the model_validator in Settings
        _ = config.settings
    except ValueError as e:
        print(f"CONFIGURATION ERROR: {e}", file=sys.stderr)
        print(
            "Application cannot start with invalid production configuration.",
            file=sys.stderr,
        )
        sys.exit(1)

    # Delegate index creation to DatabaseManager for single source of truth
    await database.DatabaseManager.setup_indexes()
    yield
    await database.close_db()


app = FastAPI(
    title=config.settings.APP_NAME,
    version="2.5.0",
    lifespan=lifespan,
    docs_url="/docs" if os.getenv("ENVIRONMENT") == "development" else None,
    redoc_url="/redoc" if os.getenv("ENVIRONMENT") == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    details = []
    for error in exc.errors():
        details.append({"field": error["loc"][-1], "message": error["msg"]})
    return JSONResponse(status_code=422, content={"error": "ValidationError", "details": details})


# ---------------------------------------------------------------------------
# API Routes (MUST be registered BEFORE static files)
# ---------------------------------------------------------------------------
app.include_router(api_router, prefix="/api/v1")


# ---------------------------------------------------------------------------
# Health Check Endpoint (Required for Docker healthcheck)
# ---------------------------------------------------------------------------
@app.get("/health")
async def health_check():
    """Health check for Docker and load balancers."""
    try:
        # Check database connection
        db = database.get_db()
        await db.command("ping")
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {e!s}"

    return JSONResponse(
        content={
            "status": "healthy" if db_status == "healthy" else "degraded",
            "database": db_status,
            "version": "2.5.0",
            "environment": os.getenv("ENVIRONMENT", "development"),
        },
        status_code=200 if db_status == "healthy" else 503,
    )


# ---------------------------------------------------------------------------
# Static Files & SPA Routing
# ---------------------------------------------------------------------------
# Determine static directory path
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

# Serve static assets (JS, CSS, images) from /assets and other paths
if os.path.exists(STATIC_DIR):
    app.mount(
        "/assets",
        StaticFiles(directory=os.path.join(STATIC_DIR, "assets")),
        name="assets",
    )

    # Serve audio files
    audio_dir = os.path.join(STATIC_DIR, "audio")
    os.makedirs(audio_dir, exist_ok=True)
    app.mount("/audio", StaticFiles(directory=audio_dir), name="audio")


@app.get("/")
async def serve_index():
    """Serve the main index.html for root path."""
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "NeuroPattern API is running", "version": "2.5.0"}


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """
    Catch-all route for SPA client-side routing.
    Returns index.html for non-API, non-static routes so React Router handles them.
    """
    # Skip API routes
    if full_path.startswith(("api/", "health")):
        return {"detail": "Not Found"}

    # Try to serve the specific file first (for static assets)
    file_path = os.path.join(STATIC_DIR, full_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)

    # Fall back to index.html for SPA routes
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)

    return {"detail": "Not Found"}
