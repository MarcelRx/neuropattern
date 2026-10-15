# Backend Architecture

## Backend Framework and Verified Versions

The NeuroPattern backend is built with modern Python async technologies:

- **Language:** Python 3.12.8
- **Framework:** FastAPI 0.138.0
- **ASGI Server:** Uvicorn 0.30.0+ (development), Gunicorn 23.0.0+ (production)
- **Database Driver:** Motor 3.7.1 (async MongoDB driver)
- **Validation:** Pydantic 2.13.4
- **Configuration:** Pydantic Settings 2.14.2+
- **Authentication:** python-jose 3.3.0+, passlib 1.7.4, bcrypt 4.0.1+

## Application Entry Point and Startup Lifecycle

### Entry Point (`backend/app/main.py`)

The FastAPI application is initialized in `app/main.py`:

1. **Imports:** Database, configuration, routers, middleware
2. **Lifespan Context Manager:**
   - On startup: Creates database indexes via `DatabaseManager.setup_indexes()`
   - On shutdown: Closes database connection via `close_db()`
3. **FastAPI Instance Creation:**
   - Title from configuration: "NeuroPattern LifeTracker"
   - Version: "2.5.0"
   - OpenAPI docs enabled only in development (`ENVIRONMENT=development`)
4. **Middleware Registration:**
   - CORSMiddleware for cross-origin requests
   - Custom validation exception handler
5. **Router Registration:**
   - API router at `/api/v1` prefix
   - Static file mounting for frontend assets and audio
6. **Health Check Endpoint:** `/health` for Docker health checks
7. **SPA Fallback Routes:** Catch-all routes for client-side routing

### Startup Sequence

```
Gunicorn/Uvicorn starts
  → FastAPI app initializes
  → Lifespan startup runs
  → Database indexes created
  → Routers registered
  → Middleware applied
  → Server ready for requests
```

### Shutdown Sequence

```
Shutdown signal received
  → Lifespan shutdown runs
  → Database connection closed
  → Workers exit
  → Server stops
```

## Router and Endpoint Organization

### Router Hierarchy

```
FastAPI App
└── /api/v1 (api_router)
    ├── /auth (auth.router)
    │   ├── POST /register
    │   ├── POST /login
    │   ├── POST /verify-email
    │   ├── POST /forgot-password
    │   ├── POST /reset-password
    │   ├── POST /verify-reset-token
    │   ├── GET /me
    │   └── DELETE /delete-account
    ├── /coach (coach.router)
    │   ├── POST /chat
    │   └── POST /voice
    ├── /habits (habits.router)
    │   ├── GET /habits
    │   └── POST /habits/{habit_id}/toggle
    └── /logs (logs.router)
        ├── GET /logs
        └── DELETE /logs/clear
```

### Endpoint Files

- `backend/app/api/v1/endpoints/auth.py`: Authentication endpoints
- `backend/app/api/v1/endpoints/coach.py`: AI coach endpoints
- `backend/app/api/v1/endpoints/habits.py`: Habit tracking endpoints
- `backend/app/api/v1/endpoints/logs.py`: Wellness log endpoints

### Router Registration

Router aggregation in `backend/app/api/v1/api.py`:

```python
api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(coach.router, prefix="/coach", tags=["coach"])
api_router.include_router(habits.router, tags=["habits"])
api_router.include_router(logs.router, tags=["logs"])
```

## Business Logic and Service Modules

### Service Layer Organization

```
backend/app/api/services/
├── ai_service.py      # AI processing (Groq, ElevenLabs)
└── email_service.py   # Email sending (SMTP)
```

### AI Service (`ai_service.py`)

**Responsibilities:**

- Speech-to-text transcription via Groq Whisper
- Language detection from audio and text
- Emotion analysis via Groq LLM
- Response generation via Groq LLM
- Text-to-speech via ElevenLabs
- Audio preprocessing (normalization, silence trimming, chunking)

**Key Classes:**

- `AIService`: Main service class for AI operations
- `AIServiceError`: Base exception for AI failures
- `LanguageDetectionError`: Language detection failures
- `STTError`: Speech-to-text failures
- `TTSError`: Text-to-speech failures

**Key Methods:**

- `transcribe_audio()`: Convert audio to text
- `analyze_user_emotion()`: Detect emotional state
- `generate_coach_response()`: Generate AI coach response
- `generate_voice_response()`: Convert text to speech

### Email Service (`email_service.py`)

**Responsibilities:**

- Send verification emails
- Send password reset emails
- SMTP configuration and connection management

**Key Functions:**

- `send_verification_email()`: Send account verification email
- `send_password_reset_email()`: Send password reset email

## Dependency Injection and Configuration

### FastAPI Dependency Injection

FastAPI's `Depends()` is used for:

- Database connection: `Depends(get_db)`
- Authentication: `Depends(get_current_user)`
- Optional authentication: `Depends(get_current_user_optional)`

### Configuration (`backend/app/api/core/config.py`)

**Settings Class:**

```python
class Settings(BaseSettings):
    APP_NAME: str = "NeuroPattern LifeTracker"
    VERSION: str = "2.5.0"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    # ... other settings
```

**Configuration Sources:**

1. Environment variables
2. `.env` file (via python-dotenv)
3. Default values in Settings class

**Key Configuration Properties:**

- `CORS_ORIGINS`: Computed from environment (JSON or comma-separated)
- `MONGODB_URL`: Built from components or MONGODB_URI
- `DATABASE_NAME`: Database name

### Global Settings Instance

A global `settings` instance is created at module load time:

```python
settings = Settings()
```

This instance is imported throughout the application for configuration access.

## Authentication and Authorization Implementation

### Authentication Flow

1. **Registration:**
   - User submits email and password
   - Password hashed with bcrypt
   - User document created in MongoDB
   - Verification token generated and stored
   - Verification email sent (if SMTP configured)

2. **Login:**
   - User submits email and password
   - Password verified against hash
   - JWT token generated with user ID
   - Token returned to client

3. **Token Validation:**
   - Token extracted from `Authorization: Bearer <token>` header
   - JWT decoded and signature verified
   - Expiration checked
   - User fetched from database
   - User document attached to request state

### Security Module (`backend/app/api/core/security.py`)

**Key Components:**

- `pwd_context`: CryptContext with bcrypt
- `oauth2_scheme`: OAuth2PasswordBearer for token extraction
- `SecurityManager`: Class for security operations

**Key Functions:**

- `verify_password()`: Verify password against hash
- `get_password_hash()`: Hash password with bcrypt
- `create_access_token()`: Generate JWT token
- `get_current_user()`: Dependency for protected routes
- `get_current_user_optional()`: Optional auth dependency

### JWT Token Structure

**Payload:**

```json
{
  "sub": "user_id",
  "exp": expiration_timestamp
}
```

**Configuration:**

- Algorithm: HS256
- Secret: `JWT_SECRET_KEY` from environment
- Expiration: `ACCESS_TOKEN_EXPIRE_MINUTES` (default 60 minutes)

### Authorization

- All routes except `/auth/register`, `/auth/login`, and `/health` require authentication
- User documents include `_id` for ownership checks
- No role-based access control currently implemented
- All authenticated users have full access to their own data

## Request Parsing and Validation

### Pydantic Models (`backend/app/api/models/models.py`)

**Validation Strategy:**

- Request bodies validated with Pydantic models
- Type coercion and constraint enforcement
- Custom validators for complex logic
- Field aliases for camelCase ↔ snake_case conversion

**Key Models:**

- `UserCreate`: User registration validation
- `UserLogin`: User login validation
- `ChatRequest`: Chat message validation
- `QualityReport`: Audio quality report validation
- `HabitResponse`: Habit data validation
- `LogResponse`: Log data validation

### Validation Example

```python
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None

    @field_validator('password')
    @classmethod
    def password_complexity(cls, v: str) -> str:
        # Custom validation logic
        return v
```

## Error Handling and Exception-to-Response Mapping

### Global Exception Handlers

**Validation Exception Handler:**

```python
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    details = []
    for error in exc.errors():
        details.append({
            "field": error["loc"][-1],
            "message": error["msg"]
        })
    return JSONResponse(
        status_code=422,
        content={"error": "ValidationError", "details": details}
    )
```

### HTTP Exception Usage

Endpoints raise `HTTPException` for errors:

```python
raise HTTPException(
    status_code=404,
    detail="Resource not found"
)
```

### AI Service Errors

AI service raises custom exceptions:

- `AIServiceError`: Base AI error
- `LanguageDetectionError`: Language detection failure
- `STTError`: Speech-to-text failure
- `TTSError`: Text-to-speech failure

These are caught and handled with appropriate HTTP responses.

## Database Connection Lifecycle

### Database Manager (`backend/app/database.py`)

**Singleton Pattern:**

- Single `DatabaseManager` instance
- Single `AsyncIOMotorClient` instance
- Connection pooling handled by Motor

**Connection Lifecycle:**

1. Application startup → `DatabaseManager.get_client()` called
2. URI built from environment variables
3. Motor client created and cached
4. Database instance obtained via `get_db()`
5. Application shutdown → `close_connection()` called
6. Motor client closed

### URI Building

Priority order:

1. `MONGODB_URI` environment variable (full connection string)
2. Built from `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

**Auth-enabled URI:**

```
mongodb://user:password@host:port/dbname?authSource=dbname
```

**No-auth URI:**

```
mongodb://host:port/dbname
```

### Index Creation

On application startup, `setup_indexes()` creates:

- Unique index on `users.email`
- Unique index on `email_verifications.token_hash` with TTL
- Unique index on `password_resets.token_hash` with TTL
- Compound index on `logs.user_id` and `logs.timestamp`

## External API Clients and Failure Handling

### Groq Client

**Initialization:**

```python
from groq import Groq
client = Groq(api_key=settings.GROQ_API_KEY)
```

**Operations:**

- Speech-to-text: `client.audio.transcriptions.create()`
- Chat completions: `client.chat.completions.create()`

**Failure Handling:**

- Wrapped in try-except blocks
- Custom exceptions raised
- Graceful degradation implemented
- Logging for debugging

### ElevenLabs Client

**Initialization:**

```python
from elevenlabs import ElevenLabs
client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)
```

**Operations:**

- Text-to-speech: `client.generate()`

**Failure Handling:**

- Wrapped in try-except blocks
- Fallback to browser TTS
- Custom exceptions raised
- Errors logged but don't fail chat requests

### SMTP Client

**Configuration:**

- Host, port, user, password from environment
- TLS/SSL configuration

**Failure Handling:**

- Errors caught and logged
- Does not fail registration if email fails
- User can still log in without verification

## Logging and Observability

### Current Logging

**Implementation:**

- Python `logging` module
- Basic logging in AI service and database
- Debug prints in security module (for debugging auth)

**Log Levels:**

- `INFO`: Database connection, index creation
- `WARNING`: CORS parsing failures
- `ERROR`: AI service failures, database errors

**Limitations:**

- No structured logging (JSON format)
- No centralized log aggregation
- No request ID tracing
- Debug prints should be replaced with proper logging

### Observability Gaps

- No metrics collection
- No distributed tracing
- No performance monitoring
- No error tracking (e.g., Sentry)
- No request logging middleware

## Background Tasks or Asynchronous Processing

### Current Implementation

**No Background Task Queue:**

- All operations are synchronous within HTTP requests
- AI processing blocks the request
- Email sending is synchronous
- No Celery, RQ, or similar queue

**Async/Await Pattern:**

- All database operations use async/await with Motor
- All external API calls use async libraries
- FastAPI handles async route handlers

**Implications:**

- Long AI operations could cause timeouts
- Email sending adds latency to requests
- No retry logic for failed operations
- No scheduled tasks

### Recommended Improvements

1. **Add Celery or RQ:** For background email sending and audio generation
2. **Add Task Queue:** For long-running AI operations
3. **Add Scheduled Tasks:** For token cleanup and data aggregation
4. **Add Retry Logic:** For external API failures

## Backend Testing and Execution Commands

### Test Location

Tests are in `backend/tests/`:

- `test_health.py`: Settings initialization test

### Running Tests

```bash
# Activate virtual environment
source venv/bin/activate

# Run tests with pytest
pytest backend/tests/ -v

# Run with coverage
pytest backend/tests/ -v --cov=backend/app
```

### Development Server

```bash
# From project root
pnpm backend

# Or manually
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --reload-dir app --host 0.0.0.0 --port 8000
```

### Production Server

```bash
cd backend
source venv/bin/activate
gunicorn app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 120
```

### Linting

```bash
# Using Ruff
ruff check backend/

# Auto-fix
ruff check backend/ --fix
```

## Known Limitations and Proposed Improvements

### Current Limitations

1. **No Background Tasks:** All operations synchronous, could cause timeouts
2. **Limited Logging:** No structured logging or observability
3. **No Rate Limiting:** No protection against API abuse
4. **No Request Caching:** All requests hit database
5. **Minimal Testing:** Only one test, insufficient coverage
6. **Debug Prints:** Security module has debug print statements
7. **No Health Check Details:** Health check only checks database ping
8. **No Metrics:** No performance metrics or monitoring

### Proposed Improvements

**High Priority:**

1. Add structured logging with JSON format
2. Implement rate limiting on all endpoints
3. Add request caching with Redis
4. Remove debug prints, use proper logging
5. Expand test coverage to 80%+
6. Add error tracking (Sentry or similar)

**Medium Priority:** 7. Add background task queue (Celery/RQ) 8. Implement metrics collection (Prometheus) 9. Add request ID tracing 10. Add detailed health checks (dependencies status)

**Low Priority:** 11. Add distributed tracing (OpenTelemetry) 12. Implement request logging middleware 13. Add performance monitoring (APM) 14. Add automated security scanning
