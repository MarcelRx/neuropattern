"""
Security Module

Handles password hashing, JWT token creation/validation,
and user authentication dependencies.
"""

import logging
from datetime import UTC, datetime, timedelta

from app.api.core.config import settings
from app.database import get_db
from bson import ObjectId
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pymongo.errors import PyMongoError

logger = logging.getLogger(__name__)


# Password hashing context using bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme for token URL
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


class SecurityManager:
    """Manages all security-related operations."""

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a plain password against a hashed password."""
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def get_password_hash(password: str) -> str:
        """Hash a plain password."""
        return pwd_context.hash(password)

    @classmethod
    def create_access_token(cls, data: dict, expires_delta: timedelta | None = None) -> str:
        """Create a JWT access token."""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.now(UTC) + expires_delta
        else:
            expire = datetime.now(UTC) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt

    @classmethod
    async def get_current_user(
        cls,
        request: Request,
        token: str | None = Depends(oauth2_scheme),
        db=Depends(get_db),
    ) -> dict:
        """
        Extract and validate JWT token from Authorization header.
        Returns the current user document from database.
        """
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

        # Debug logging
        auth_header = request.headers.get("authorization", "")
        if auth_header:
            logger.debug("[Auth] Authorization header present")
        else:
            logger.debug("[Auth] No Authorization header")

        # Manual extraction fallback
        if not token and auth_header.startswith("Bearer "):
            token = auth_header[7:]

        if not token:
            logger.debug("[Auth] No token found")
            raise credentials_exception

        try:
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.ALGORITHM])
            user_id: str = payload.get("sub")
            if user_id is None:
                raise credentials_exception

            # Check expiration
            exp = payload.get("exp")
            if exp and datetime.now(UTC).timestamp() > exp:
                raise credentials_exception

        except JWTError as e:
            logger.debug(f"[Auth] JWT error: {e}")
            raise credentials_exception

        # Fetch user from database
        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)})
        except (PyMongoError, ValueError) as e:
            logger.debug(f"[Auth] DB error: {e}")
            raise credentials_exception from e

        if user is None:
            logger.debug(f"[Auth] User not found: {user_id}")
            raise credentials_exception

        logger.debug(f"[Auth] Authenticated: {user.get('email')}")
        return user

    @classmethod
    async def get_current_user_optional(
        cls,
        request: Request,
        token: str | None = Depends(oauth2_scheme),
        db=Depends(get_db),
    ) -> dict | None:
        """Optional auth - returns None if no valid token."""
        try:
            return await cls.get_current_user(request, token, db)
        except HTTPException:
            return None


# Convenience functions for backward compatibility
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return SecurityManager.verify_password(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return SecurityManager.get_password_hash(password)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    return SecurityManager.create_access_token(data, expires_delta)


async def get_current_user(
    request: Request, token: str | None = Depends(oauth2_scheme), db=Depends(get_db)
):
    return await SecurityManager.get_current_user(request, token, db)


async def get_current_user_optional(
    request: Request, token: str | None = Depends(oauth2_scheme), db=Depends(get_db)
):
    return await SecurityManager.get_current_user_optional(request, token, db)
