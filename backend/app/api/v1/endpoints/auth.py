import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta

from app.api.core import security
from app.api.models.models import (
    ForgotPasswordRequest,
    ResetPasswordRequest,
    Token,
    TokenVerificationRequest,
    TokenVerificationResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.api.services.email_service import (
    send_password_reset_email,
    send_verification_email,
)
from app.database import get_db
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import JSONResponse, RedirectResponse
from pymongo.errors import DuplicateKeyError

logger = logging.getLogger(__name__)

router = APIRouter()


def _generate_reset_token() -> str:
    return secrets.token_urlsafe(32)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _ensure_utc_aware(dt):
    """Ensure datetime is UTC-aware. MongoDB may return naive datetimes."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


# ─── AUTH ENDPOINTS ───


@router.post("/register")
async def register(user_in: UserCreate, db=Depends(get_db)):
    normalized_email = _normalize_email(user_in.email)
    existing_user = await db.users.find_one({"email": normalized_email})
    if existing_user:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "error": "EMAIL_ALREADY_EXISTS",
                "message": "This email is already registered. Please sign in.",
            },
        )

    user_dict = {
        "email": normalized_email,
        "password_hash": security.get_password_hash(user_in.password),
        "full_name": user_in.full_name or None,
        "created_at": datetime.now(UTC),
        "updated_at": None,
        "avatar_url": None,
        "is_verified": False,
    }

    try:
        await db.users.insert_one(user_dict)
    except DuplicateKeyError:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "error": "EMAIL_ALREADY_EXISTS",
                "message": "This email is already registered. Please sign in.",
            },
        )

    # Generate verification token and store a hashed token for safety.
    v_token = _generate_reset_token()
    await db.email_verifications.insert_one(
        {
            "token_hash": _hash_token(v_token),
            "email": normalized_email,
            "expires_at": datetime.now(UTC) + timedelta(hours=24),
            "created_at": datetime.now(UTC),
        }
    )

    # Send verification email
    try:
        send_verification_email(
            to_email=normalized_email,
            token=v_token,
            user_name=user_in.full_name or "User",
        )
    except Exception as e:
        # Email failure should not block registration
        logger.debug(f"[Email] Verification email failed: {e}")

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "message": "Registration successful. Please check your email to verify your account."
        },
    )


@router.get("/verify-email")
async def verify_email(token: str, db=Depends(get_db)):
    """
    Verify user email via token.
    """
    token_hash = _hash_token(token)
    v_data = await db.email_verifications.find_one({"token_hash": token_hash})
    if not v_data or datetime.now(UTC) > _ensure_utc_aware(v_data["expires_at"]):
        return Response("Invalid or expired verification link", status_code=400)

    await db.users.update_one(
        {"email": v_data["email"]},
        {"$set": {"is_verified": True, "updated_at": datetime.now(UTC)}},
    )
    await db.email_verifications.delete_one({"token_hash": token_hash})

    return RedirectResponse(url=f"{security.settings.FRONTEND_URL}/#/auth?verified=true")


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db=Depends(get_db)):
    normalized_email = _normalize_email(credentials.email)
    logger.debug(f"[Login] Attempting login for email: {normalized_email}")
    user = await db.users.find_one({"email": normalized_email})

    if not user:
        logger.debug(f"[Login] User not found: {normalized_email}")
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "error": "EMAIL_NOT_FOUND",
                "message": "No account found with this email.",
            },
        )

    is_verified = user.get("is_verified", False)
    logger.debug(f"[Login] User found. is_verified: {is_verified}")

    if not is_verified:
        logger.debug(f"[Login] Email not verified for: {normalized_email}")
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={
                "error": "EMAIL_NOT_VERIFIED",
                "message": "Please verify your email before signing in.",
            },
        )

    password_valid = security.verify_password(credentials.password, user["password_hash"])
    logger.debug(f"[Login] Password valid: {password_valid}")

    if not password_valid:
        logger.debug(f"[Login] Invalid password for: {normalized_email}")
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={
                "error": "INVALID_CREDENTIALS",
                "message": "Incorrect email or password.",
            },
        )

    access_token = security.create_access_token(
        data={"sub": str(user["_id"])}, expires_delta=timedelta(minutes=60)
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(security.get_current_user)):
    return {
        "id": str(current_user["_id"]),
        "email": current_user["email"],
        "full_name": current_user.get("full_name", ""),
        "avatar_url": current_user.get("avatar_url"),
    }


# ─── PASSWORD RESET FLOW ───


@router.post("/forgot-password")
async def forgot_password(request_data: ForgotPasswordRequest, db=Depends(get_db)):
    """
    Initiate password reset. Returns explicit error if account doesn't exist.
    """
    email = _normalize_email(request_data.email)
    user = await db.users.find_one({"email": email})
    if not user:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "error": "EMAIL_NOT_FOUND",
                "message": "No account exists with this email.",
            },
        )

    # Generate token and store a hashed token with expiry
    token = _generate_reset_token()
    await db.password_resets.insert_one(
        {
            "token_hash": _hash_token(token),
            "user_id": str(user["_id"]),
            "email": email,
            "expires_at": datetime.now(UTC) + timedelta(minutes=30),
            "used": False,
            "created_at": datetime.now(UTC),
        }
    )

    email_sent = send_password_reset_email(
        to_email=email, reset_token=token, user_name=user.get("full_name", "User")
    )

    if not email_sent:
        await db.password_resets.delete_one({"token_hash": _hash_token(token)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send reset email. Please try again later.",
        )

    return {"message": "Password reset link sent to your email"}


@router.post("/verify-reset-token", response_model=TokenVerificationResponse)
async def verify_reset_token(data: TokenVerificationRequest, db=Depends(get_db)):
    """
    Verify if a reset token is valid.
    """
    token_hash = _hash_token(data.token)
    token_data = await db.password_resets.find_one({"token_hash": token_hash})
    if not token_data:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    if datetime.now(UTC) > _ensure_utc_aware(token_data["expires_at"]):
        raise HTTPException(status_code=400, detail="Token has expired")

    if token_data["used"]:
        raise HTTPException(status_code=400, detail="Token already used")

    if data.email and _normalize_email(data.email) != token_data["email"]:
        raise HTTPException(status_code=400, detail="Token does not match email")

    return {"valid": True, "email": token_data["email"]}


@router.post("/reset-password")
async def reset_password(request_data: ResetPasswordRequest, db=Depends(get_db)):
    """
    Reset password using a valid token.
    """
    token_hash = _hash_token(request_data.token)
    new_password = request_data.new_password
    email = _normalize_email(request_data.email)

    token_data = await db.password_resets.find_one({"token_hash": token_hash})
    if not token_data:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    if datetime.now(UTC) > _ensure_utc_aware(token_data["expires_at"]):
        raise HTTPException(status_code=400, detail="Token has expired")

    if token_data["used"]:
        raise HTTPException(status_code=400, detail="Token already used")

    if token_data["email"] != email:
        raise HTTPException(status_code=400, detail="Token does not match email")

    user_id = ObjectId(token_data["user_id"])
    new_hash = security.get_password_hash(new_password)

    await db.users.update_one(
        {"_id": user_id},
        {
            "$set": {
                "password_hash": new_hash,
                "is_verified": True,
                "updated_at": datetime.now(UTC),
            }
        },
    )

    await db.password_resets.update_one({"token_hash": token_hash}, {"$set": {"used": True}})

    return {"message": "Password reset successfully"}


@router.post("/update-password")
async def update_password(
    data: dict,
    current_user: dict = Depends(security.get_current_user),
    db=Depends(get_db),
):
    """
    Change password while logged in (requires current password).
    """
    current_password = data.get("current_password")
    new_password = data.get("new_password")

    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Current and new password required")

    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    # Verify current password
    if not security.verify_password(current_password, current_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    # Update to new password
    new_hash = security.get_password_hash(new_password)
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"password_hash": new_hash, "updated_at": datetime.now(UTC)}},
    )

    return {"message": "Password updated successfully"}


# ─── PROFILE & ACCOUNT MANAGEMENT ───


@router.post("/update-profile")
async def update_profile(
    data: dict,
    current_user: dict = Depends(security.get_current_user),
    db=Depends(get_db),
):
    """
    Update user profile fields.
    """
    update_fields: dict = {}

    if "full_name" in data:
        update_fields["full_name"] = data["full_name"]
    if "avatar_url" in data:
        update_fields["avatar_url"] = data["avatar_url"]
    if "email" in data and data["email"] != current_user["email"]:
        # Check email isn't taken
        existing = await db.users.find_one({"email": data["email"]})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        update_fields["email"] = data["email"]

    if not update_fields:
        return {"message": "No fields to update"}

    update_fields["updated_at"] = datetime.now(UTC)

    await db.users.update_one({"_id": current_user["_id"]}, {"$set": update_fields})

    return {"message": "Profile updated successfully"}


@router.delete("/delete-account")
async def delete_account(
    current_user: dict = Depends(security.get_current_user), db=Depends(get_db)
):
    """
    Permanently delete user account and all associated data.
    """
    user_id = current_user["_id"]

    # Delete all user data
    await db.logs.delete_many({"user_id": user_id})
    await db.habits.delete_many({"user_id": user_id})
    await db.users.delete_one({"_id": user_id})

    return {"message": "Account deleted successfully"}
