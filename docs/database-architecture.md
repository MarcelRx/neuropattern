# Database Architecture

## Database Engine and Verified Version

NeuroPattern uses MongoDB as its primary database.

**Database:** MongoDB 7.0+
**Driver:** Motor 3.4.0+ (async MongoDB driver for Python)
**Compatibility:** Compatible with MongoDB 4.4+ and Python 3.11+

## Connection Configuration and Lifecycle

### Connection Manager

The database connection is managed by a singleton `DatabaseManager` class in `backend/app/database.py`.

**Key Features:**
- Singleton pattern ensures single connection pool
- Async Motor driver for non-blocking operations
- Automatic connection initialization on first use
- Graceful connection closing on shutdown

### URI Building

Connection URI is built with the following priority:

1. **Full URI (Priority 1):** `MONGODB_URI` environment variable
   - Example: `mongodb://user:password@host:port/dbname?authSource=dbname`

2. **Component-based (Priority 2):** Individual environment variables
   - `DB_HOST`: Database host (default: `mongodb`)
   - `DB_PORT`: Database port (default: `27017`)
   - `DB_NAME`: Database name (default: `neuropattern`)
   - `DB_USER`: Database username (optional)
   - `DB_PASSWORD`: Database password (optional)

**Auth-enabled URI:**
```
mongodb://user:password@host:port/dbname?authSource=dbname
```

**No-auth URI:**
```
mongodb://host:port/dbname
```

### Connection Lifecycle

1. **Application Startup:**
   - FastAPI lifespan manager calls `DatabaseManager.setup_indexes()`
   - `setup_indexes()` calls `get_db()` which triggers connection
   - Motor client created and cached
   - Indexes created

2. **Request Handling:**
   - Each route handler uses `Depends(get_db)` to get database instance
   - Same connection reused across requests (connection pooling)
   - Async operations do not block event loop

3. **Application Shutdown:**
   - FastAPI lifespan manager calls `close_db()`
   - Motor client closed
   - Connections released

### Connection Pooling

Motor handles connection pooling automatically:
- Default pool size: 100 connections
- Max idle time: 10 minutes
- Automatic connection reuse
- No manual pool management required

## Actual Collections, Tables, Models, or Document Structures

### Collections

MongoDB uses collections (analogous to tables in relational databases). NeuroPattern has the following collections:

#### `users`

Stores user account information.

**Document Structure:**
```javascript
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "email": "user@example.com",
  "password_hash": "$2b$12$hashedPasswordString",
  "full_name": "John Doe",
  "avatar_url": "https://example.com/avatar.jpg",
  "created_at": ISODate("2024-01-15T10:30:00Z"),
  "updated_at": ISODate("2024-01-20T15:45:00Z"),
  "is_verified": true
}
```

**Important Fields:**
- `_id`: Unique ObjectId (primary key)
- `email`: User email (unique, indexed)
- `password_hash`: Bcrypt-hashed password
- `full_name`: User's display name (optional)
- `avatar_url`: Profile picture URL (optional)
- `created_at`: Account creation timestamp
- `updated_at`: Last profile update timestamp (optional)
- `is_verified`: Email verification status

#### `logs`

Stores wellness check-in logs.

**Document Structure:**
```javascript
{
  "_id": ObjectId("507f1f77bcf86cd799439012"),
  "user_id": ObjectId("507f1f77bcf86cd799439011"),
  "score": 75,
  "mood": "Good",
  "summary": "Had a productive day",
  "sentiment": "positive",
  "timestamp": ISODate("2024-01-15T10:30:00Z")
}
```

**Important Fields:**
- `_id`: Unique ObjectId (primary key)
- `user_id`: Reference to user document (indexed with timestamp)
- `score`: Wellness score (0-100)
- `mood`: Mood label (e.g., "Good", "Sad", "Stressed")
- `summary`: Brief description of check-in
- `sentiment`: Sentiment analysis result (optional)
- `timestamp`: Check-in timestamp (indexed with user_id)

#### `habits`

Stores habit definitions and completion history.

**Document Structure:**
```javascript
{
  "_id": ObjectId("507f1f77bcf86cd799439013"),
  "user_id": ObjectId("507f1f77bcf86cd799439011"),
  "name": "Exercise",
  "icon": "🏃",
  "goal": 7,
  "color": "#4CAF50",
  "history": [true, true, false, true, true, false, true]
}
```

**Important Fields:**
- `_id`: Unique ObjectId (primary key)
- `user_id`: Reference to user document
- `name`: Habit name
- `icon`: Emoji icon for habit
- `goal`: Target completion count (e.g., 7 days per week)
- `color`: Hex color code for UI
- `history`: Array of booleans representing daily completion (most recent last)

#### `email_verifications`

Stores email verification tokens.

**Document Structure:**
```javascript
{
  "_id": ObjectId("507f1f77bcf86cd799439014"),
  "token_hash": "sha256HashOfToken",
  "email": "user@example.com",
  "expires_at": ISODate("2024-01-16T10:30:00Z"),
  "created_at": ISODate("2024-01-15T10:30:00Z")
}
```

**Important Fields:**
- `_id`: Unique ObjectId (primary key)
- `token_hash`: SHA-256 hash of verification token (unique, indexed with TTL)
- `email`: User email to verify
- `expires_at`: Token expiration timestamp (TTL index auto-deletes expired documents)
- `created_at`: Token creation timestamp

#### `password_resets`

Stores password reset tokens.

**Document Structure:**
```javascript
{
  "_id": ObjectId("507f1f77bcf86cd799439015"),
  "token_hash": "sha256HashOfToken",
  "user_id": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "expires_at": ISODate("2024-01-15T11:00:00Z"),
  "used": false,
  "created_at": ISODate("2024-01-15T10:30:00Z")
}
```

**Important Fields:**
- `_id`: Unique ObjectId (primary key)
- `token_hash`: SHA-256 hash of reset token (unique, indexed with TTL)
- `user_id`: Reference to user document (stored as string)
- `email`: User email for verification
- `expires_at`: Token expiration timestamp (TTL index auto-deletes expired documents)
- `used`: Flag indicating if token has been used
- `created_at`: Token creation timestamp

## Important Fields and Their Purposes

### Common Fields

**ObjectId (`_id`):**
- MongoDB's primary key type
- 12-byte unique identifier
- Auto-generated on document creation
- Used for foreign key references

**Timestamp Fields:**
- Stored as ISODate objects
- UTC timezone
- Used for sorting and TTL indexes

### User-specific Fields

**Email:**
- Normalized to lowercase
- Unique constraint enforced
- Used for login and verification

**Password Hash:**
- Bcrypt hashed with 12 rounds
- Never store plain text passwords
- Salt automatically managed by bcrypt

**Verification Status:**
- `is_verified`: Boolean flag
- Prevents login if false
- Set to true after email verification

### Log-specific Fields

**Score:**
- Integer 0-100
- Calculated by AI analysis
- Used for wellness tracking

**Mood:**
- String label (e.g., "Happy", "Sad", "Stressed")
- Determined by AI emotion analysis
- Used for pattern analysis

**Sentiment:**
- String (e.g., "positive", "negative", "neutral")
- Optional field
- Used for sentiment analysis

### Habit-specific Fields

**History Array:**
- Array of booleans
- Each element represents one day
- Most recent day is last element
- Used for progress calculation

**Goal:**
- Integer target (e.g., 7 for weekly habits)
- Used for progress percentage calculation

## Relationships and References

### Reference Pattern

MongoDB uses manual references (not foreign keys like relational databases):

**User-to-Logs:**
- `logs.user_id` references `users._id`
- One-to-many relationship (one user, many logs)
- No cascade delete (manual cleanup required)

**User-to-Habits:**
- `habits.user_id` references `users._id`
- One-to-many relationship (one user, many habits)
- No cascade delete (manual cleanup required)

### Relationship Enforcement

- No foreign key constraints (MongoDB doesn't support them)
- Application-level enforcement in route handlers
- Indexes on `user_id` for query performance
- Manual cleanup on account deletion

### Cascade Behavior

**Account Deletion:**
When a user deletes their account, the application manually deletes:
- All logs: `db.logs.delete_many({"user_id": user_id})`
- All habits: `db.habits.delete_many({"user_id": user_id})`
- User document: `db.users.delete_one({"_id": user_id})`

This is implemented in the `/auth/delete-account` endpoint.

## Indexes and Uniqueness Constraints

### Created Indexes

Indexes are created automatically on application startup in `DatabaseManager.setup_indexes()`:

#### `users` Collection

**Unique Index on `email`:**
```python
await db.users.create_index("email", unique=True)
```
- Purpose: Ensure email uniqueness
- Prevents duplicate email registrations
- Speeds up login queries

#### `email_verifications` Collection

**Unique Index on `token_hash`:**
```python
await db.email_verifications.create_index("token_hash", unique=True)
```
- Purpose: Ensure token uniqueness
- Prevents token reuse

**TTL Index on `expires_at`:**
```python
await db.email_verifications.create_index("expires_at", expireAfterSeconds=0)
```
- Purpose: Auto-delete expired tokens
- `expireAfterSeconds=0` deletes immediately after expiration
- Reduces collection size

#### `password_resets` Collection

**Unique Index on `token_hash`:**
```python
await db.password_resets.create_index("token_hash", unique=True)
```
- Purpose: Ensure token uniqueness
- Prevents token reuse

**TTL Index on `expires_at`:**
```python
await db.password_resets.create_index("expires_at", expireAfterSeconds=0)
```
- Purpose: Auto-delete expired tokens
- Reduces collection size

#### `logs` Collection

**Compound Index on `user_id` and `timestamp`:**
```python
await db.logs.create_index([("user_id", 1), ("timestamp", -1)])
```
- Purpose: Efficient user log queries sorted by time
- `user_id` ascending for user filtering
- `timestamp` descending for newest-first sorting
- Critical for log list performance

### Index Performance

- All indexes are created in the background
- No write blocking during index creation
- Indexes persist across application restarts
- Index creation is idempotent (safe to run multiple times)

## Data Validation and Persistence Behavior

### Validation Layers

**1. Pydantic Models (Backend):**
- Request body validation before database operations
- Type coercion and constraint enforcement
- Custom validators for complex logic

**2. MongoDB Schema Validation:**
- Not currently implemented
- MongoDB allows schema-less documents
- Application enforces schema via Pydantic

**3. Application Logic:**
- Manual validation in route handlers
- Business rule enforcement
- Data consistency checks

### Persistence Behavior

**Write Operations:**
- All writes use async Motor methods
- No explicit transactions (single-document atomicity)
- Write concerns not explicitly configured (default)

**Read Operations:**
- All reads use async Motor methods
- No read concern configuration (default)
- No read preference configuration (primary)

**Consistency:**
- Strong consistency for single-document operations
- Eventual consistency for replica sets (not currently used)
- No multi-document transactions

## Initialization and Migration Procedures

### Database Initialization

**Automatic Index Creation:**
- Indexes created on application startup
- Handled by `DatabaseManager.setup_indexes()`
- Called in FastAPI lifespan manager
- Safe to run multiple times (idempotent)

**No Schema Migrations:**
- MongoDB is schema-less
- No migration system implemented
- Schema changes handled by application code
- Backward compatibility maintained

### Collection Creation

**Automatic Creation:**
- Collections created on first write
- No explicit collection creation required
- MongoDB auto-creates collections

**Initial Data:**
- No seed data or initial data loading
- Database starts empty
- Data created by user actions

### Docker Initialization

**MongoDB Init Script:**
- `mongo-init.js` runs on first database creation
- Creates application user if credentials provided
- Configured in `docker-compose.yml`

**Script Location:**
- File: `mongo-init.js`
- Mounted as: `/docker-entrypoint-initdb.d/mongo-init.js`
- Runs only on fresh volume

**Script Content:**
```javascript
db = db.getSiblingDB("neuropattern");

if (typeof MONGO_APP_USER !== "undefined" &&
    typeof MONGO_APP_PASSWORD !== "undefined") {
  db.createUser({
    user: MONGO_APP_USER,
    pwd: MONGO_APP_PASSWORD,
    roles: [{ role: "readWrite", db: "neuropattern" }],
  });
}
```

## Database Authentication and Access Controls

### Authentication Methods

**1. No Authentication (Local Development):**
- URI: `mongodb://localhost:27017/neuropattern`
- No username or password
- Suitable for local development only

**2. Username/Password Authentication:**
- URI: `mongodb://user:password@host:port/dbname?authSource=dbname`
- Credentials in environment variables
- Suitable for production

**3. MongoDB Atlas:**
- URI: `mongodb+srv://user:password@cluster.mongodb.net/dbname`
- Connection string from Atlas dashboard
- Suitable for cloud deployment

### User Roles

**Application User:**
- Role: `readWrite` on `neuropattern` database
- Created by `mongo-init.js` if credentials provided
- Full read/write access to application data

**Root User (Docker):**
- Role: `root` on `admin` database
- Created by Docker image
- Used for database initialization only
- Not used by application

### Access Control

**Application-Level:**
- All database access through application
- No direct database access for users
- Authentication required for all operations
- User isolation via `user_id` field

**Network-Level:**
- MongoDB default port: 27017
- Firewall configuration recommended for production
- VPN or private network for production deployments

## Backup, Retention, and Recovery Mechanisms

### Current Implementation

**No Automated Backups:**
- No backup mechanism implemented
- No scheduled backups
- No backup retention policy

**Manual Backup Options:**

**mongodump:**
```bash
mongodump --uri="mongodb://user:password@host:port/dbname" --out=/backup/path
```

**MongoDB Atlas Backups:**
- Automated backups available with Atlas
- Point-in-time recovery
- Continuous backups

### Retention

**Data Retention:**
- User data retained indefinitely
- No automatic data deletion
- Token collections auto-delete via TTL

**Token TTL:**
- Email verification tokens: 24 hours
- Password reset tokens: 30 minutes
- Auto-deleted by MongoDB TTL index

### Recovery

**No Recovery Procedures:**
- No disaster recovery plan documented
- No restore procedures tested
- Manual restore using mongorestore

**mongorestore:**
```bash
mongorestore --uri="mongodb://user:password@host:port/dbname" /backup/path
```

## Test Strategy and Known Database Limitations

### Test Strategy

**Current Testing:**
- No database-specific tests
- Integration tests not implemented
- Tests use real database connection (in CI)

**Test Database:**
- CI uses test secrets (not production)
- No separate test database configured
- Tests run against development database

**Recommended Improvements:**
1. Use separate test database
2. Mock database for unit tests
3. Test database connection failures
4. Test index creation
5. Test transaction behavior

### Known Limitations

**1. No Schema Validation:**
- MongoDB allows any document structure
- Application must enforce schema
- Risk of data inconsistency

**2. No Transactions:**
- No multi-document transactions
- Risk of partial updates
- Manual rollback required

**3. No Backup Automation:**
- No automated backups
- Risk of data loss
- Manual backup responsibility

**4. No Read Concern/Write Concern:**
- Default MongoDB settings
- May not be suitable for all use cases
- Not tuned for consistency or performance

**5. Manual Cascade Deletes:**
- Account deletion requires manual cleanup
- Risk of orphaned documents if cleanup fails
- No atomic multi-document delete

**6. No Data Retention Policy:**
- User data retained indefinitely
- No automatic archival or deletion
- Potential GDPR compliance issues

**7. No Encryption at Rest:**
- MongoDB encryption not configured
- Relies on disk encryption
- Consider MongoDB Atlas encryption

### Recommended Improvements

**High Priority:**
1. Implement automated backups (mongodump or Atlas)
2. Add schema validation with MongoDB validator
3. Implement multi-document transactions
4. Add data retention policy
5. Configure encryption at rest

**Medium Priority:**
6. Add monitoring for database performance
7. Implement read/write concern tuning
8. Add database metrics collection
9. Test backup and restore procedures

**Low Priority:**
10. Implement data archiving for old logs
11. Add database sharding for scalability
12. Implement change streams for real-time updates
