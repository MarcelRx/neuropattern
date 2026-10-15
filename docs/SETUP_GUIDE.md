# Setup and Debug Guide

## ElevenLabs API Key Permissions

Best set up on ElevenLabs_API_Key to this project:
https://api.elevenlabs.io/

Required permissions:
- Text to Speech: Access
- Speech to Text: Access
- Speech to Speech: Access
- Voice: Read
- Models: Access
- User: Read
- History: Read

Everything else: ❌ No Access

## pnpm Configuration

The project uses `pnpm-workspace.yaml` with the following configuration:
```yaml
allowBuilds:
  esbuild: true
```

This is required for pnpm v9+ to allow esbuild build scripts.

## MongoDB Docker Setup

Set these in docker-compose.yml or as environment variables when using Docker:
```bash
MONGO_INITDB_ROOT_USERNAME=your_root_user
MONGO_INITDB_ROOT_PASSWORD=your_root_password
MONGO_APP_USER=your_app_user
MONGO_APP_PASSWORD=your_app_password
```

## Docker Compose Debug Commands

### Stop everything and wipe MongoDB volume
Note: The init script only runs on a fresh volume.
```bash
docker-compose down -v
```

### Rebuild backend with no cache
```bash
docker-compose build --no-cache backend
```

### Start services
```bash
docker-compose up
```

### Debug backend startup
If the backend still fails, run this debug command to see the first error (not the repeated ones):
```bash
docker-compose up backend 2>&1 | head -100
```

### Test database connection
Or test the import chain directly:
```bash
docker run --rm -it \
  -e MONGODB_URI="mongodb://your_user:your_password@mongodb:27017/neuropattern?authSource=neuropattern" \
  -e PYTHONPATH=/app/backend \
  --network neuropattern_neuropattern-network \
  neuropattern-backend \
  python -c "import sys; print('Python OK'); from app.database import get_db; print('database OK'); db = get_db(); print('db OK:', db.name)"
```
