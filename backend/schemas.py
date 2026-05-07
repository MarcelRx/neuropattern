# backend/schemas.py
from pydantic import BaseModel, EmailStr
from typing import Optional

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class LoginRequest(BaseModel): # Matches your main.py usage
    email: EmailStr
    password: str

class UserLogin(BaseModel): # Added for compatibility
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    avatar_url: Optional[str]

    class Config:
        from_attributes = True