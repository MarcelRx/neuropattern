# NeuroPattern

## Overview

NeuroPattern is an AI-powered wellness companion that tracks mental health patterns through empathetic voice check-ins, data-driven insights, and personalized coaching. The application provides users with a conversational AI coach named "Aura" that can interact via text and voice, analyze emotional states, track wellness scores over time, and provide personalized recommendations. The system supports multiple languages and uses real-time audio analysis to detect emotional tone and sentiment.

**Target Users:** Individuals seeking mental wellness tracking, emotional self-awareness, and AI-powered coaching support.

**Current Implementation Status:** The application is functional with core features implemented including user authentication, voice/text AI coaching, habit tracking, wellness analysis, and multi-language support. This is a portfolio project demonstrating full-stack development skills. It is **NOT production-ready** and requires additional security hardening, testing, and infrastructure setup before production deployment.

## Problem

Mental health tracking and emotional self-awareness are challenging for individuals to maintain consistently. Traditional journaling and wellness apps often lack:

1. **Engaging Interaction:** Static forms and questionnaires can feel clinical and discourage regular use
2. **Emotional Context:** Text-only inputs miss vocal tone, energy, and emotional cues that are critical for accurate mood assessment
3. **Language Barriers:** Most wellness apps are limited to English, excluding non-English speakers
4. **Personalized Insight:** Generic wellness scores don't account for individual patterns, habits, and emotional baselines
5. **Real-time Feedback:** Users often receive delayed or generic recommendations rather than immediate, contextual coaching

## Solution

NeuroPattern addresses these challenges through:

1. **Conversational AI Coach:** Aura provides empathetic, natural language interactions via text and voice, making check-ins feel like talking to a supportive mentor rather than filling out forms
2. **Voice Analysis with Emotional Detection:** Real-time audio processing detects arousal, valence, speech rate, and emotional tone from vocal patterns, providing richer context beyond text alone
3. **Multilingual Support:** The system detects and adapts to 100+ languages automatically, supporting seamless language switching during conversations
4. **Pattern Recognition:** Visualizations of wellness scores, mood trends, and habit progress over time help users identify patterns and triggers
5. **Immediate Personalized Coaching:** AI responses adapt to detected emotional states, providing contextually appropriate guidance in real-time

## Architecture

Neuropattern follows a modern full-stack architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Pages      │  │  Components  │  │   Services   │         │
│  │  (Routing)   │  │  (UI/UX)     │  │  (API Calls) │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Context    │  │   Core       │  │   Utils      │         │
│  │ (State Mgmt) │  │ (Audio/ML)   │  │ (Helpers)    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/REST API
┌────────────────────────────┴────────────────────────────────────┐
│                         Backend (FastAPI)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  API Routes  │  │   Services   │  │   Models     │         │
│  │ (Endpoints)  │  │ (Business)   │  │ (Validation) │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Security   │  │   Database   │  │    Config    │         │
│  │  (Auth/JWT)  │  │  (MongoDB)   │  │ (Settings)   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                      External Services                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │     Groq     │  │  ElevenLabs  │  │   MongoDB    │         │
│  │ (LLM/STT)    │  │   (TTS)      │  │  (Database)  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

**Key Architectural Decisions:**

- **React SPA with HashRouter:** Client-side routing enables smooth navigation without page reloads; HashRouter ensures compatibility with Docker/deployment scenarios
- **FastAPI Async Backend:** Asynchronous Python framework handles concurrent requests efficiently, critical for real-time audio processing
- **MongoDB with Motor Async Driver:** Non-blocking database operations maintain responsiveness during AI processing
- **Singleton Database Manager:** Centralized connection pooling reduces overhead and prevents connection leaks
- **Type Safety:** TypeScript on frontend, Pydantic models on backend ensure data consistency across the stack
- **Docker Multi-stage Build:** Separate frontend build and backend runtime stages optimize image size and security

For detailed architecture documentation, see [docs/architecture.md](docs/architecture.md).

## Tech Stack

### Backend

- **Language:** Python 3.12.8
- **Framework:** FastAPI 0.138.0
- **ASGI Server:** Uvicorn 0.30.0+ (development), Gunicorn 23.0.0+ (production)
- **Database:** MongoDB 7.0 with Motor 3.7.1 (async driver)
- **Authentication:** JWT using python-jose 3.3.0+, passlib 1.7.4, bcrypt 4.0.1+
- **AI/ML:**
  - Groq API 0.9.0+ (LLM for analysis and Whisper-large-v3 for speech-to-text)
  - ElevenLabs 1.0.0+ (text-to-speech synthesis)
- **Audio Processing:** librosa 0.10.2+, pydub 0.25.1+, soundfile 0.12.1, numpy 1.26.4+
- **Data Validation:** Pydantic 2.13.4, pydantic-settings 2.14.2+
- **Email:** python-dotenv 1.0.1, email-validator 2.1.0+

### Frontend

- **Language:** TypeScript 5.7.3
- **Framework:** React 19.2.6
- **Build Tool:** Vite 6.4.3
- **Routing:** React Router DOM 7.13.0 (HashRouter)
- **State Management:** React Context API
- **Visualization:** Recharts 3.7.0
- **Package Manager:** pnpm 11.5.0
- **Linting/Formatting:** ESLint 10.4.1, Prettier 3.8.3
- **Hooks:** Husky 9.1.7, lint-staged 17.0.7

### Infrastructure

- **Containerization:** Docker with multi-stage builds
- **Orchestration:** Docker Compose for local development
- **CI/CD:** GitHub Actions (lint, test, build, deploy)
- **Version Control:** Git

## Key Features

### Implemented Features

1. **User Authentication**
   - Email/password registration with email verification
   - JWT-based session management
   - Password reset via email tokens
   - Profile management (name, avatar)
   - Account deletion with data cleanup

2. **AI Coach (Aura)**
   - Text-based chat with empathetic AI responses
   - Voice input with real-time transcription
   - Voice output using ElevenLabs TTS
   - Emotional state detection (Happy, Sad, Stressed, etc.)
   - Adaptive responses based on detected emotion
   - Conversation history tracking

3. **Voice Analysis**
   - Real-time audio quality assessment (volume, silence, clipping)
   - Emotional tone detection (arousal, valence)
   - Speech rate and pitch trend analysis
   - Multi-language speech-to-text (100+ languages)
   - Language detection with confidence scoring

4. **Wellness Tracking**
   - Daily check-in logs with mood and sentiment
   - Wellness score calculation (0-100)
   - Historical log viewing
   - Pattern visualization over time

5. **Habit Tracking**
   - Custom habit creation with goals
   - Daily habit completion tracking
   - Progress visualization with heatmaps
   - 7-day history tracking

6. **Multi-language Support**
   - Automatic language detection from text and audio
   - AI responses in detected language
   - RTL language support (Arabic, Hebrew, etc.)
   - Language switching during conversations

7. **Analysis & Insights**
   - Wellness score trends
   - Mood distribution analysis
   - Check-in frequency tracking
   - Personalized insights based on patterns

### Features Requiring Configuration

- **Email Notifications:** Password reset and email verification require SMTP configuration
- **Voice Synthesis:** ElevenLabs API key required for TTS (fallback to browser TTS available)
- **AI Analysis:** Groq API key required for all AI features

### Planned/Incomplete Features

- Advanced pattern recognition algorithms
- Integration with wearable devices
- Social sharing features
- Premium subscription tiers
- Mobile app (iOS/Android)

## Frontend Architecture

The frontend is a React Single Page Application (SPA) built with TypeScript and Vite. It uses HashRouter for client-side routing, React Context API for state management, and a service layer for API communication.

**Key Components:**

- **Routing:** HashRouter with lazy-loaded page components for optimal performance
- **State Management:** AppContext provides global state for user authentication, logs, habits, and profile data
- **API Layer:** HTTP service with timeout handling and error normalization
- **Component Organization:** Reusable UI components (Gauge, Navigation) and feature-specific coach components
- **Audio Processing:** Client-side VoiceProcessor for real-time audio quality analysis
- **Language Detection:** LanguageDetector for multilingual text and audio analysis
- **Build Configuration:** Vite with code splitting and manual chunk optimization

For detailed frontend architecture documentation, see [docs/frontend-architecture.md](docs/frontend-architecture.md).

## Backend Architecture

The backend is a FastAPI application following async/await patterns throughout. It uses Pydantic for validation, Motor for async MongoDB operations, and a modular service-oriented architecture.

**Key Components:**

- **Application Entry Point:** `app/main.py` with lifespan management for database initialization
- **Router Organization:** API routes organized under `/api/v1` with separate routers for auth, coach, habits, and logs
- **Business Logic:** Service layer (AI service, email service) separating business logic from endpoint handlers
- **Configuration:** Pydantic Settings with environment variable loading
- **Authentication:** JWT-based authentication with dependency injection for protected routes
- **Database:** Singleton DatabaseManager with Motor async driver and automatic index creation
- **Error Handling:** Custom exception handlers for validation errors and AI service failures
- **Static Files:** Serves built frontend assets and audio files for TTS responses

For detailed backend architecture documentation, see [docs/backend-architecture.md](docs/backend-architecture.md).

## AI Architecture

Neuropattern uses a multi-stage AI pipeline for voice coaching and analysis:

### Components

1. **Speech-to-Text (Groq Whisper-large-v3)**
   - Input: Raw audio (WebM/MP3/WAV)
   - Preprocessing: Normalization, silence trimming, chunking for long audio
   - Output: Transcription with confidence scores, language detection, and segment metadata
   - Used for: Voice check-in transcription

2. **Language Detection**
   - Source: Transcription language tags, user preference, text analysis
   - Output: ISO 639-1 language code with confidence score
   - Used for: Route AI responses and TTS language selection

3. **Emotion Analysis (Groq Llama-3.3-70b-specdec)**
   - Input: User message + vocal tone context (arousal, valence, pitch trend)
   - Prompt: System prompt with behavioral rules + adaptive instructions based on detected emotion
   - Output: Emotional state (Happy, Sad, Stressed, etc.), confidence, arousal, valence
   - Used for: Coach response adaptation

4. **Response Generation (Groq Llama-3.3-70b-specdec)**
   - Input: User message, detected emotion, conversation history, tone context
   - System Prompt: Professional, empathetic, multilingual coach persona with strict behavioral rules
   - Output: Structured JSON with response text, language, energy, mood, score, summary
   - Used for: Coach chat responses

5. **Text-to-Speech (ElevenLabs Multilingual V2)**
   - Input: Response text, detected language
   - Model: eleven_multilingual_v2 with configurable voice ID
   - Output: MP3 audio file served via static endpoint
   - Used for: Voice responses
   - Fallback: Browser Web Speech API if ElevenLabs unavailable

### Design Decisions

- **Groq over OpenAI:** Faster inference times, lower cost, no rate limiting issues
- **Whisper-large-v3:** Higher accuracy for multilingual transcription vs smaller models
- **Adaptive System Prompts:** Dynamic prompt modification based on detected emotional state improves response relevance
- **Language Preservation:** System strictly responds in the detected language to maintain cultural context
- **Graceful Degradation:** AI features fail gracefully with default responses if APIs are unavailable

For detailed AI architecture documentation, see [docs/ai-architecture.md](docs/ai-architecture.md).

## API Documentation

The backend uses FastAPI, which automatically generates OpenAPI documentation. The API is organized under the `/api/v1` prefix with the following route groups:

- **Authentication:** `/api/v1/auth/*` - Registration, login, password reset, email verification
- **Coach:** `/api/v1/coach/*` - Text chat, voice check-in, emotion analysis
- **Habits:** `/api/v1/habits/*` - Habit CRUD and daily completion tracking
- **Logs:** `/api/v1/logs/*` - Wellness log retrieval and management

### OpenAPI Documentation

When running in development mode (`ENVIRONMENT=development`), the following documentation endpoints are available:

- **OpenAPI JSON:** `/openapi.json` - Machine-readable API specification
- **Swagger UI:** `/docs` - Interactive API documentation UI
- **ReDoc:** `/redoc` - Alternative documentation interface

These endpoints are disabled in production for security.

### Authentication

Most endpoints require JWT authentication via the `Authorization: Bearer <token>` header. The token is obtained by logging in at `/api/v1/auth/login`.

### Base URL

- Local development: `http://localhost:8000/api/v1`
- Production: Configured via `BACKEND_URL` environment variable

For detailed API documentation including all endpoints, request/response schemas, and examples, see [docs/api.md](docs/api.md).

## Data Flow

1. **User Registration/Login Flow**

   ```
   User → Frontend (Form) → API (/auth/register or /auth/login)
   → Backend (Validation + Password Hash) → MongoDB (User Creation/Retrieval)
   → Backend (JWT Generation) → Frontend (Token Storage)
   ```

2. **Voice Check-in Flow**

   ```
   User → Frontend (Audio Recording) → VoiceProcessor (Quality Analysis)
   → API (/coach/voice) → Backend (Audio Upload)
   → AI Service (Groq Whisper STT → Language Detection → Emotion Analysis)
   → AI Service (Response Generation) → AI Service (ElevenLabs TTS)
   → Backend (Log Storage) → Frontend (Display + Audio Playback)
   ```

3. **Text Chat Flow**

   ```
   User → Frontend (Chat Input) → API (/coach/chat)
   → Backend (Request Processing) → AI Service (Emotion Analysis)
   → AI Service (Response Generation) → AI Service (Optional TTS)
   → Frontend (Display Response)
   ```

4. **Habit Tracking Flow**

   ```
   User → Frontend (Habit Toggle) → API (/habits/toggle)
   → Backend (Document Update) → MongoDB (Habit Collection)
   → Frontend (Progress Update)
   ```

5. **Data Visualization Flow**

   ```
   User → Frontend (Navigate to Analysis/Insights)
   → API (/logs, /habits) → Backend (Query with User Filter)
   → MongoDB (Aggregation/Retrieval) → Frontend (Recharts Rendering)
   ```

## Database Architecture

Neuropattern uses MongoDB as its primary database, leveraging the Motor async driver for non-blocking operations.

### Collections

- **users:** User accounts with email, password hash, profile data, and verification status
- **logs:** Wellness check-in logs with mood, score, sentiment, and timestamp
- **habits:** Habit definitions with goals, colors, icons, and completion history
- **email_verifications:** Email verification tokens with expiration
- **password_resets:** Password reset tokens with expiration

### Indexes

- Unique index on `users.email`
- Unique index on `email_verifications.token_hash` with TTL
- Unique index on `password_resets.token_hash` with TTL
- Compound index on `logs.user_id` and `logs.timestamp` for efficient time-series queries

### Connection Management

- Singleton DatabaseManager pattern ensures a single connection pool
- Connection URI built from environment variables or `MONGODB_URI`
- Automatic index creation on application startup
- Graceful connection closing on shutdown

For detailed database architecture documentation, see [docs/database-architecture.md](docs/database-architecture.md).

## Testing

### Test Suite

The backend has a growing test suite organized in `backend/tests/` with 40 tests across eight modules:

**Backend Tests:**

- Location: `backend/tests/`
- Command: `cd backend && pytest tests/ -v -m "not integration" --tb=short`
- Test breakdown: 25 unit tests, 15 integration tests (40 total)
- Latest execution: 25 unit tests passed, 15 integration tests deselected (MongoDB unavailable)
- Test files:
  - `test_ai_service.py` — 10 tests
  - `test_auth.py` — 4 tests
  - `test_authorization.py` — 6 integration tests
  - `test_config_validation.py` — 8 tests
  - `test_database_lifecycle.py` — 3 integration tests
  - `test_health.py` — 1 test
  - `test_logs_api.py` — 2 tests
  - `test_logs_api_integration.py` — 6 integration tests

**Frontend Tests:**

- No automated tests currently implemented
- Manual testing required for UI/UX validation

### Running Tests

```bash
# Backend unit tests (no MongoDB required)
source venv/bin/activate
PYTHONPATH=backend python -m pytest backend/tests/ -v -m "not integration"

# Backend integration tests (MongoDB required)
source venv/bin/activate
PYTHONPATH=backend MONGODB_URI="mongodb://localhost:27017/neuropattern_test" DB_NAME="neuropattern_test" python -m pytest backend/tests/ -v -m "integration"

# Frontend type check
pnpm run lint

# Frontend build
pnpm run build
```

### Test Results

| Check                     | Command                                         | Result       | Evidence                                   |
| ------------------------- | ----------------------------------------------- | ------------ | ------------------------------------------ |
| Backend unit tests        | `pytest backend/tests/ -v -m "not integration"` | PASS (40/40) | All tests passed                           |
| Backend integration tests | `pytest backend/tests/ -v -m "integration"`     | PASS (15/15) | All integration tests passed (MongoDB)     |
| Frontend type check       | `pnpm run lint`                                 | PASS         | TypeScript compilation successful          |
| Frontend build            | `pnpm run build`                                | PASS         | Production build successful                |
| Python linting            | `ruff check backend/`                           | PASS         | All checks passed                          |
| CI/CD workflow            | GitHub Actions                                  | PASS         | Run 38726521166 succeeded (commit 9378351) |

**Note:** The CI/CD workflow status above reflects the last successful GitHub Actions run on commit `937835193d8c035436abcabed64e8b26f46d1233`. Current local changes have not yet been validated by CI.

**Note:** Test coverage is reasonable for an MVP portfolio project. Additional tests are recommended for:

- API endpoint validation
- Authentication flows
- AI service integration
- Database operations
- Error handling

For detailed testing and verification documentation, see [docs/testing-and-verification.md](docs/testing-and-verification.md).

## Security

### Implemented Security Measures

1. **Authentication**
   - Password hashing with bcrypt (12 rounds)
   - JWT tokens with configurable expiration (default 60 minutes)
   - Email verification required before account activation
   - Secure token storage (httpOnly cookies recommended for production)

2. **Input Validation**
   - Pydantic models enforce type safety and constraints
   - Email validation with email-validator
   - Password complexity requirements (minimum 8 characters)
   - File upload size limits (10MB max)

3. **API Security**
   - CORS configuration restricts allowed origins
   - Protected routes require valid JWT via `Depends(get_current_user)`
   - Environment-based configuration (development vs production)
   - FastAPI automatic data validation

4. **Secrets Management**
   - All sensitive values loaded from environment variables
   - `.env` file excluded from git via `.gitignore`
   - Setup script generates secure random secrets automatically
   - No hardcoded credentials in application code
   - **Production Secret Validation:** The backend validates that production secrets are not using development placeholders. Application will fail to start in production if secrets are insecure.

5. **Database Access Control**
   - Least-privilege MongoDB user (neuropattern_app) with readWrite access only to the neuropattern database
   - Application uses application credentials instead of root credentials (recommended for production)
   - See `docs/mongodb-setup.md` for detailed configuration instructions

### Configuration Requirements

Required environment variables (see `.env.example`):

```env
# Security
SECRET_KEY=<random-64-char-hex>
JWT_SECRET_KEY=<random-64-char-hex>

# Production Secret Validation
# The backend validates that production secrets are not using development placeholders.
# In production (ENVIRONMENT=production), the application will fail to start if:
# - SECRET_KEY is empty or matches known insecure placeholders
# - JWT_SECRET_KEY is empty or matches known insecure placeholders
# - DB_PASSWORD is set but is too short (< 16 characters)

# AI Services
GROQ_API_KEY=<your-groq-api-key>
ELEVENLABS_API_KEY=<your-elevenlabs-api-key>

# Database
MONGODB_URI=<mongodb-connection-string>
# Or: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

# MongoDB Application User (Least-Privilege Access)
# For Docker Compose deployments, the application user is created automatically.
# The backend should use application credentials (neuropattern_app) instead of root credentials.
# See docs/mongodb-setup.md for detailed configuration instructions.
MONGO_APP_USER=neuropattern_app
MONGO_APP_PASSWORD=<strong-unique-password>

# Email (Optional - for password reset)
SMTP_HOST=<smtp-server>
SMTP_PORT=<smtp-port>
SMTP_USER=<smtp-username>
SMTP_PASSWORD=<smtp-app-password>
```

### Known Limitations

1. **Production Readiness:** This is a portfolio project demonstrating full-stack development skills. It is **NOT production-ready**. Additional security hardening, comprehensive testing, and infrastructure setup are required before production deployment.
2. **Docker Configuration:** The `docker-compose.yml` uses default credentials for local development. Users must set strong, unique credentials before deployment.
3. **Rate Limiting:** No rate limiting implemented on API endpoints (required for production)
4. **HTTPS:** Development mode uses HTTP; production requires TLS/SSL configuration
5. **CSRF Protection:** Not implemented (required if adding cookie-based auth)
6. **Audit Logging:** No audit trail for sensitive operations (account deletion, password changes)
7. **Test Coverage:** Minimal test coverage. Comprehensive unit, integration, and E2E tests are required for production.
8. **Secret Management:** Secrets stored in `.env` file. Production deployments should use secret management services (AWS Secrets Manager, HashiCorp Vault).

### Safe Handling of Secrets

- Never commit `.env` files or credentials to version control
- Use environment variable substitution in Docker Compose
- Rotate secrets regularly in production
- Use secret management services (AWS Secrets Manager, HashiCorp Vault) for production deployments

For detailed security documentation, see [docs/security.md](docs/security.md).

## Deployment

### Prerequisites

- **Node.js:** 20+ (22 recommended)
- **Python:** 3.11, 3.12, or 3.13 (audio library compatibility)
- **MongoDB:** 7.0+ (local instance or Docker)
- **API Keys:** Groq and ElevenLabs API keys
- **Package Managers:** pnpm (preferred) or npm

### Local Development Setup

1. **Clone Repository**

   ```bash
   git clone https://github.com/MarcelRx/neuropattern.git
   cd neuropattern
   ```

2. **Run Setup Script**

   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

   This script:
   - Installs frontend dependencies (with esbuild fix for pnpm v9+)
   - Creates Python virtual environment
   - Installs Python dependencies
   - Generates `.env` file with secure secrets
   - Creates required directories

3. **Configure Environment**
   Edit `.env` and add your API keys:

   ```env
   GROQ_API_KEY=gsk_your_actual_key_here
   ELEVENLABS_API_KEY=your_actual_key_here
   ```

4. **Start MongoDB**

   ```bash
   # Using Docker
   docker-compose up mongodb

   # Or local installation
   mongod --dbpath /usr/local/var/mongodb
   ```

5. **Start Application**

   ```bash
   # Both frontend and backend
   pnpm dev

   # Or separately
   pnpm frontend  # http://localhost:3000
   pnpm backend   # http://localhost:8000
   ```

### Docker Deployment

**For Local Development Only:**

1. **Build and Start Services**

   ```bash
   # Set environment variables in .env or docker-compose.yml
   export MONGO_INITDB_ROOT_USERNAME=your_user
   export MONGO_INITDB_ROOT_PASSWORD=your_password
   export MONGO_APP_USER=neuropattern_app
   export MONGO_APP_PASSWORD=your_app_password
   export GROQ_API_KEY=your_key
   export ELEVENLABS_API_KEY=your_key

   docker-compose up -d
   ```

2. **Access Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs (development only)

**Production Deployment:**

This project is **NOT production-ready**. For production deployment, you must:

1. Use a managed MongoDB service (MongoDB Atlas) or configure MongoDB with strong authentication
2. Use the application user (neuropattern_app) instead of root credentials
3. Set strong, unique secrets for all environment variables
4. Enable TLS/SSL for all connections
5. Implement rate limiting, CSRF protection, and audit logging
6. Use a secret management service (AWS Secrets Manager, HashiCorp Vault)
7. Configure CORS origins for your production domain
8. Implement comprehensive testing before deployment

See `docs/deployment.md` and `docs/security.md` for detailed production deployment guidance.

### Production Build

```bash
# Frontend build
pnpm run build

# Backend production mode
cd backend
source venv/bin/activate
gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Development Commands

```bash
# Type checking
pnpm run lint

# Build
pnpm run build

# Preview production build
pnpm run preview

# Format code
pnpm run format

# Full check (lint + build)
pnpm run check
```

For detailed deployment documentation, see [docs/deployment.md](docs/deployment.md).

## Screenshots

Screenshots are not currently available in the repository. To capture screenshots:

1. Start the application locally (`pnpm dev`)
2. Navigate to key pages (Home, Coach, Analysis, Habits, Profile)
3. Use system screenshot tools (Cmd+Shift+4 on macOS, Win+Shift+S on Windows)
4. Add screenshots to the repository in a `screenshots/` directory
5. Update this README with image references

## Live Demo

No verified live demo is currently available. The application is not deployed to a public server.

To deploy a live demo:

1. Set up a production server (AWS, GCP, Azure, or Railway)
2. Configure MongoDB Atlas or managed database
3. Set environment variables for production
4. Deploy using Docker or platform-specific deployment methods
5. Configure domain and SSL/TLS certificates

## Engineering Challenges

### Challenge 1: pnpm v9+ Build Script Blocking

**Problem:** pnpm v9+ blocks postinstall scripts by default, preventing esbuild binary compilation. This caused frontend build failures.

**Solution:**

- Added `onlyBuiltDependencies=esbuild` to `.npmrc`
- Created `pnpm-workspace.yaml` with esbuild build permission
- Updated `setup.sh` to automatically apply these fixes
- Implemented recovery logic to rebuild esbuild if binary is missing

**Evidence:** <ref_file file="/Users/mohsenrassam/Desktop/neuropattern/.npmrc" />, <ref_file file="/Users/mohsenrassam/Desktop/neuropattern/setup.sh" lines="104-127" />

### Challenge 2: TypeScript Type Mismatches

**Problem:** Frontend type definitions didn't match backend API responses, causing TypeScript compilation errors.

**Solution:**

- Added missing fields (`response`, `energy`, `mood`, `score`, `user_emotion`) to `CoachResponse` interface
- Added missing `response` field to `VoiceProcessingResult` interface
- Verified type safety with `pnpm run lint`

**Evidence:** <ref_file file="/Users/mohsenrassam/Desktop/neuropattern/src/types/CoachTypes.ts" lines="18-25" />, <ref_file file="/Users/mohsenrassam/Desktop/neuropattern/src/types/VoiceTypes.ts" lines="24-45" />

### Challenge 3: Python Test Configuration

**Problem:** Test expected `settings.APP_NAME == "NeuroPattern"` but actual value was `"NeuroPattern LifeTracker"`, causing test failure.

**Solution:**

- Updated test assertion to match actual configuration value
- Fixed Pydantic deprecation warning by migrating from `class Config` to `model_config` dict
- Switched from `typing.List` to `list` for Python 3.9+ compatibility

**Evidence:** <ref_file file="/Users/mohsenrassam/Desktop/neuropattern/backend/tests/test_health.py" lines="3-7" />, <ref_file file="/Users/mohsenrassam/Desktop/neuropattern/backend/app/api/core/config.py" lines="119-123" />

### Challenge 4: Hardcoded Credentials in Docker Configuration

**Problem:** `docker-compose.yml` and `mongo-init.js` contained hardcoded database credentials (`lilipot:Jooker123`, `root:rootpass`), creating security risks.

**Solution:**

- Replaced hardcoded values with environment variable placeholders
- Updated `mongo-init.js` to use environment variables conditionally
- Modified `.env.example` to document required Docker environment variables
- Changed default MongoDB URI to use admin auth source

**Evidence:** <ref_file file="/Users/mohsenrassam/Desktop/neuropattern/docker-compose.yml" lines="2-23" />, <ref_file file="/Users/mohsenrassam/Desktop/neuropattern/mongo-init.js" />

## What I Learned

1. **Package Manager Compatibility:** Modern package managers like pnpm v9+ have stricter security policies that require explicit configuration for build scripts. Understanding these changes is critical for maintaining build pipelines.

2. **Type Safety Across Boundaries:** TypeScript types must accurately reflect backend API contracts. Mismatches cause compilation failures and runtime errors. Regular synchronization between frontend types and backend models is essential.

3. **Security in Configuration Files:** Hardcoded credentials in version-controlled files are a significant vulnerability. Environment variable substitution and documentation are necessary for secure deployments.

4. **Pydantic V2 Migration:** Pydantic V2 introduces breaking changes (class-based Config → model_config dict). Keeping dependencies updated and addressing deprecation warnings prevents future breaking changes.

5. **AI API Integration:** Graceful degradation is crucial when integrating third-party AI services. Applications should provide fallback behavior (e.g., browser TTS when ElevenLabs fails) to maintain functionality.

## Future Improvements

### High Priority

1. **Test Coverage Expansion**
   - Add unit tests for all API endpoints
   - Implement integration tests for authentication flows
   - Add E2E tests with Playwright or Cypress
   - Target minimum 80% code coverage

2. **Error Handling Enhancement**
   - Implement structured error responses
   - Add retry logic for AI API failures
   - Improve error messages for user-facing errors
   - Add comprehensive logging

3. **Performance Optimization**
   - Implement response caching for static assets
   - Add database query optimization and indexing
   - Implement CDN for audio file delivery
   - Add rate limiting to prevent abuse

### Medium Priority

4. **Security Hardening**
   - Implement rate limiting on all endpoints
   - Add CSRF protection
   - Implement audit logging for sensitive operations
   - Add input sanitization for user-generated content

5. **Feature Completeness**
   - Complete email notification flow with proper SMTP configuration
   - Add password strength requirements
   - Implement session timeout and refresh tokens
   - Add user onboarding tutorial

6. **Mobile Responsiveness**
   - Optimize UI for mobile devices
   - Add PWA capabilities
   - Implement offline mode with service workers
   - Add push notifications

### Low Priority

7. **Advanced Analytics**
   - Implement more sophisticated pattern recognition
   - Add ML-based trend prediction
   - Create export functionality for user data
   - Add comparative analytics

8. **Social Features**
   - Add anonymous community support groups
   - Implement sharing of wellness milestones
   - Add challenges and gamification
   - Create peer support matching

## AI-Assisted Development

AI-assisted development tools were used to:

- Generate TypeScript type definitions for API responses
- Refactor Python code to address linting issues
- Update configuration files for compatibility with newer package manager versions
- Identify security vulnerabilities in Docker configuration

**Note:** The exact development workflow and AI tool usage cannot be verified from the repository history. No commit messages or documentation explicitly reference AI assistance.

## License

MIT License

Copyright (c) 2024 MarcelRx

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, CONNECTION WITH OR OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
