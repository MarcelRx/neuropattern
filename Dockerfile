# ---------------------------------------------------------
# Production Dockerfile for NeuroPattern LifeTracker API
# ---------------------------------------------------------

# Use a lightweight, official Python runtime
FROM python:3.11-slim

# Prevent Python from writing .pyc files to disk
ENV PYTHONDONTWRITEBYTECODE=1

# Prevent Python from buffering stdout/stderr (essential for real-time Cloud Logging)
ENV PYTHONUNBUFFERED=1

# Set the working directory inside the container
WORKDIR /app

# Install system dependencies required for compilation (e.g., PostgreSQL adapter)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements list first to utilize Docker's build caching layer
COPY requirements.txt .

# Upgrade pip and install all Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend source files
COPY . .

# Create the static audio directory if it doesn't exist
RUN mkdir -p static/audio

# Expose port 8000 (FastAPI default port)
EXPOSE 8000

# Run FastAPI with Uvicorn in production
# NOTE: Since your package.json references 'backend.main:app', we point to that entry point.
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]