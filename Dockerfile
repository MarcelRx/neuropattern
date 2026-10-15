# =============================================================================
# NeuroPattern LifeTracker — Production Dockerfile
# =============================================================================

# ---------------------------------------------------------------------------
# STAGE 1: Frontend Build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY src/ ./src/
COPY vite.config.ts ./
RUN npm run build

# ---------------------------------------------------------------------------
# STAGE 2: Python Backend
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS backend

# Create non-root user WITH home directory
RUN groupadd -r neuropattern && useradd -r -m -g neuropattern -u 1000 appuser

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libffi-dev ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir gunicorn

COPY backend/ ./backend/
COPY --from=frontend-builder /app/dist ./static/

RUN mkdir -p static/audio && chown -R appuser:neuropattern /app

ENV HOME=/app
ENV PYTHONPATH=/app/backend

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["gunicorn", \
  "app.main:app", \
  "--workers", "4", \
  "--worker-class", "uvicorn.workers.UvicornWorker", \
  "--bind", "0.0.0.0:8000", \
  "--timeout", "120", \
  "--access-logfile", "-", \
  "--error-logfile", "-"]
