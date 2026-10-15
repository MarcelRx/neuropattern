# Deployment

## Important Notice

**This project is a portfolio demonstration and is NOT production-ready.**

This document provides instructions for local development setup and deployment guidance. For production deployment, significant additional security hardening, testing, and infrastructure setup are required. See the "Production Deployment Requirements" section below for details.

## Prerequisites and Verified Runtime Versions

### System Requirements

**Operating System:**

- macOS, Linux, or Windows with WSL2
- Docker support for containerized deployment

**Runtime Versions:**

**Node.js:**

- Version: 20+ (22 recommended)
- Package Manager: pnpm 11.5.0+ (preferred) or npm

**Python:**

- Version: 3.11, 3.12, or 3.13
- Audio library compatibility requires 3.11+
- Virtual environment: venv or conda

**MongoDB:**

- Version: 7.0+ (compatible with 4.4+)
- Local instance or Docker container
- MongoDB Atlas for cloud deployment

**System Dependencies:**

- ffmpeg (for audio processing)
- git (for version control)
- make (optional, for build scripts)

### Verified Versions

**From package.json:**

```json
{
  "node": "22",
  "pnpm": "11.5.0",
  "react": "19.2.6",
  "typescript": "5.7.3",
  "vite": "6.4.3"
}
```

**From requirements.txt:**

```txt
python >= 3.11
fastapi >= 0.115.0
uvicorn[standard] >= 0.30.0
motor >= 3.4.0
groq >= 0.9.0
elevenlabs >= 1.0.0
```

## Local Installation and Startup

### Step 1: Clone Repository

```bash
git clone https://github.com/MarcelRx/neuropattern.git
cd neuropattern
```

### Step 2: Run Setup Script

The setup script automates dependency installation and configuration:

```bash
chmod +x setup.sh
./setup.sh
```

**What the script does:**

1. Installs frontend dependencies with pnpm
2. Applies esbuild fix for pnpm v9+ compatibility
3. Creates Python virtual environment
4. Installs Python dependencies
5. Generates `.env` file with secure random secrets
6. Creates required directories

**Manual Setup (if script fails):**

```bash
# Frontend setup
pnpm install

# Backend setup
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Generate secrets
openssl rand -hex 64 > .env.secret
```

### Step 3: Configure Environment

Edit `.env` file and add your API keys:

```env
# AI Services (Required)
GROQ_API_KEY=gsk_your_actual_key_here
ELEVENLABS_API_KEY=your_actual_key_here

# Email (Optional - for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

**Note:** The setup script generates `SECRET_KEY` and `JWT_SECRET_KEY` automatically. Do not edit these unless necessary.

### Step 4: Start MongoDB

**Option A: Using Docker Compose**

```bash
docker-compose up mongodb
```

**Option B: Local MongoDB Installation**

```bash
# macOS with Homebrew
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Verify connection
mongosh --eval "db.adminCommand('ping')"
```

**Option C: MongoDB Atlas**

1. Create free cluster at https://www.mongodb.com/cloud/atlas
2. Get connection string
3. Set `MONGODB_URI` in `.env`

### Step 5: Start Application

**Option A: Both Frontend and Backend**

```bash
pnpm dev
```

This starts:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000

**Option B: Separate Processes**

```bash
# Terminal 1: Frontend
pnpm frontend

# Terminal 2: Backend
pnpm backend
```

**Option C: Manual Backend Start**

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --reload-dir app --host 0.0.0.0 --port 8000
```

### Step 6: Verify Startup

**Frontend:**

- Open http://localhost:3000
- Should see NeuroPattern UI

**Backend:**

- Open http://localhost:8000/health
- Should return: `{"status": "healthy", "database": "healthy", ...}`

**API Documentation (Development Only):**

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Dependency Installation Using the Correct Package Manager and Lockfile

### Frontend Dependencies

**Package Manager:** pnpm (preferred)

**Installation:**

```bash
# Install dependencies
pnpm install

# Install specific version
pnpm add package@version

# Install dev dependency
pnpm add -D package@version
```

**Lockfile:** `pnpm-lock.yaml`

- Ensures reproducible builds
- Commit to version control
- Do not edit manually

**Verification:**

```bash
# Check for vulnerabilities
pnpm audit

# Verify lockfile consistency
pnpm install --frozen-lockfile
```

### Backend Dependencies

**Package Manager:** pip with virtual environment

**Installation:**

```bash
# Activate virtual environment
source venv/bin/activate

# Install from requirements.txt
pip install -r requirements.txt

# Install specific version
pip install package==version
```

**Lockfile:** None (no lockfile used)

- `requirements.txt` specifies version ranges
- Not pinned to exact versions
- Consider using `pip freeze > requirements.lock.txt` for reproducibility

**Verification:**

```bash
# Check for vulnerabilities
pip check

# List installed packages
pip list
```

## Environment Configuration Using `.env.example`

### Environment Variables

**Copy example to actual .env:**

```bash
cp .env.example .env
```

**Required Variables:**

```env
# Security (Auto-generated by setup.sh)
SECRET_KEY=<random-64-char-hex>
JWT_SECRET_KEY=<random-64-char-hex>

# AI Services (Required for AI features)
GROQ_API_KEY=<your-groq-api-key>
ELEVENLABS_API_KEY=<your-elevenlabs-api-key>

# Database (Required)
MONGODB_URI=<mongodb-connection-string>
# Or individual components:
# DB_HOST=localhost
# DB_PORT=27017
# DB_NAME=neuropattern
# DB_USER=<username>
# DB_PASSWORD=<password>
```

**Optional Variables:**

```env
# Email (Required for password reset)
SMTP_HOST=<smtp-server>
SMTP_PORT=<smtp-port>
SMTP_USER=<smtp-username>
SMTP_PASSWORD=<smtp-app-password>
FROM_EMAIL=noreply@neuropattern.app

# URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000

# Frontend (Vite requires VITE_ prefix)
VITE_API_URL=http://localhost:8000/api/v1
VITE_FRONTEND_URL=http://localhost:3000

# CORS
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Environment
ENVIRONMENT=development
```

**Docker Compose Only Variables:**

The following variables are used by `docker-compose.yml` but are not currently read by the backend application configuration:

```env
# Debugging & Logging (Docker Compose only)
DEBUG=1
LOG_LEVEL=INFO
```

### Variable Categories

**CI Variables:**

- Used by GitHub Actions
- Test-only secrets
- Not required for application runtime

**Runtime Variables:**

- Required for application to function
- Must be set in production
- Includes database, AI API keys, secrets

**Optional Feature Variables:**

- Required only for specific features
- Email variables (for password reset)
- Application functions without them

**Deployment Variables:**

- Required only for production deployment
- Environment, debug flags, logging
- Different values per environment

## Docker Image Build and Docker Compose Startup

### Docker Image Build

**Manual Build:**

```bash
# Build backend image
docker build -t neuropattern-backend .

# Build with specific tag
docker build -t neuropattern-backend:v1.0.0 .
```

**Multi-Stage Build:**
The Dockerfile uses multi-stage builds:

1. **Frontend Builder:** Node.js alpine image, builds frontend
2. **Backend:** Python slim image, copies frontend build, installs Python dependencies

**Build Stages:**

```dockerfile
# Stage 1: Frontend Build
FROM node:22-alpine AS frontend-builder
# ... build frontend ...

# Stage 2: Python Backend
FROM python:3.12-slim AS backend
# ... install Python dependencies ...
COPY --from=frontend-builder /app/dist ./static/
```

### Docker Compose Startup

**Start All Services:**

```bash
docker-compose up -d
```

**Services Started:**

- MongoDB (port 27017)
- Backend (port 8000)
- Frontend (dev profile only, port 3000)

**Environment Variables:**
Set in `.env` or export before running:

```bash
export MONGO_INITDB_ROOT_USERNAME=your_user
export MONGO_INITDB_ROOT_PASSWORD=your_password
export GROQ_API_KEY=your_key
export ELEVENLABS_API_KEY=your_key

docker-compose up -d
```

**Start Specific Services:**

```bash
# Start only MongoDB
docker-compose up mongodb

# Start MongoDB and Backend
docker-compose up mongodb backend

# Start all including frontend (dev)
docker-compose --profile dev up
```

**Stop Services:**

```bash
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

**View Logs:**

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
```

### Docker Compose Configuration

**Services:**

**MongoDB:**

- Image: mongo:7.0
- Port: 27017
- Volume: mongo_data
- Health check: mongosh ping
- Init script: mongo-init.js

**Backend:**

- Build: multi-stage Dockerfile
- Port: 8000
- Depends on: mongodb (health check)
- Volume: static_audio
- Health check: curl /health

**Frontend (dev profile):**

- Image: node:22-alpine
- Port: 3000
- Volume: mount source code
- Command: pnpm run frontend

## Database Initialization

### Automatic Initialization

**Index Creation:**

- Automatic on application startup
- Handled by `DatabaseManager.setup_indexes()`
- Called in FastAPI lifespan manager
- Idempotent (safe to run multiple times)

**Indexes Created:**

- Unique index on `users.email`
- Unique index on `email_verifications.token_hash` with TTL
- Unique index on `password_resets.token_hash` with TTL
- Compound index on `logs.user_id` and `logs.timestamp`

### Docker Initialization Script

**mongo-init.js:**

- Runs on first database creation
- Creates application user if credentials provided
- Configured in docker-compose.yml

**Script Location:**

- File: `mongo-init.js`
- Mounted as: `/docker-entrypoint-initdb.d/mongo-init.js`
- Runs only on fresh volume

**Script Content:**

```javascript
db = db.getSiblingDB("neuropattern");

if (
  typeof MONGO_APP_USER !== "undefined" &&
  typeof MONGO_APP_PASSWORD !== "undefined"
) {
  db.createUser({
    user: MONGO_APP_USER,
    pwd: MONGO_APP_PASSWORD,
    roles: [{ role: "readWrite", db: "neuropattern" }],
  });
}
```

**Environment Variables for Init:**

```bash
MONGO_APP_USER=your_app_user
MONGO_APP_PASSWORD=your_app_password
```

### Manual Initialization

**If auto-initialization fails:**

```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/neuropattern

# Create indexes manually
db.users.createIndex({email: 1}, {unique: true})
db.email_verifications.createIndex({token_hash: 1}, {unique: true})
db.email_verifications.createIndex({expires_at: 1}, {expireAfterSeconds: 0})
db.password_resets.createIndex({token_hash: 1}, {unique: true})
db.password_resets.createIndex({expires_at: 1}, {expireAfterSeconds: 0})
db.logs.createIndex({user_id: 1, timestamp: -1})
```

## Health Checks and Troubleshooting

### Health Check Endpoint

**Endpoint:** `GET /health`

**Response (Healthy):**

```json
{
  "status": "healthy",
  "database": "healthy",
  "version": "2.5.0",
  "environment": "development"
}
```

**Response (Degraded):**

```json
{
  "status": "degraded",
  "database": "unhealthy: connection failed",
  "version": "2.5.0",
  "environment": "development"
}
```

**Status Codes:**

- 200: Healthy or degraded
- 503: Service unavailable

### Docker Health Checks

**MongoDB:**

```yaml
healthcheck:
  test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```

**Backend:**

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Common Issues and Solutions

**Issue 1: Backend fails to start**

```
Error: MongoDB connection failed
```

**Solution:**

- Verify MongoDB is running: `docker-compose ps mongodb`
- Check MongoDB logs: `docker-compose logs mongodb`
- Verify `MONGODB_URI` in `.env`
- Check network connectivity

**Issue 2: Frontend build fails**

```
Error: esbuild binary missing
```

**Solution:**

- Ensure `.npmrc` contains: `onlyBuiltDependencies=esbuild`
- Ensure `pnpm-workspace.yaml` contains: `allowBuilds: esbuild: true`
- Reinstall dependencies: `rm -rf node_modules && pnpm install`

**Issue 3: AI features not working**

```
Error: GROQ_API_KEY not configured
```

**Solution:**

- Verify `GROQ_API_KEY` in `.env`
- Verify API key is valid
- Check Groq API status

**Issue 4: Audio processing fails**

```
Error: ffmpeg not found
```

**Solution:**

- Install ffmpeg: `brew install ffmpeg` (macOS) or `sudo apt-get install ffmpeg` (Linux)
- Verify installation: `ffmpeg -version`

**Issue 5: Port already in use**

```
Error: Address already in use
```

**Solution:**

- Check port usage: `lsof -i :3000` or `lsof -i :8000`
- Kill process: `kill -9 <PID>`
- Or change port in configuration

### Debug Commands

**Backend Debug:**

```bash
# Check environment variables
printenv | grep -E "MONGO|GROQ|ELEVEN|JWT|SECRET"

# Test database connection
mongosh $MONGODB_URI

# Check Python dependencies
pip list
```

**Frontend Debug:**

```bash
# Check Node version
node --version

# Check pnpm version
pnpm --version

# Check dependencies
pnpm list --depth=0
```

**Docker Debug:**

```bash
# Check container status
docker-compose ps

# Check container logs
docker-compose logs backend

# Enter container shell
docker-compose exec backend bash

# Check network
docker network inspect neuropattern_neuropattern-network
```

## Production Configuration Requirements

### Environment Variables

**Required for Production:**

```env
# Security (Strong secrets required)
SECRET_KEY=<strong-random-64-char-hex>
JWT_SECRET_KEY=<strong-random-64-char-hex>

# AI Services (Valid API keys required)
GROQ_API_KEY=<production-groq-api-key>
ELEVENLABS_API_KEY=<production-elevenlabs-api-key>

# Database (Production MongoDB URI required)
MONGODB_URI=<production-mongodb-uri>

# Environment
ENVIRONMENT=production
```

**Docker Compose Only Variables:**

The following variables are used by `docker-compose.yml` but are not currently read by the backend application configuration:

```env
# Debugging & Logging (Docker Compose only)
DEBUG=0
LOG_LEVEL=INFO
```

**Recommended for Production:**

```env
# Email (For password reset)
SMTP_HOST=<production-smtp-server>
SMTP_PORT=<smtp-port>
SMTP_USER=<smtp-username>
SMTP_PASSWORD=<smtp-app-password>
FROM_EMAIL=noreply@yourdomain.com

# URLs (Production domains)
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com

# Frontend
VITE_API_URL=https://api.yourdomain.com/api/v1
VITE_FRONTEND_URL=https://yourdomain.com

# CORS (Production domains only)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Security Configuration

**Production Secret Validation:**

The backend now includes environment-aware secret validation. When `ENVIRONMENT=production`, the application will fail to start if:

- `SECRET_KEY` is empty or matches known insecure placeholders (e.g., "dev-secret-change-in-production", "changeme")
- `JWT_SECRET_KEY` is empty or matches known insecure placeholders
- `DB_PASSWORD` is set but is too short (< 16 characters)

This prevents accidental deployment with development credentials. Error messages never expose secret values.

**HTTPS Required:**

- Use reverse proxy (nginx, Apache) for SSL/TLS
- Configure certificate (Let's Encrypt recommended)
- Redirect HTTP to HTTPS

**Secrets Management:**

- Use environment variables or secret management service
- Do not commit `.env` to version control
- Rotate secrets regularly
- Use different secrets per environment

**Database Security:**

- Use MongoDB Atlas for cloud deployment
- Enable authentication
- Use network whitelisting
- Enable encryption at rest
- **Use least-privilege application user** (neuropattern_app) instead of root credentials
- See `docs/mongodb-setup.md` for detailed MongoDB configuration instructions

### Production Build

**Frontend Build:**

```bash
pnpm run build
```

**Backend Production Server:**

```bash
cd backend
source venv/bin/activate
gunicorn app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
```

**Docker Production Build:**

```bash
docker build -t neuropattern-backend:latest .
docker run -d \
  --name neuropattern-backend \
  -p 8000:8000 \
  --env-file .env.production \
  neuropattern-backend:latest
```

## Hosting-Specific Instructions

### Platform: Railway

**Prerequisites:**

- Railway account
- Railway CLI

**Deployment:**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add MongoDB service
railway add mongodb

# Add backend service
railway add --service backend

# Set environment variables
railway variables set GROQ_API_KEY=your_key
railway variables set ELEVENLABS_API_KEY=your_key

# Deploy
railway up
```

### Platform: Render

**Prerequisites:**

- Render account
- Git repository

**Deployment:**

1. Connect repository to Render
2. Create MongoDB service
3. Create web service for backend
4. Set environment variables in Render dashboard
5. Deploy

**Build Command:**

```bash
cd backend && pip install -r requirements.txt
```

**Start Command:**

```bash
gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT
```

### Platform: AWS (EC2)

**Prerequisites:**

- AWS account
- EC2 instance
- Domain name

**Deployment:**

```bash
# SSH into EC2
ssh -i key.pem ec2-user@ec2-instance

# Install Docker
sudo yum install -y docker
sudo service docker start

# Clone repository
git clone https://github.com/MarcelRx/neuropattern.git
cd neuropattern

# Configure environment
cp .env.example .env
# Edit .env with production values

# Start services
docker-compose up -d

# Configure nginx for SSL
sudo yum install -y nginx
# Configure nginx reverse proxy
# Install Let's Encrypt certificate
```

### Platform: DigitalOcean

**Prerequisites:**

- DigitalOcean account
- Droplet or App Platform

**Deployment (App Platform):**

1. Create app in DigitalOcean
2. Connect GitHub repository
3. Add MongoDB component
4. Add backend component
5. Set environment variables
6. Deploy

**Deployment (Droplet):**

```bash
# SSH into droplet
ssh root@droplet-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Clone repository
git clone https://github.com/MarcelRx/neuropattern.git
cd neuropattern

# Configure environment
cp .env.example .env
# Edit .env with production values

# Start services
docker-compose up -d
```

**Note:** These are general examples. Consult platform-specific documentation for detailed instructions.

## Runtime Secrets and Optional Integration Variables

### Runtime Secrets

**Critical Secrets (Required):**

- `SECRET_KEY`: Application secret key
- `JWT_SECRET_KEY`: JWT signing key
- `GROQ_API_KEY`: Groq API key
- `ELEVENLABS_API_KEY`: ElevenLabs API key
- `MONGODB_URI` or database credentials

**Secret Management:**

- Use environment variables
- Use secret management service (AWS Secrets Manager, HashiCorp Vault)
- Do not commit to version control
- Rotate regularly

### Optional Integration Variables

**Email Integration:**

- `SMTP_HOST`: SMTP server
- `SMTP_PORT`: SMTP port
- `SMTP_USER`: SMTP username
- `SMTP_PASSWORD`: SMTP app password
- `FROM_EMAIL`: Sender email address

**Required For:**

- Password reset emails
- Account verification emails

**Optional For:**

- Basic application functionality (app works without email)

**Frontend Configuration:**

- `VITE_API_URL`: Backend API URL
- `VITE_FRONTEND_URL`: Frontend URL

**Required For:**

- Frontend to communicate with backend

## CI/CD Workflow Behavior and Triggers

### GitHub Actions Workflow

**Workflow File:** `.github/workflows/main.yml`

**Triggers:**

```yaml
on:
  push:
    branches: [main, develop]
    tags: ["v*"]
  pull_request:
    branches: [main]
```

**Jobs:**

**Job 1: Lint & Test**

- Runs on: ubuntu-latest
- Steps:
  1. Checkout code
  2. Set up Python 3.12
  3. Install Python dependencies
  4. Install ffmpeg
  5. Lint Python with Ruff
  6. Run Python tests
  7. Install pnpm
  8. Set up Node.js 22
  9. Install Node dependencies
  10. Type check TypeScript
  11. Build frontend

**Job 2: Build Docker Image**

- Runs on: ubuntu-latest
- Conditions: push to main or tags
- Steps:
  1. Checkout code
  2. Set up Docker Buildx
  3. Log in to Container Registry (ghcr.io)
  4. Extract metadata
  5. Build and push Docker image

### CI vs Runtime Configuration

**CI Configuration:**

- Test-only secrets
- No production API keys
- Mock or skip external integrations
- Fast feedback for developers

**Runtime Configuration:**

- Production secrets
- Real API keys
- Full external integrations
- Optimized for production

**Separation:**

- CI uses test environment variables
- Runtime uses production environment variables
- No overlap or sharing of secrets
- CI does not require production credentials

### CI Secrets

**Current CI Secrets:**

- `GITHUB_TOKEN`: Automatically provided by GitHub Actions
- Used for: Container registry authentication
- No manual configuration required

**Test Secrets:**

- `JWT_SECRET_KEY`: Test value (not production)
- `SECRET_KEY`: Test value (not production)
- Set in workflow file (not secrets)

**No CI Secrets Required:**

- No manual secret configuration needed
- No production API keys in CI
- No database credentials in CI
- Tests use test values or mocks

## Deployment Verification and Rollback Considerations

### Deployment Verification

**Health Check:**

```bash
# Check backend health
curl https://yourdomain.com/health

# Expected response:
# {"status": "healthy", "database": "healthy", ...}
```

**API Verification:**

```bash
# Test API endpoint
curl https://yourdomain.com/api/v1/health

# Test authentication
curl -X POST https://yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

**Frontend Verification:**

- Open https://yourdomain.com
- Verify UI loads correctly
- Test user registration
- Test user login
- Test AI coach functionality

**Database Verification:**

```bash
# Connect to MongoDB
mongosh $MONGODB_URI

# Check collections
db.users.countDocuments()
db.logs.countDocuments()
db.habits.countDocuments()
```

### Rollback Considerations

**Docker Rollback:**

```bash
# Stop current version
docker-compose down

# Pull previous version
docker pull neuropattern-backend:v1.0.0

# Start previous version
docker-compose up -d
```

**Git Rollback:**

```bash
# Checkout previous commit
git checkout <commit-hash>

# Rebuild and deploy
docker-compose build
docker-compose up -d
```

**Database Rollback:**

- No automated database rollback
- Manual restoration from backup required
- Consider database backups before deployment

**Rollback Strategy:**

1. Keep previous Docker image tagged
2. Use database backups before major changes
3. Test rollback procedure
4. Document rollback steps
5. Monitor after rollback

### Blue-Green Deployment (Recommended)

**Strategy:**

1. Deploy new version to green environment
2. Verify green environment
3. Switch traffic from blue to green
4. Keep blue as rollback option
5. Delete blue after verification

**Implementation:**

- Use load balancer (nginx, AWS ALB)
- Two separate deployments (blue, green)
- Instant rollback by switching traffic
- Zero-downtime deployments

## Differences Between Successful GitHub Actions Run and Fully Configured Production Deployment

### GitHub Actions Success

**What It Verifies:**

- Code compiles (TypeScript, Python)
- Tests pass (minimal test coverage)
- Docker image builds successfully
- No linting errors

**What It Does Not Verify:**

- Production configuration
- External API connectivity
- Database connectivity
- SSL/TLS configuration
- Domain configuration
- Email integration
- Full integration testing

### Production Deployment Requirements

**Additional Requirements:**

1. **Environment Variables:**
   - Production secrets
   - Real API keys
   - Database credentials
   - Domain URLs

2. **Infrastructure:**
   - Server or cloud platform
   - Database instance
   - Domain name
   - SSL/TLS certificate
   - Load balancer (for scaling)

3. **Configuration:**
   - CORS origins
   - SMTP configuration
   - Reverse proxy configuration
   - Firewall rules
   - Network security

4. **Monitoring:**
   - Application monitoring
   - Error tracking
   - Log aggregation
   - Performance monitoring
   - Uptime monitoring

5. **Backups:**
   - Database backups
   - Backup retention policy
   - Disaster recovery plan
   - Backup verification

### Deployment Checklist

**Before Deployment:**

- [ ] All environment variables set
- [ ] Production secret validation configured (ENVIRONMENT=production)
- [ ] Secrets verified to be strong and not using development placeholders
- [ ] Database configured with least-privilege application user (neuropattern_app)
- [ ] Database credentials are strong and unique
- [ ] API keys valid and have quota
- [ ] Domain configured and DNS propagated
- [ ] SSL/TLS certificate installed
- [ ] Firewall rules configured
- [ ] Monitoring and logging configured
- [ ] Backups configured
- [ ] Rollback plan documented

**After Deployment:**

- [ ] Health check passes
- [ ] API endpoints accessible
- [ ] Frontend loads correctly
- [ ] User registration works
- [ ] User login works
- [ ] AI features work
- [ ] Email integration works (if configured)
- [ ] Monitoring shows no errors
- [ ] Logs show no errors
- [ ] Performance acceptable

**Production Readiness:**

- GitHub Actions passing ≠ production ready
- CI verifies code quality, not production configuration
- Separate validation required for production deployment
- Manual verification of all integrations
