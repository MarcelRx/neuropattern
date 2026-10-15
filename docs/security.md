# Security

## Authentication and Authorization Mechanisms

### Authentication Implementation

NeuroPattern implements JWT-based authentication for API access.

**Authentication Flow:**

1. **User Registration:**
   - User submits email and password
   - Password hashed with bcrypt (12 rounds)
   - User document created in MongoDB
   - Email verification token generated
   - Verification email sent (if SMTP configured)

2. **User Login:**
   - User submits email and password
   - Password verified against bcrypt hash
   - JWT token generated with user ID
   - Token returned to client
   - Client stores token in localStorage

3. **Token Validation:**
   - Token extracted from `Authorization: Bearer <token>` header
   - JWT signature verified using `JWT_SECRET_KEY`
   - Token expiration checked
   - User fetched from database
   - User document attached to request state

**JWT Token Structure:**
```json
{
  "sub": "user_id",
  "exp": expiration_timestamp
}
```

**Token Configuration:**
- Algorithm: HS256
- Secret: `JWT_SECRET_KEY` environment variable
- Expiration: `ACCESS_TOKEN_EXPIRE_MINUTES` (default 60 minutes)

### Authorization Implementation

**Current Authorization Model:**
- All authenticated users have full access to their own data
- No role-based access control (RBAC)
- No permission system
- User ownership verified via `user_id` field in documents

**Protected Routes:**
All routes except the following require authentication:
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /health` (health check)

**Ownership Verification:**
- Database queries filter by `user_id`
- No cross-user data access
- Manual ownership checks in route handlers

**Authorization Code Example:**
```python
@router.get("/logs")
async def get_logs(
    current_user: dict = Depends(auth.get_current_user),
    db = Depends(get_db)
):
    # Only returns logs for current_user["_id"]
    cursor = db.logs.find({"user_id": current_user["_id"]})
    # ...
```

## Password Hashing and Account Verification

### Password Hashing

**Algorithm:** bcrypt
**Rounds:** 12 (configured in passlib)
**Implementation:** passlib with bcrypt backend

**Hashing Process:**
```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)
```

**Security Properties:**
- Automatic salt generation
- Computationally intensive (prevents brute force)
- Adaptive cost factor (can increase rounds over time)
- No plain text passwords stored

### Account Verification

**Email Verification:**
- Required before login
- Token sent via email (if SMTP configured)
- Token hashed with SHA-256 before storage
- Token expires after 24 hours
- TTL index auto-deletes expired tokens

**Verification Flow:**
1. User registers → verification token generated
2. Token hash stored in `email_verifications` collection
3. Email sent with verification link
4. User clicks link → token verified
5. `is_verified` set to `true` in user document
6. User can now login

**Verification Token Security:**
- Token generated with `secrets.token_urlsafe(32)` (cryptographically secure)
- Token hashed with SHA-256 before storage (prevents token theft if database compromised)
- Token expires after 24 hours (reduces attack window)
- Single-use token (deleted after verification)

## JWT Signing, Validation, Expiration, and Token Storage

### JWT Signing

**Library:** python-jose
**Algorithm:** HS256
**Secret Key:** `JWT_SECRET_KEY` environment variable

**Signing Process:**
```python
from jose import jwt
from datetime import datetime, timedelta, timezone

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt
```

### JWT Validation

**Validation Process:**
```python
def get_current_user(request: Request, token: Optional[str], db):
    # Extract token from header
    if not token:
        raise HTTPException(status_code=401, detail="No token found")

    # Decode and verify
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")

        # Check expiration
        exp = payload.get("exp")
        if exp and datetime.now(timezone.utc).timestamp() > exp:
            raise HTTPException(status_code=401, detail="Token expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Fetch user from database
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user
```

### Token Expiration

**Default Expiration:** 60 minutes
**Configuration:** `ACCESS_TOKEN_EXPIRE_MINUTES` environment variable
**Enforcement:** Checked on every request

**Expiration Behavior:**
- Expired tokens rejected with 401 error
- Client must re-authenticate
- No refresh token implementation (requires re-login)

### Token Storage

**Current Implementation:**
- Stored in browser localStorage
- Key: `auth_token`
- No httpOnly cookie (security limitation)

**Storage Location:**
```javascript
// Frontend
localStorage.setItem('auth_token', token);

// Retrieval
const token = localStorage.getItem('auth_token');
```

**Security Concerns:**
- localStorage is vulnerable to XSS attacks
- No httpOnly cookie (more secure against XSS)
- No sameSite cookie attribute
- No secure cookie attribute (HTTPS only)

**Recommended Improvement:**
- Use httpOnly cookies with secure and sameSite attributes
- Implement short-lived access tokens with refresh tokens
- Add token rotation on refresh

## Secret and Environment-Variable Management

### Secret Management Strategy

**Implementation:**
- All secrets loaded from environment variables
- `.env` file excluded from git via `.gitignore`
- Setup script generates secure random secrets
- No hardcoded credentials in application code

**Environment Variables:**

**Security Secrets:**
```env
SECRET_KEY=<random-64-char-hex>
JWT_SECRET_KEY=<random-64-char-hex>
```

**API Keys:**
```env
GROQ_API_KEY=<your-groq-api-key>
ELEVENLABS_API_KEY=<your-elevenlabs-api-key>
```

**Database Credentials:**
```env
MONGODB_URI=<mongodb-connection-string>
# Or:
DB_HOST=localhost
DB_PORT=27017
DB_NAME=neuropattern
DB_USER=<username>
DB_PASSWORD=<password>
```

**Email Credentials:**
```env
SMTP_HOST=<smtp-server>
SMTP_PORT=<smtp-port>
SMTP_USER=<smtp-username>
SMTP_PASSWORD=<smtp-app-password>
```

### Secret Generation

**Setup Script (`setup.sh`):**
```bash
# Generate secure random secrets
GEN_SECRET_KEY=$(openssl rand -hex 64)
GEN_JWT_SECRET=$(openssl rand -hex 64)

# Write to .env
echo "SECRET_KEY=$GEN_SECRET_KEY" >> .env
echo "JWT_SECRET_KEY=$GEN_JWT_SECRET" >> .env
```

**Security Properties:**
- Uses OpenSSL for cryptographically secure random generation
- 64-character hex strings (256 bits of entropy)
- Generated on initial setup
- Not stored in version control

### Production Secret Management

**Current Limitation:**
- Secrets stored in `.env` file on server
- No secret rotation mechanism
- No secret versioning
- No audit trail for secret access

**Recommended Production Approach:**
- Use AWS Secrets Manager, HashiCorp Vault, or similar
- Implement secret rotation
- Use different secrets per environment
- Audit secret access
- Encrypt secrets at rest

## Input Validation and Request-Size Controls

### Input Validation

**Pydantic Models:**
All request bodies validated with Pydantic models before processing.

**Validation Layers:**

1. **Type Validation:**
```python
class UserCreate(BaseModel):
    email: EmailStr  # Must be valid email
    password: str = Field(..., min_length=8)  # Minimum 8 characters
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
```

2. **Custom Validators:**
```python
@field_validator('password')
@classmethod
def password_complexity(cls, v: str) -> str:
    v = v.strip()
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters")
    return v
```

3. **Email Validation:**
- Uses `email-validator` library
- Validates email format
- Normalizes to lowercase

**Validation Example:**
```python
class ChatRequest(BaseModel):
    message: str
    context: Optional[dict] = None
    language: Optional[str] = None
    generateVoice: bool = False
```

### Request-Size Controls

**File Upload Limits:**
- No explicit file size limit configured in FastAPI
- Relies on web server (Uvicorn/Gunicorn) defaults
- Recommended: Add explicit size limits

**Request Body Limits:**
- No explicit request body size limit
- Relies on framework defaults
- Recommended: Add explicit limits

**String Length Limits:**
- Password: Minimum 8 characters
- Full name: 2-100 characters
- Email: Valid email format
- Other fields: No explicit limits

**Recommended Improvements:**
```python
# Add to FastAPI app
app = FastAPI(
    max_request_size=10 * 1024 * 1024,  # 10MB
    max_upload_size=10 * 1024 * 1024   # 10MB
)
```

## CORS Configuration and Its Actual Limitations

### CORS Implementation

**Middleware:** FastAPI CORSMiddleware
**Configuration:** `backend/app/api/core/config.py`

**CORS Origins:**
```python
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]
```

**CORS Middleware Configuration:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### CORS Limitations

**Current Limitations:**
1. **All Methods Allowed:** `allow_methods=["*"]` allows all HTTP methods
2. **All Headers Allowed:** `allow_headers=["*"]` allows all headers
3. **Credentials Enabled:** `allow_credentials=True` with wildcard origins is unsafe
4. **No Origin Validation:** No explicit origin pattern matching
5. **Development Origins Only:** Only localhost configured

**Security Risks:**
- Overly permissive CORS policy
- Credentials enabled with specific origins (good)
- All methods/headers allowed (bad)

**Recommended Improvements:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://production-domain.com"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600
)
```

## Rate Limiting and Abuse Prevention

### Current Implementation

**Status:** Not implemented

**Limitations:**
- No rate limiting on any endpoints
- No request throttling
- No abuse prevention
- No DDoS protection

**Security Risks:**
- API abuse possible
- Brute force attacks on login
- Spam registration
- Resource exhaustion attacks

**Recommended Implementations:**

1. **Rate Limiting Library:**
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@limiter.limit("10/minute")
@router.post("/auth/login")
async def login(credentials: UserLogin):
    # ...
```

2. **Login Rate Limiting:**
- Limit login attempts per IP
- Limit login attempts per email
- Implement account lockout after failed attempts

3. **API Rate Limiting:**
- Limit requests per user
- Limit requests per IP
- Implement tiered limits (free vs premium)

## Database Credentials and Access Boundaries

### Database Authentication

**Authentication Methods:**

1. **No Authentication (Local Development):**
   - URI: `mongodb://localhost:27017/neuropattern`
   - No username or password
   - Suitable for local development only

2. **Username/Password Authentication:**
   - URI: `mongodb://user:password@host:port/dbname?authSource=dbname`
   - Credentials in environment variables
   - Suitable for production

3. **MongoDB Atlas:**
   - URI: `mongodb+srv://user:password@cluster.mongodb.net/dbname`
   - Connection string from Atlas dashboard
   - Suitable for cloud deployment

### Database User Roles

**Application User:**
- Role: `readWrite` on `neuropattern` database
- Created by `mongo-init.js` if credentials provided
- Full read/write access to application data
- No admin privileges

**Root User (Docker):**
- Role: `root` on `admin` database
- Created by Docker image
- Used for database initialization only
- Not used by application

### Access Boundaries

**Application-Level:**
- All database access through application
- No direct database access for users
- Authentication required for all operations
- User isolation via `user_id` field

**Network-Level:**
- MongoDB default port: 27017
- Firewall configuration recommended for production
- VPN or private network for production deployments

**Credential Storage:**
- Database credentials in environment variables
- Not hardcoded in application
- Not stored in version control
- Setup script generates placeholders

### Recommended Improvements

1. **Network Isolation:**
   - Run MongoDB in private network
   - Use VPN for admin access
   - Firewall rules to restrict access

2. **Connection Encryption:**
   - Use TLS/SSL for database connections
   - Require TLS in production
   - Validate certificates

3. **Credential Rotation:**
   - Regular password rotation
   - Different credentials per environment
   - No credential reuse

## Frontend/Backend Trust Boundaries

### Trust Boundaries

**Frontend (Client-Side):**
- Runs in user's browser
- User has full control
- Cannot be trusted for security decisions
- All security decisions must be server-side

**Backend (Server-Side):**
- Runs on trusted server
- Controlled environment
- Can be trusted for security decisions
- All validation and authorization here

### Security Decisions

**Must Be Server-Side:**
- Authentication (token validation)
- Authorization (permission checks)
- Input validation (sanitization)
- Business logic enforcement
- Data access control

**Can Be Client-Side (for UX):**
- Basic form validation (email format, password length)
- UI state management
- Error message display
- Navigation control

### Current Implementation

**Server-Side (Correct):**
- JWT token validation
- Password verification
- Database access control
- Input validation with Pydantic

**Client-Side (Limited):**
- Basic form validation
- Token storage in localStorage (security concern)
- No server-side security bypassed

**Trust Boundary Violations:**
- None identified
- All security decisions server-side
- Good separation of concerns

### Recommended Improvements

1. **CSRF Protection:**
   - Implement CSRF tokens for state-changing operations
   - Validate CSRF tokens on server
   - Especially important if using cookies

2. **Content Security Policy:**
   - Implement CSP headers
   - Restrict script sources
   - Prevent XSS attacks

3. **X-Frame-Options:**
   - Prevent clickjacking
   - Set `X-Frame-Options: DENY`

4. **X-Content-Type-Options:**
   - Prevent MIME sniffing
   - Set `X-Content-Type-Options: nosniff`

## External AI Provider Data Handling

### Data Sent to Groq

**Speech-to-Text:**
- Audio files (user voice recordings)
- May contain personal information
- May contain mental health information

**Emotion Analysis:**
- User messages (text)
- Vocal tone context
- May contain sensitive information

**Response Generation:**
- User messages
- Conversation history
- Detected emotions
- May contain sensitive information

### Data Sent to ElevenLabs

**Text-to-Speech:**
- AI coach responses
- May contain personal information
- May contain mental health information

### Privacy Considerations

**Data Retention:**
- Groq: No explicit retention policy stated
- ElevenLabs: No explicit retention policy stated
- Application: Audio files stored locally in `static/audio/`

**Data Sensitivity:**
- User messages may contain personal mental health information
- Voice recordings may contain identifying information
- No encryption in transit (HTTPS recommended for production)

**Recommended:**
1. Review Groq and ElevenLabs privacy policies
2. Implement HTTPS for all API calls
3. Consider data anonymization
4. Implement audio file cleanup (TTL)
5. Add privacy policy to application
6. Obtain user consent for AI processing

## Logging and Sensitive-Data Exposure Risks

### Current Logging

**Implementation:**
- Python `logging` module
- Basic logging in AI service and database
- Debug prints in security module (for debugging auth)

**Log Levels:**
- `INFO`: Database connection, index creation
- `WARNING`: CORS parsing failures
- `ERROR`: AI service failures, database errors

**Debug Prints:**
```python
# In security.py (line 84, 91, 124)
print(f"[Auth] Header: {auth_header[:30]}...")
print(f"[Auth] No token found")
print(f"[Auth] Authenticated: {user.get('email')}")
```

### Sensitive Data Exposure Risks

**Current Risks:**
1. **Debug Prints in Production:**
   - May expose auth headers
   - May expose user emails
   - Should be replaced with proper logging

2. **No Log Sanitization:**
   - No redaction of sensitive data
   - User messages logged as-is
   - May contain personal information

3. **No Log Rotation:**
   - Logs grow indefinitely
   - May fill disk
   - No retention policy

4. **No Log Encryption:**
   - Logs stored in plain text
   - No encryption at rest
   - Accessible to anyone with server access

### Recommended Improvements

1. **Remove Debug Prints:**
   - Replace all `print()` with `logger.debug()`
   - Configure log level for production
   - Disable debug logs in production

2. **Log Sanitization:**
   - Redact sensitive data (tokens, passwords)
   - Sanitize user messages
   - Anonymize user identifiers

3. **Log Rotation:**
   - Implement log rotation
   - Set retention policy (e.g., 30 days)
   - Compress old logs

4. **Structured Logging:**
   - Use JSON format for logs
   - Add request IDs for tracing
   - Include timestamps and log levels

5. **Log Access Control:**
   - Restrict log file permissions
   - Encrypt logs at rest
   - Audit log access

## Dependency and Container Security

### Dependency Security

**Python Dependencies:**
- Managed via `requirements.txt`
- No automated vulnerability scanning
- No dependency pinning (some ranges)
- Regular updates manual

**Frontend Dependencies:**
- Managed via `package.json` and `pnpm-lock.yaml`
- No automated vulnerability scanning
- Lockfile ensures reproducibility
- Regular updates manual

**Security Risks:**
- Vulnerable dependencies may be introduced
- No automated detection of CVEs
- Manual review required
- Timely updates may be missed

**Recommended:**
1. Implement dependency scanning (e.g., Snyk, Dependabot)
2. Use automated security alerts
3. Pin dependency versions where possible
4. Regular dependency updates
5. Review security advisories

### Container Security

**Dockerfile:**
- Multi-stage build (good security practice)
- Non-root user (appuser with UID 1000)
- Minimal base image (python:3.12-slim)
- FFmpeg installed from apt

**Implementation:**
```dockerfile
# Non-root user
RUN groupadd -r neuropattern && useradd -r -m -g neuropattern -u 1000 appuser
USER appuser
```

**Security Properties:**
- Non-root user reduces attack surface
- Minimal base image reduces vulnerabilities
- Multi-stage build reduces final image size
- No secrets in image (environment variables)

**Limitations:**
- No image vulnerability scanning
- No base image updates
- No security scanning in CI
- No image signing

**Recommended:**
1. Implement image vulnerability scanning (e.g., Trivy)
2. Use security-hardened base images
3. Scan images in CI pipeline
4. Sign images for integrity
5. Regular base image updates

### Docker Compose Security

**Configuration:**
- Environment variables for secrets (good)
- No hardcoded credentials (good)
- Health checks implemented (good)
- Network isolation (bridge network)

**Limitations:**
- No resource limits
- No container security policies
- No network segmentation
- Secrets in `.env` file (not encrypted)

**Recommended:**
1. Add resource limits (CPU, memory)
2. Implement container security policies
3. Use secrets management service
4. Encrypt secrets at rest
5. Network segmentation for production

## Security Limitations and Prioritized Recommendations

### Implemented Protections

1. **Password Hashing:** bcrypt with 12 rounds ✓
2. **JWT Authentication:** Token-based auth ✓
3. **Input Validation:** Pydantic models ✓
4. **Email Validation:** email-validator ✓
5. **Environment Variables:** Secrets not in code ✓
6. **Non-root Container:** Docker security ✓
7. **Token Hashing:** SHA-256 for reset tokens ✓
8. **Token Expiration:** TTL indexes ✓
9. **CORS:** Configured (permissive) ✓
10. **User Isolation:** user_id filtering ✓

### Recommended Protections (Not Implemented)

**High Priority:**

1. **Rate Limiting:**
   - Implement on all endpoints
   - Especially on login and registration
   - Prevent brute force attacks

2. **CSRF Protection:**
   - Implement CSRF tokens
   - Validate on state-changing operations
   - Prevent CSRF attacks

3. **Secure Token Storage:**
   - Use httpOnly cookies
   - Implement refresh tokens
   - Short-lived access tokens

4. **Remove Debug Prints:**
   - Replace with proper logging
   - Disable debug logs in production
   - Prevent information leakage

5. **HTTPS Enforcement:**
   - Require HTTPS in production
   - Implement HSTS
   - Secure cookie attributes

**Medium Priority:**

6. **CORS Hardening:**
   - Restrict allowed methods
   - Restrict allowed headers
   - Explicit origin list

7. **Security Headers:**
   - CSP headers
   - X-Frame-Options
   - X-Content-Type-Options

8. **Request Size Limits:**
   - Explicit file size limits
   - Explicit body size limits
   - Prevent DoS attacks

9. **Dependency Scanning:**
   - Automated vulnerability scanning
   - Security alerts
   - Regular updates

10. **Image Scanning:**
    - Container vulnerability scanning
    - Base image updates
    - Image signing

**Low Priority:**

11. **Audit Logging:**
    - Log sensitive operations
    - Audit trail for compliance
    - Log access controls

12. **Secret Rotation:**
    - Regular password rotation
    - Different secrets per environment
    - No credential reuse

13. **Database Encryption:**
    - Encryption at rest
    - TLS for connections
    - Key management

14. **Input Sanitization:**
    - Sanitize user input
    - Prevent XSS
    - Prevent injection attacks

### Clearly Separate Implemented from Recommended

**Implemented:** See "Implemented Protections" above
**Recommended:** See "Recommended Protections" above

**Distinction:**
- Implemented protections are active and functional
- Recommended protections are proposed improvements
- Do not claim a protection exists unless implemented
