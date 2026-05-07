from sqlalchemy import Column, String, Integer, ForeignKey, JSON, DateTime, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import sys
from pathlib import Path

# Add parent directory to path for absolute imports
sys.path.insert(0, str(Path(__file__).parent))

from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    avatar_url = Column(String, default="https://picsum.photos/100/100")

class Log(Base):
    __tablename__ = "logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    score = Column(Integer)
    mood = Column(String)
    summary = Column(String)
    sentiment = Column(String)

class Habit(Base):
    __tablename__ = "habits"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    name = Column(String)
    icon = Column(String)
    goal = Column(String)
    color = Column(String)
    history = Column(JSON, default=[])

class PasswordReset(Base):
    __tablename__ = "password_resets"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    token = Column(String, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True))
    used = Column(Integer, default=0)  # 0 = unused, 1 = used
    created_at = Column(DateTime(timezone=True), server_default=func.now())