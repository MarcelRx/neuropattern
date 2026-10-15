"""
Models Module

Contains Pydantic models for data validation and serialization.
"""

from datetime import datetime

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class PyObjectId(ObjectId):
    """Custom ObjectId validator for Pydantic."""

    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)


class UserDocument(BaseModel):
    """MongoDB user document model."""

    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    email: str
    password_hash: str
    full_name: str | None = None
    avatar_url: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime | None = None
    is_verified: bool = False

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


# ============== User Schemas ==============

class UserBase(BaseModel):
    """Base user schema."""
    email: EmailStr = Field(..., description="Valid email address")
    full_name: str | None = Field(None, min_length=2, max_length=100, alias="fullName")

    model_config = ConfigDict(
        populate_by_name=True,
        str_strip_whitespace=True,
        str_min_length=1
    )


class UserCreate(UserBase):
    """User registration schema."""
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")

    @field_validator('password')
    @classmethod
    def password_complexity(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if v.islower() or v.isdigit():
            # Optional: Add stronger regex check here
            pass
        return v


class UserLogin(BaseModel):
    """User login schema."""
    email: EmailStr = Field(..., description="User email")
    password: str = Field(..., min_length=1)

    model_config = ConfigDict(
        populate_by_name=True,
        str_strip_whitespace=True,
        str_min_length=1
    )


class UserResponse(UserBase):
    """User response schema."""
    id: str
    avatar_url: str | None = None


class Token(BaseModel):
    """JWT token response schema."""
    access_token: str
    token_type: str = "bearer"


# ============== Coach Schemas ==============

class ForgotPasswordRequest(BaseModel):
    """Schema for forgot password requests."""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Schema for resetting password with a token."""
    token: str
    new_password: str = Field(..., min_length=8, alias="newPassword")
    email: EmailStr

    model_config = ConfigDict(populate_by_name=True)


class TokenVerificationRequest(BaseModel):
    """Schema for reset token verification requests."""
    token: str
    email: EmailStr | None = None

    model_config = ConfigDict(populate_by_name=True)


class TokenVerificationResponse(BaseModel):
    """Response schema for reset token verification."""
    valid: bool
    email: EmailStr

    model_config = ConfigDict(populate_by_name=True)


class ChatRequest(BaseModel):
    """Chat request schema."""
    message: str
    context: dict | None = None
    language: str | None = None
    generateVoice: bool = False


class EmotionalTone(BaseModel):
    """Emotional tone analysis schema."""
    arousal: float = Field(default=0.5, ge=0.0, le=1.0)
    valence: float = Field(default=0.5, ge=0.0, le=1.0)


class ToneFeatures(BaseModel):
    """Voice tone features schema."""
    energy_variance: float | None = Field(default=None, ge=0.0, le=1.0)
    pitch_trend: str | None = Field(default="stable", pattern="^(rising|falling|stable)$")
    speech_rate: float | None = Field(default=None, ge=0.0)
    emotional_tone: EmotionalTone | None = None


class QualityReport(BaseModel):
    """Audio quality report schema."""
    averageVolume: float = Field(default=0.5, ge=0.0, le=1.0)
    peakVolume: float = Field(default=0.5, ge=0.0, le=1.0)
    silenceRatio: float = Field(default=0.1, ge=0.0, le=1.0)
    duration: float = Field(default=0.0, ge=0.0)
    isClear: bool = Field(default=True)
    issues: list[str] = Field(default_factory=list)
    energyVariance: float | None = Field(default=None, ge=0.0, le=1.0)
    pitchTrend: str | None = Field(default="stable", pattern="^(rising|falling|stable)$")
    speechRate: float | None = Field(default=None, ge=0.0)
    emotionalTone: EmotionalTone | None = None


# ============== Habit Schemas ==============

class HabitResponse(BaseModel):
    """Habit response schema."""
    id: str
    name: str
    icon: str
    goal: int
    color: str
    history: list[bool]
    currentValue: int
    progress: int


# ============== Log Schemas ==============

class LogBase(BaseModel):
    """Base log schema."""
    score: int = Field(..., ge=0, le=100)
    mood: str
    summary: str
    sentiment: str | None = None


class LogCreate(LogBase):
    """Log creation schema."""


class LogResponse(LogBase):
    """Log response schema."""
    id: str
    timestamp: str | None = None
    user_id: str | None = None


# ============== Analysis Schemas ==============

class MentalHealthAnalysis(BaseModel):
    """Mental health analysis result schema."""
    score: int = Field(..., ge=0, le=100)
    mood: str
    summary: str
    sentiment: str
    emotional_indicators: list[str] = Field(default_factory=list)
    tone_analysis: str = ""


class VoiceProcessResult(BaseModel):
    """Voice processing result schema."""
    transcription: str
    confidence: float
    isClear: bool
    qualityIssues: list[str]
    suggestedAction: str | None = None
    duration: float
    toneFeatures: ToneFeatures | None = None
    analysis: MentalHealthAnalysis
