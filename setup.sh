#!/bin/bash
# =============================================================================
# NeuroPattern LifeTracker — Local Development Setup
# Handles: Frontend deps (esbuild fix for pnpm v9+), Python venv, .env validation, dirs
# =============================================================================

set -euo pipefail

# ─── Colors ─────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
step()  { echo -e "\n${BLUE}${BOLD}[STEP]${NC} $1"; }
die()   { error "$1"; exit 1; }

command_exists() { command -v "$1" &> /dev/null; }

# ─── 0. Project Root Guard ──────────────────────────────────────────────────
if [ ! -f "package.json" ]; then
    die "package.json not found. Please run this script from the project root."
fi

PROJECT_ROOT="$(pwd)"
info "Project root: $PROJECT_ROOT"

# ─── 1. Prerequisites Check ─────────────────────────────────────────────────
step "Checking Prerequisites"

MISSING=""
for cmd in node python3; do
    if command_exists "$cmd"; then
        ver=$($cmd --version 2>/dev/null | head -1)
        info "$cmd found: $ver"
    else
        error "$cmd is missing"
        MISSING="$MISSING $cmd"
    fi
done

if [ -n "$MISSING" ]; then
    die "Missing prerequisites:$MISSING\n\nInstall them first:\n  - Node:   brew install node\n  - Python: brew install python@3.12"
fi

# Detect package manager (pnpm preferred)
PKG_MANAGER=""
if command_exists pnpm; then
    PKG_MANAGER="pnpm"
    info "Package manager: pnpm"
else
    PKG_MANAGER="npm"
    warn "pnpm not found. Falling back to npm (slower). Install pnpm for best results: npm install -g pnpm"
fi

# ─── 2. Python Version Lock (3.11–3.13 only) ────────────────────────────────
step "Resolving Python Version"

PY_CMD=""
PYTHON_VERSION=""
for cmd in python3.12 python3.11 python3.13 python3; do
    if command -v "$cmd" &> /dev/null; then
        ver=$($cmd -c 'import sys; print(".".join(map(str, sys.version_info[:2])))' 2>/dev/null || true)
        if [[ "$ver" == "3.11" || "$ver" == "3.12" || "$ver" == "3.13" ]]; then
            PY_CMD="$cmd"
            PYTHON_VERSION="$ver"
            break
        fi
    fi
done

if [ -z "$PY_CMD" ]; then
    error "Compatible Python not found. Need 3.11–3.13 (audio libs constraint)."
    error "You have:"
    for cmd in python3 python3.12 python3.11 python3.13; do
        command -v "$cmd" &> /dev/null && $cmd --version
    done
    die "Install Python 3.12: brew install python@3.12"
fi

info "Using Python $PYTHON_VERSION via $PY_CMD"

# ─── 3. Frontend Setup (with Esbuild Fix for pnpm v9+) ──────────────────────
step "Installing Frontend Dependencies"

# Validate package.json first
if ! node -e "JSON.parse(require('fs').readFileSync('package.json'))" 2>/dev/null; then
    die "package.json is corrupted or invalid JSON. Please fix it before running setup."
fi

# Wipe broken node_modules (esbuild binary missing)
if [ -d "node_modules" ]; then
    if [ ! -f "node_modules/esbuild/bin/esbuild" ]; then
        warn "node_modules exists but esbuild binary is missing. Cleaning..."
        rm -rf node_modules pnpm-lock.yaml package-lock.yaml yarn.lock
    fi
fi

# ── ESBUILD FIX: pnpm v9+ blocks postinstall scripts and exits non-zero ─────
if [ "$PKG_MANAGER" = "pnpm" ]; then
    # Remove stale "pnpm" key from package.json (old v8 format, ignored by v9+)
    if command_exists node; then
        if node -e "const p=require('./package.json'); process.exit(p.pnpm?0:1)" 2>/dev/null; then
            warn "Removing obsolete 'pnpm' field from package.json (pnpm v9+ ignores it)..."
            node -e "const fs=require('fs'),p=require('./package.json'); delete p.pnpm; fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\\n');" 2>/dev/null || true
        fi
    fi

    # Create .npmrc with pnpm v9+ compatible syntax
    if [ ! -f ".npmrc" ] || ! grep -q "onlyBuiltDependencies" .npmrc 2>/dev/null; then
        info "Creating .npmrc for pnpm v9+ build script permissions..."
        echo "onlyBuiltDependencies=esbuild" >> .npmrc
    fi

    # Also create pnpm-workspace.yaml as fallback
    if [ ! -f "pnpm-workspace.yaml" ]; then
        cat > pnpm-workspace.yaml << 'PNPMEOF'
onlyBuiltDependencies:
  - esbuild
PNPMEOF
    fi
fi

info "Running $PKG_MANAGER install..."
if [ "$PKG_MANAGER" = "pnpm" ]; then
    set +e
    pnpm install
    PNPM_STATUS=$?
    set -e

    if [ $PNPM_STATUS -ne 0 ]; then
        warn "pnpm install exited with code $PNPM_STATUS (likely ignored build scripts). Running recovery..."
    fi

    if [ ! -f "node_modules/esbuild/bin/esbuild" ]; then
        warn "esbuild binary missing. Attempting recovery..."
        pnpm approve-builds esbuild 2>/dev/null || true
        pnpm rebuild esbuild 2>/dev/null || true
        if [ -f "node_modules/esbuild/install.js" ]; then
            node node_modules/esbuild/install.js 2>/dev/null || true
        fi
        if [ ! -f "node_modules/esbuild/bin/esbuild" ]; then
            pnpm add -D esbuild --force 2>/dev/null || true
        fi
    fi
else
    npm install
    if [ ! -f "node_modules/esbuild/bin/esbuild" ]; then
        warn "esbuild binary missing. Running npm rebuild..."
        npm rebuild esbuild 2>/dev/null || true
    fi
fi

if [ ! -f "node_modules/esbuild/bin/esbuild" ]; then
    echo ""
    error "esbuild binary is STILL missing after all recovery attempts."
    echo ""
    warn "Manual fix:"
    echo -e "   ${YELLOW}pnpm approve-builds${NC}  # select esbuild"
    echo -e "   ${YELLOW}rm -rf node_modules pnpm-lock.yaml && pnpm install${NC}"
    echo ""
    die "Cannot continue without esbuild."
fi

info "esbuild binary verified ✓"

# ─── 4. Backend Setup ─────────────────────────────────────────────────────
step "Setting up Python Virtual Environment"

VENV_DIR="$PROJECT_ROOT/venv"

if [ -d "$VENV_DIR" ]; then
    VENV_VER=$("$VENV_DIR/bin/python" -c 'import sys; print(".".join(map(str, sys.version_info[:2])))' 2>/dev/null || echo "unknown")
    if [ "$VENV_VER" != "$PYTHON_VERSION" ]; then
        warn "Existing venv uses Python $VENV_VER, but we need $PYTHON_VERSION. Recreating..."
        rm -rf "$VENV_DIR"
    fi
fi

if [ ! -d "$VENV_DIR" ]; then
    info "Creating venv with $PY_CMD..."
    "$PY_CMD" -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate" 2>/dev/null || source "$VENV_DIR/Scripts/activate" 2>/dev/null || die "Failed to activate virtual environment"

info "Upgrading pip..."
pip install --upgrade pip

if [ ! -f "requirements.txt" ]; then
    die "requirements.txt not found in project root."
fi

info "Installing Python dependencies (this may take a few minutes)..."
pip install -r requirements.txt

# ─── 5. Environment File ────────────────────────────────────────────────────
step "Configuring Environment"

ENV_FILE="$PROJECT_ROOT/.env"

if [ -f "$ENV_FILE" ]; then
    info ".env found at project root — validating contents..."

    # Check for placeholder secrets
    HAS_PLACEHOLDER_SECRETS=false
    if grep -qE "^(SECRET_KEY|JWT_SECRET_KEY)\s*=\s*(your_|your-|yoursecret|change-me|changeme|<auto-generated>|\s*$)" "$ENV_FILE" 2>/dev/null; then
        HAS_PLACEHOLDER_SECRETS=true
    fi

    # Check for placeholder API keys
    HAS_PLACEHOLDER_APIS=false
    if grep -qE "^(GROQ_API_KEY|ELEVENLABS_API_KEY)\s*=\s*(your_|your-|gsk_your|your_elevenlabs|\s*$)" "$ENV_FILE" 2>/dev/null; then
        HAS_PLACEHOLDER_APIS=true
    fi

    if [ "$HAS_PLACEHOLDER_SECRETS" = true ]; then
        warn "⚠️  Your .env contains WEAK or PLACEHOLDER secrets (SECRET_KEY / JWT_SECRET_KEY)!"
        warn "   These must be strong random strings for security."
        echo ""
        echo -e "   ${BOLD}To fix, run:${NC}"
        echo -e "   ${YELLOW}openssl rand -hex 64${NC}  → paste into SECRET_KEY"
        echo -e "   ${YELLOW}openssl rand -hex 64${NC}  → paste into JWT_SECRET_KEY"
        echo ""
    else
        info "Secrets (SECRET_KEY / JWT_SECRET_KEY) look strong ✓"
    fi

    if [ "$HAS_PLACEHOLDER_APIS" = true ]; then
        warn "⚠️  Your .env contains placeholder API keys!"
        warn "   The app will work but AI features (voice, chat) will fail."
        echo ""
        echo -e "   ${BOLD}Get real keys from:${NC}"
        echo -e "   • GROQ_API_KEY:       ${YELLOW}https://console.groq.com/keys${NC}"
        echo -e "   • ELEVENLABS_API_KEY: ${YELLOW}https://elevenlabs.io/app/settings/api-keys${NC}"
        echo ""
    else
        info "API keys appear to be configured ✓"
    fi

    info ".env validation complete. File preserved."
else
    warn ".env NOT FOUND at project root. Creating from template..."

    if command_exists openssl; then
        GEN_SECRET_KEY=$(openssl rand -hex 64)
        GEN_JWT_SECRET=$(openssl rand -hex 64)
    else
        GEN_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(64))")
        GEN_JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(64))")
    fi

    cat > "$ENV_FILE" << EOF
# =============================================================================
# NeuroPattern LifeTracker — Environment Configuration
# Auto-generated by setup.sh on $(date)
# =============================================================================

# ── Application ──────────────────────────────────────────────────────────────
APP_NAME=NeuroPattern LifeTracker
APP_VERSION=1.1.0
ENVIRONMENT=development
LOG_LEVEL=INFO
DEBUG=1

# ── Server ───────────────────────────────────────────────────────────────────
HOST=0.0.0.0
PORT=8000

# ── MongoDB ──────────────────────────────────────────────────────────────────
MONGODB_URI=mongodb://localhost:27017/neuropattern
DB_HOST=localhost
DB_PORT=27017
DB_NAME=neuropattern
DB_USER=
DB_PASSWORD=

# ── Security (AUTO-GENERATED — do not share these keys) ─────────────────────
SECRET_KEY=${GEN_SECRET_KEY}
JWT_SECRET_KEY=${GEN_JWT_SECRET}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# ── AI Services (REQUIRED — replace with your real keys) ────────────────────
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=llama-3.3-70b-versatile
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=BpjGufoPiobT79j2vtj4
ELEVENLABS_MODEL_ID=eleven_multilingual_v2

# ── File Uploads ───────────────────────────────────────────────────────────
MAX_UPLOAD_SIZE=10485760
UPLOAD_DIR=backend/app/static/audio

# ── Email (Optional — needed for password reset) ─────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@neuropattern.ai

# ── URLs ─────────────────────────────────────────────────────────────────────
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000

# ── Frontend (Vite requires VITE_ prefix) ──────────────────────────────────
VITE_API_URL=http://localhost:8000/api/v1
VITE_FRONTEND_URL=http://localhost:3000

# ── CORS ─────────────────────────────────────────────────────────────────────
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
EOF

    info ".env created with secure random secrets ✓"
    warn "⚠️  YOU MUST EDIT .env and add your real API keys before using AI features:"
    warn "   • GROQ_API_KEY         → https://console.groq.com/keys"
    warn "   • ELEVENLABS_API_KEY   → https://elevenlabs.io/app/settings/api-keys"
fi

# ─── 6. Directory Structure ───────────────────────────────────────────────────
step "Creating Project Directories"

mkdir -p backend/app/static/audio
mkdir -p backend/app/static/assets
touch backend/app/static/audio/.gitkeep 2>/dev/null || true
touch backend/app/static/assets/.gitkeep 2>/dev/null || true
info "Static directories ready ✓"

# ─── 7. Summary ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║         NeuroPattern Setup Complete!                         ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BOLD}Start the app:${NC}"
if [ "$PKG_MANAGER" = "pnpm" ]; then
    echo -e "   ${GREEN}pnpm dev${NC}          # Both frontend + backend"
    echo -e "   ${GREEN}pnpm frontend${NC}     # Frontend only  → http://localhost:3000"
    echo -e "   ${GREEN}pnpm backend${NC}      # Backend only   → http://localhost:8000"
else
    echo -e "   ${GREEN}npm run dev${NC}       # Both frontend + backend"
    echo -e "   ${GREEN}npm run frontend${NC}  # Frontend only  → http://localhost:3000"
    echo -e "   ${GREEN}npm run backend${NC}   # Backend only   → http://localhost:8000"
fi
echo ""
echo -e "${BOLD}Services:${NC}"
echo -e "   • App:       http://localhost:3000"
echo -e "   • API Docs:  http://localhost:8000/docs"
echo -e "   • MongoDB:   localhost:27017 (must be running separately)"
echo ""
echo -e "${BOLD}Troubleshooting:${NC}"
echo -e "   • White screen?     → Check browser console for React errors"
echo -e "   • Port 3000 busy?  → lsof -i :3000  then kill the process"
echo -e "   • MongoDB not running? → mongod --dbpath /usr/local/var/mongodb"
echo -e "   • Reset everything → rm -rf node_modules venv && ./setup.sh"
echo ""
