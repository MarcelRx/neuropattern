"""
Database Module

Manages MongoDB connection using Motor (async MongoDB driver).
Implements singleton pattern for database client.
"""

import logging
import os
from typing import Any, Optional

try:
    from motor.motor_asyncio import AsyncIOMotorClient
except ImportError as e:
    raise ImportError(f"motor is not installed. Run: pip install motor. Error: {e}")

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Singleton database manager for MongoDB connections."""

    _instance: Optional["DatabaseManager"] = None
    _client: Any | None = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    def _build_uri(cls) -> str:
        """Build MongoDB URI from environment variables.

        Priority:
        1. Full MONGODB_URI (explicit connection string)
        2. Application credentials (DB_USER/DB_PASSWORD)
        3. No auth (local development only)
        """
        # Check for full URI first (Docker Compose sets MONGODB_URI)
        uri = os.getenv("MONGODB_URI", "")
        if uri:
            return uri

        # Build from components
        host = os.getenv("DB_HOST", "mongodb")
        port = os.getenv("DB_PORT", "27017")
        db_name = os.getenv("DB_NAME", "neuropattern")
        user = os.getenv("DB_USER", "")
        password = os.getenv("DB_PASSWORD", "")

        if user and password:
            # Auth-enabled connection — authSource MUST match the DB where user was created
            # For application user (least-privilege), authSource should be the database name
            return f"mongodb://{user}:{password}@{host}:{port}/{db_name}?authSource={db_name}"
        else:
            # No auth (local dev) - WARNING: Not suitable for production
            logger.warning(
                "Connecting to MongoDB without authentication. "
                "This is not recommended for production deployments."
            )
            return f"mongodb://{host}:{port}/{db_name}"

    @classmethod
    def get_client(cls) -> AsyncIOMotorClient:
        """Get or create MongoDB client."""
        if cls._client is None:
            uri = cls._build_uri()
            # Log URI with password masked for security
            safe_uri = uri
            if os.getenv("DB_PASSWORD") and os.getenv("DB_PASSWORD") in uri:
                safe_uri = uri.replace(os.getenv("DB_PASSWORD", ""), "***")
            logger.info(f"Connecting to MongoDB: {safe_uri}")
            cls._client = AsyncIOMotorClient(uri)
        if cls._client is None:
            raise RuntimeError("Database client failed to initialize")
        return cls._client

    @classmethod
    def get_db(cls):
        """Get database instance."""
        client = cls.get_client()
        db_name = os.getenv("DB_NAME", "neuropattern")
        return client[db_name]

    @classmethod
    async def close_connection(cls):
        """Close database connection."""
        if cls._client:
            cls._client.close()
            cls._client = None

    @classmethod
    async def setup_indexes(cls):
        """Create required database indexes."""
        db = cls.get_db()

        # Users collection indexes
        await db.users.create_index("email", unique=True)

        # Email verification and password reset token indexes
        await db.email_verifications.create_index("token_hash", unique=True)
        await db.email_verifications.create_index("expires_at", expireAfterSeconds=0)
        await db.password_resets.create_index("token_hash", unique=True)
        await db.password_resets.create_index("expires_at", expireAfterSeconds=0)

        # Logs collection indexes
        await db.logs.create_index([("user_id", 1), ("timestamp", -1)])

        logger.info("[Database] Indexes created successfully")


# ============================================================================
# MODULE-LEVEL EXPORTS — These MUST be defined for other modules to import
# ============================================================================


def get_db():
    """Get database instance. Used by FastAPI Depends."""
    return DatabaseManager.get_db()


async def close_db():
    """Close database connection."""
    await DatabaseManager.close_connection()
