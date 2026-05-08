# Use Python 3.11 slim for a smaller image size
FROM python:3.11-slim

# Set environment variables for better logging and behavior
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set the working directory
WORKDIR /app

# Install system dependencies required for PostgreSQL (libpq) and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the entire project source code
COPY . .

# Create necessary directories for runtime
RUN mkdir -p static/audio

# Inform Azure that the app listens on port 8000
EXPOSE 8000

# Run the FastAPI application
# Note: Ensure the path 'backend.main:app' matches your file structure
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]