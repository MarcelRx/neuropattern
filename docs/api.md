# API Documentation

## API Base Path Behavior

The NeuroPattern API follows RESTful conventions with a base path of `/api/v1`. All endpoints are prefixed with this base path.

**Base URL Examples:**
- Local development: `http://localhost:8000/api/v1`
- Production: Configured via `BACKEND_URL` environment variable

**Full Endpoint Example:**
- Local: `http://localhost:8000/api/v1/auth/login`
- Production: `https://api.example.com/api/v1/auth/login`

## Endpoint Inventory

### Authentication Endpoints (`/api/v1/auth`)

| Method | Path | Purpose | Auth Required |
|--------|------|---------|---------------|
| POST | `/auth/register` | Register new user account | No |
| POST | `/auth/login` | Login and receive JWT token | No |
| GET | `/auth/verify-email` | Verify email address via token | No |
| POST | `/auth/forgot-password` | Initiate password reset | No |
| POST | `/auth/verify-reset-token` | Verify password reset token | No |
| POST | `/auth/reset-password` | Reset password with token | No |
| POST | `/auth/update-password` | Change password (authenticated) | Yes |
| POST | `/auth/update-profile` | Update user profile | Yes |
| GET | `/auth/me` | Get current user profile | Yes |
| DELETE | `/auth/delete-account` | Delete user account | Yes |

### Coach Endpoints (`/api/v1/coach`)

| Method | Path | Purpose | Auth Required |
|--------|------|---------|---------------|
| POST | `/coach/chat` | Send text message to AI coach | Yes |
| POST | `/coach/voice` | Send voice message to AI coach | Yes |
| POST | `/coach/checkin` | Save completed check-in | Yes |

### Habits Endpoints (`/api/v1/habits`)

| Method | Path | Purpose | Auth Required |
|--------|------|---------|---------------|
| GET | `/habits` | Get all habits for current user | Yes |
| POST | `/habits/{habit_id}/toggle` | Toggle habit completion | Yes |

### Logs Endpoints (`/api/v1/logs`)

| Method | Path | Purpose | Auth Required |
|--------|------|---------|---------------|
| GET | `/logs` | Get all wellness logs | Yes |
| DELETE | `/logs/clear` | Clear all logs | Yes |

## Authentication and Authorization Requirements

### JWT Authentication

Most endpoints require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <access_token>
```

**Token Source:**
- Obtained from `/api/v1/auth/login` endpoint
- Token includes user ID in `sub` claim
- Token expires after configured duration (default 60 minutes)

**Token Validation:**
- Signature verified using `JWT_SECRET_KEY`
- Expiration checked on each request
- User fetched from database to ensure account exists

### Authorization

- All authenticated users have full access to their own data
- No role-based access control currently implemented
- User ownership verified via `user_id` field in documents
- No cross-user data access allowed

## Endpoint Details

### Authentication Endpoints

#### POST `/api/v1/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "full_name": "John Doe"
}
```

**Response (201 Created):**
```json
{
  "message": "Registration successful. Please check your email to verify your account."
}
```

**Response (409 Conflict):**
```json
{
  "error": "EMAIL_ALREADY_EXISTS",
  "message": "This email is already registered. Please sign in."
}
```

**Validation:**
- Email must be valid format
- Password must be at least 8 characters
- Email normalized to lowercase

#### POST `/api/v1/auth/login`

Authenticate and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Response (404 Not Found):**
```json
{
  "error": "EMAIL_NOT_FOUND",
  "message": "No account found with this email."
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "EMAIL_NOT_VERIFIED",
  "message": "Please verify your email before signing in."
}
```

or

```json
{
  "error": "INVALID_CREDENTIALS",
  "message": "Incorrect email or password."
}
```

#### GET `/api/v1/auth/me`

Get current user profile.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "full_name": "John Doe",
  "avatar_url": "https://example.com/avatar.jpg"
}
```

#### POST `/api/v1/auth/forgot-password`

Initiate password reset flow.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200 OK):**
```json
{
  "message": "Password reset link sent to your email"
}
```

**Response (404 Not Found):**
```json
{
  "error": "EMAIL_NOT_FOUND",
  "message": "No account exists with this email."
}
```

#### POST `/api/v1/auth/reset-password`

Reset password using valid token.

**Request Body:**
```json
{
  "token": "reset_token_here",
  "email": "user@example.com",
  "newPassword": "newSecurePassword123"
}
```

**Response (200 OK):**
```json
{
  "message": "Password reset successfully"
}
```

**Response (400 Bad Request):**
```json
{
  "detail": "Invalid or expired token"
}
```

#### DELETE `/api/v1/auth/delete-account`

Permanently delete user account and all data.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "message": "Account deleted successfully"
}
```

### Coach Endpoints

#### POST `/api/v1/coach/chat`

Send text message to AI coach Aura.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "message": "I'm feeling stressed today",
  "context": null,
  "language": null,
  "generateVoice": true
}
```

**Response (200 OK):**
```json
{
  "response": "I understand you're feeling stressed. Let's explore what's causing this...",
  "language": "en",
  "energy": 70,
  "mood": "Calm",
  "score": 50,
  "user_emotion": "Stressed",
  "voice_enabled": true,
  "timestamp": "2024-01-15T10:30:00Z",
  "suggestedActions": [
    {
      "label": "📊 View Analysis",
      "action": "view_analysis",
      "type": "analyze"
    }
  ],
  "checkInData": {
    "score": 50,
    "mood": "Calm",
    "summary": "User expressed stress",
    "sentiment": "negative",
    "user_emotion": "Stressed"
  },
  "audioUrl": "http://localhost:8000/audio/coach_507f1f77_1705320600.mp3"
}
```

**External Dependencies:**
- Groq API for emotion analysis and response generation
- ElevenLabs API for text-to-speech (if `generateVoice: true`)

**Failure Behavior:**
- If Groq API fails: Returns 500 error
- If ElevenLabs API fails: Returns response without `audioUrl` (chat succeeds)

#### POST `/api/v1/coach/voice`

Send voice message to AI coach.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**
- `file`: Audio file (WebM, MP3, WAV)
- `quality_report`: JSON string with audio quality analysis
- `preferred_language`: Optional language code (e.g., "en")
- `language`: Optional language code (deprecated, use preferred_language)

**Response (200 OK):**
```json
{
  "transcription": "I'm feeling stressed today",
  "confidence": 0.95,
  "isClear": true,
  "qualityIssues": [],
  "suggestedAction": null,
  "duration": 5.2,
  "toneFeatures": {
    "energy_variance": 0.3,
    "pitch_trend": "stable",
    "speech_rate": 4.5,
    "emotional_tone": {
      "arousal": 0.7,
      "valence": 0.3
    }
  },
  "analysis": {
    "score": 45,
    "mood": "Stressed",
    "summary": "User expressed stress in voice message",
    "user_emotion": "Stressed",
    "sentiment": "negative"
  },
  "language": "en",
  "languageConfidence": 0.92,
  "response": "I hear that you're feeling stressed...",
  "energy": 70,
  "mood": "Calm",
  "audioUrl": "http://localhost:8000/audio/coach_voice_507f1f77_1705320600.mp3",
  "voice_enabled": true,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**External Dependencies:**
- Groq Whisper API for speech-to-text
- Groq LLM API for emotion analysis and response generation
- ElevenLabs API for text-to-speech

**Failure Behavior:**
- If audio transcription fails: Returns 500 error
- If AI analysis fails: Returns 500 error
- If TTS fails: Returns response without `audioUrl`

#### POST `/api/v1/coach/checkin`

Save completed check-in to database.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "score": 75,
  "mood": "Good",
  "summary": "Had a productive day",
  "sentiment": "positive"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "id": "507f1f77bcf86cd799439012"
}
```

### Habits Endpoints

#### GET `/api/v1/habits`

Get all habits for current user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
[
  {
    "id": "507f1f77bcf86cd799439013",
    "name": "Exercise",
    "icon": "🏃",
    "goal": 7,
    "color": "#4CAF50",
    "history": [true, true, false, true, true, false, true],
    "currentValue": 5,
    "progress": 71
  }
]
```

#### POST `/api/v1/habits/{habit_id}/toggle`

Toggle habit completion for today.

**Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
- `habit_id`: MongoDB ObjectId of habit

**Response (200 OK):**
```json
{
  "status": "success",
  "history": [true, true, false, true, true, false, false]
}
```

**Response (404 Not Found):**
```json
{
  "detail": "Habit not found"
}
```

### Logs Endpoints

#### GET `/api/v1/logs`

Get all wellness logs for current user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
[
  {
    "id": "507f1f77bcf86cd799439014",
    "timestamp": "2024-01-15T10:30:00Z",
    "score": 75,
    "mood": "Good",
    "summary": "Had a productive day",
    "sentiment": "positive"
  }
]
```

**Note:** Logs are returned in reverse chronological order (newest first).

#### DELETE `/api/v1/logs/clear`

Clear all logs for current user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "message": "Successfully deleted 15 logs."
}
```

**Response (404 Not Found):**
```json
{
  "detail": "No logs found to delete"
}
```

## Input Validation and Error Response Formats

### Validation Errors

Pydantic validates all request bodies. Validation errors return HTTP 422:

```json
{
  "error": "ValidationError",
  "details": [
    {
      "field": "email",
      "message": "value is not a valid email address"
    },
    {
      "field": "password",
      "message": "ensure this value is at least 8 characters"
    }
  ]
}
```

### Authentication Errors

Authentication failures return HTTP 401:

```json
{
  "detail": "Could not validate credentials"
}
```

### Not Found Errors

Resource not found returns HTTP 404:

```json
{
  "detail": "Resource not found"
}
```

### Server Errors

Unexpected errors return HTTP 500:

```json
{
  "detail": "Internal server error message"
}
```

## External Service Dependencies and Expected Failure Behavior

### Groq API

**Endpoints Used:**
- Speech-to-text: `whisper-large-v3` model
- Chat completions: `llama-3.3-70b-specdec` model

**Failure Behavior:**
- API unresponsive: Returns HTTP 500 with error message
- Rate limit exceeded: Returns HTTP 500 (no retry logic)
- Invalid API key: Returns HTTP 500 on first call

**Configuration:**
- API key: `GROQ_API_KEY` environment variable
- Model: `GROQ_MODEL` environment variable (default: `llama-3.3-70b-specdec`)

### ElevenLabs API

**Endpoints Used:**
- Text-to-speech: `eleven_multilingual_v2` model

**Failure Behavior:**
- API unresponsive: Chat succeeds without audio
- Rate limit exceeded: Chat succeeds without audio
- Invalid API key: Chat succeeds without audio
- Fallback: Browser Web Speech API on frontend

**Configuration:**
- API key: `ELEVENLABS_API_KEY` environment variable
- Voice ID: `ELEVENLABS_VOICE_ID` environment variable
- Model ID: `ELEVENLABS_MODEL_ID` environment variable

### SMTP Server

**Endpoints Used:**
- Email sending for verification and password reset

**Failure Behavior:**
- SMTP unavailable: Registration succeeds without email
- Email fails: User can still log in (if verification not enforced)
- Password reset: Returns HTTP 500 if email fails

**Configuration:**
- Host: `SMTP_HOST` environment variable
- Port: `SMTP_PORT` environment variable
- User: `SMTP_USER` environment variable
- Password: `SMTP_PASSWORD` environment variable

## Safe Request and Response Examples

### Example: Complete Chat Flow

**1. Login:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**2. Send Chat Message:**
```bash
curl -X POST http://localhost:8000/api/v1/coach/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{"message":"How are you?","generateVoice":false}'
```

**Response:**
```json
{
  "response": "I'm doing well, thank you for asking! How can I help you today?",
  "language": "en",
  "energy": 80,
  "mood": "Calm",
  "score": 50,
  "user_emotion": "Neutral",
  "voice_enabled": true,
  "timestamp": "2024-01-15T10:30:00Z",
  "suggestedActions": [
    {"label": "📊 View Analysis", "action": "view_analysis", "type": "analyze"}
  ],
  "checkInData": {
    "score": 50,
    "mood": "Calm",
    "summary": "Greeting",
    "sentiment": "neutral",
    "user_emotion": "Neutral"
  }
}
```

## Local Instructions for Inspecting OpenAPI Documentation

### Swagger UI

When running in development mode (`ENVIRONMENT=development`):

```
http://localhost:8000/docs
```

This provides an interactive UI to:
- Browse all endpoints
- View request/response schemas
- Execute requests directly from the browser
- Test authentication

### ReDoc

Alternative documentation interface:

```
http://localhost:8000/redoc
```

### OpenAPI JSON

Machine-readable API specification:

```
http://localhost:8000/openapi.json
```

### Production Behavior

In production (`ENVIRONMENT=production`):
- Swagger UI is disabled
- ReDoc is disabled
- OpenAPI JSON is still available at `/openapi.json` for automated tools

## Note on Swagger UI and ReDoc

**Status:** Enabled in development, disabled in production

**Configuration:**
- Controlled by `ENVIRONMENT` environment variable
- Set in `backend/app/main.py`:
  ```python
  docs_url="/docs" if os.getenv("ENVIRONMENT") == "development" else None,
  redoc_url="/redoc" if os.getenv("ENVIRONMENT") == "development" else None,
  ```

**Security Note:** Disabling interactive documentation in production reduces attack surface by hiding API structure from unauthenticated users.

## Production URL

**Status:** No verified production deployment exists

**Note:** The application is not currently deployed to a public server. To deploy:
1. Set up production server (AWS, GCP, Azure, Railway)
2. Configure environment variables
3. Deploy using Docker or platform-specific methods
4. Configure domain and SSL/TLS

Do not use any example URLs shown in documentation for production requests without verifying a real deployment.
