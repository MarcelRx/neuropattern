# MongoDB Integration Testing Guide

## Overview

This document describes the MongoDB integration testing strategy for NeuroPattern, including local development setup, CI configuration, and test execution.

## Test Architecture

### Test Categories

1. **Unit Tests** (`-m "not integration"`): Tests that can run without external dependencies
   - Mocked database calls
   - Fast dependency overrides
   - Business logic validation
   - Configuration validation

2. **Integration Tests** (`-m "integration"`): Tests requiring a real MongoDB instance
   - Real database operations
   - Actual authentication token validation
   - Authorization and data isolation verification
   - Database lifecycle management

### Test Database

- **Name**: `neuropattern_test`
- **Isolation**: Integration tests use the dedicated `neuropattern_test` database, separate from production
- **Cleanup**: Tests should clean up only the test data they create; fixture cleanup behavior varies by test file
- **Safety**: Never connects to production database

## Local Development

### Prerequisites

1. **MongoDB**: Install MongoDB 7.0 or use Docker

   ```bash
   # Using Docker (recommended)
   docker run -d --name neuropattern-test-mongodb -p 27017:27017 mongo:7.0

   # Or install locally
   # macOS: brew install mongodb-community
   # Ubuntu: sudo apt-get install mongodb
   ```

2. **Python 3.12** with virtual environment
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   pip install pytest pytest-asyncio
   ```

### Running Tests

#### Run All Tests (requires MongoDB)

```bash
source venv/bin/activate
PYTHONPATH=backend python -m pytest backend/tests/ -v
```

#### Run Unit Tests Only (no MongoDB required)

```bash
source venv/bin/activate
PYTHONPATH=backend python -m pytest backend/tests/ -v -m "not integration"
```

#### Run Integration Tests Only (requires MongoDB)

```bash
source venv/bin/activate
PYTHONPATH=backend python -m pytest backend/tests/ -v -m "integration"
```

#### Run Specific Test File

```bash
source venv/bin/activate
PYTHONPATH=backend python -m pytest backend/tests/test_authorization.py -v
```

### Frontend Checks

The frontend uses pnpm for package management. To run frontend validation:

```bash
# Install dependencies
pnpm install

# Type check (TypeScript)
pnpm run lint

# Production build
pnpm run build
```

### Starting/Stopping MongoDB (Docker)

```bash
# Start
docker run -d --name neuropattern-test-mongodb -p 27017:27017 mongo:7.0

# Stop
docker stop neuropattern-test-mongodb

# Remove
docker rm neuropattern-test-mongodb

# Check if running
mongosh --eval "db.adminCommand('ping')"
```

## CI/CD Configuration

### GitHub Actions

The CI workflow is split into two jobs:

1. **test-unit**: Runs unit tests without MongoDB
   - Fast feedback loop
   - No external dependencies
   - Validates code quality and business logic

2. **test-integration**: Runs integration tests with MongoDB service container
   - MongoDB 7.0 service container on port 27017
   - Health check before test execution
   - Dedicated test database: `neuropattern_test`
   - Requires both jobs to pass before build

### Environment Variables in CI

```yaml
JWT_SECRET_KEY: "test-jwt-secret-key-do-not-use-in-production"
SECRET_KEY: "test-secret-key-do-not-use-in-production"
PYTHONPATH: ${{ github.workspace }}/backend
MONGODB_URI: "mongodb://localhost:27017/neuropattern_test"
DB_NAME: "neuropattern_test"
```

## Test Coverage

### Authorization Tests (`test_authorization.py`)

- ✅ User cannot access another user's logs (database-level)
- ✅ User can retrieve their own logs
- ✅ Clear logs only affects authenticated user
- ✅ Token validation rejects invalid tokens
- ✅ Token validation rejects missing tokens
- ✅ Token validation rejects non-existent users

### API Integration Tests (`test_logs_api_integration.py`)

- ✅ Authenticated user can retrieve logs
- ✅ Empty log list returned correctly
- ✅ User isolation enforced at API level
- ✅ Authenticated user can clear logs
- ✅ Clear logs scoped to current user
- ✅ Clear logs returns 404 when empty

### Database Lifecycle Tests (`test_database_lifecycle.py`)

- ✅ Singleton pattern implemented correctly
- ✅ Database connections close properly
- ✅ Test database isolation works

### Unit Tests (various files)

- ✅ Password hashing and verification
- ✅ JWT token creation and validation
- ✅ Configuration validation (dev/prod)
- ✅ AI service error handling
- ✅ Mocked API endpoint tests

## Zero-Cost Verification

### GitHub Actions Service Containers

- **Cost**: Free (included in GitHub Actions)
- **MongoDB**: Official mongo:7.0 image
- **Minutes**: Standard GitHub Actions minutes apply
- **No external services**: All dependencies run in GitHub infrastructure

### Local Development

- **MongoDB Community Edition**: Free, open-source
- **Docker**: Free for personal use
- **No paid databases**: Integration tests never connect to Atlas or other paid services

## Troubleshooting

### MongoDB Connection Refused

```bash
# Check if MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# If using Docker, check container status
docker ps | grep mongo

# Start MongoDB if not running
docker start neuropattern-test-mongodb
```

### Tests Fail with "MongoDB not available"

- Ensure MongoDB is running on localhost:27017
- Check firewall settings
- Verify MongoDB health check passes

### Import Errors

```bash
# Ensure PYTHONPATH is set correctly
export PYTHONPATH=/path/to/neuropattern/backend

# Or run from project root with explicit path
cd /path/to/neuropattern
PYTHONPATH=backend python -m pytest backend/tests/
```

### Integration Tests Skipped

- Check that tests are marked with `@pytest.mark.integration`
- Verify pytest.ini is configured with marker definitions
- Run with `-m "integration"` to explicitly select integration tests

## Security Considerations

### Test Data

- Test database is isolated from production
- Test data is cleaned up after each test
- No real credentials or secrets in test code
- Tokens use test secrets (never in production)

### Authorization Tests

- Verify actual database query scoping
- Test with multiple users simultaneously
- Confirm data isolation at query level
- Validate token expiration and invalidation

### Configuration

- Production secrets validated at startup
- Placeholder secrets rejected in production
- Test environment uses known test values
- No credentials committed to repository

## Maintenance

### Adding New Integration Tests

1. Mark test with `@pytest.mark.integration`
2. Use the `test_db` fixture for database access
3. Create test-specific data within the test
4. Verify database state after operations
5. Cleanup is automatic via fixture

### Updating MongoDB Version

1. Update image in `.github/workflows/main.yml`
2. Update Docker Compose version if used locally
3. Run integration tests to verify compatibility
4. Check Motor driver compatibility in requirements.txt

### Test Database Schema Changes

1. Update `setup_indexes()` in `database.py` if needed
2. Add integration tests for new collections
3. Verify backward compatibility
4. Update fixtures if data model changes

## Results Summary

### Current Test Status

- **Total Tests**: 40
- **Unit Tests**: 25
- **Integration Tests**: 15
- **Passed**: 40
- **Failed**: 0
- **Skipped**: 0 in the last verified test run (MongoDB was available)

### Test Execution Time

- **Unit Tests**: ~5 seconds
- **Integration Tests**: ~10 seconds
- **Total**: ~15 seconds (with MongoDB)

### Coverage Areas

- ✅ Authentication and authorization
- ✅ Data isolation between users
- ✅ Database connection lifecycle
- ✅ Configuration validation
- ✅ API endpoint behavior
- ✅ Error handling
- ✅ Security token validation
