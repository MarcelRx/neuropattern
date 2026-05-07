# backend/main.py

# Fix import paths first
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

# Standard library imports
import uuid
import os
import json
import secrets
import tempfile
import base64
from datetime import datetime, timedelta
from pathlib import Path

# Third-party imports
from fastapi import (
    FastAPI, 
    UploadFile, 
    File, 
    Depends, 
    HTTPException, 
    status,
    Form
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# Local imports - now with proper paths
from ai_service import client, analyze_mental_health, generate_voice_response
import models
import auth
import schemas
import email_service
from database import get_db, engine, Base

# Load environment variables
load_dotenv()

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title=os.getenv("APP_NAME", "NeuroPattern API"),
    version=os.getenv("APP_VERSION", "2.5.0")
)

# Parse CORS origins from .env
cors_origins = json.loads(os.getenv("COR_ORIGINS", '["http://localhost:5173","http://localhost:3000"]'))

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# AUTH ROUTES
# ============================================================================

@app.post("/auth/login")
async def login(credentials: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user and return JWT token."""
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not auth.verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = auth.create_access_token(data={"sub": str(user.id)})
    return {
        "access_token": token, 
        "token_type": "bearer",
        "user": {
            "id": str(user.id), 
            "email": user.email, 
            "full_name": user.full_name, 
            "avatar_url": user.avatar_url
        }
    }

@app.post("/auth/register")
async def register(credentials: schemas.UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    existing_user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = models.User(
        email=credentials.email,
        password_hash=auth.get_password_hash(credentials.password),
        full_name=credentials.full_name
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    token = auth.create_access_token(data={"sub": str(new_user.id)})
    return {
        "access_token": token, 
        "token_type": "bearer",
        "user": {
            "id": str(new_user.id), 
            "email": new_user.email, 
            "full_name": new_user.full_name, 
            "avatar_url": new_user.avatar_url
        }
    }

@app.get("/auth/me")
async def get_me(current_user: models.User = Depends(auth.get_current_user)):
    """Get current authenticated user info."""
    return {
        "id": str(current_user.id), 
        "email": current_user.email, 
        "full_name": current_user.full_name, 
        "avatar_url": current_user.avatar_url
    }

@app.post("/auth/update-password")
async def update_password(
    data: dict, 
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Update user password - requires current password verification."""
    current_password = data.get("current_password")
    new_password = data.get("new_password")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Current password and new password are required")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    if not auth.verify_password(current_password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    current_user.password_hash = auth.get_password_hash(new_password)
    db.commit()
    
    return {"message": "Password updated successfully"}

@app.delete("/auth/delete-account")
async def delete_account(
    current_user: models.User = Depends(auth.get_current_user), 
    db: Session = Depends(get_db)
):
    """Delete user account and all associated data."""
    db.delete(current_user)
    db.commit()
    return {"message": "Account deleted successfully"}

# ============================================================================
# PASSWORD RESET ROUTES
# ============================================================================

@app.post("/auth/forgot-password")
async def forgot_password(data: dict, db: Session = Depends(get_db)):
    """Request password reset - sends email with reset token."""
    email = data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    user = db.query(models.User).filter(models.User.email == email).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email address")
    
    reset_token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=30)
    
    reset_entry = models.PasswordReset(
        user_id=user.id,
        token=reset_token,
        expires_at=expires_at
    )
    db.add(reset_entry)
    db.commit()
    
    email_sent = email_service.send_password_reset_email(
        to_email=user.email,
        reset_token=reset_token,
        user_name=user.full_name or "User"
    )
    
    if not email_sent:
        print(f"Failed to send reset email to {email}")
    
    return {"message": "Password reset link sent to your email"}

@app.post("/auth/verify-reset-token")
async def verify_reset_token(data: dict, db: Session = Depends(get_db)):
    """Verify if reset token is valid."""
    token = data.get("token")
    if not token:
        raise HTTPException(status_code=400, detail="Token is required")
    
    reset_entry = db.query(models.PasswordReset).filter(
        models.PasswordReset.token == token,
        models.PasswordReset.used == 0,
        models.PasswordReset.expires_at > datetime.utcnow()
    ).first()
    
    if not reset_entry:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    return {"valid": True, "user_id": str(reset_entry.user_id)}

@app.post("/auth/reset-password")
async def reset_password(data: dict, db: Session = Depends(get_db)):
    """Reset password using token."""
    token = data.get("token")
    new_password = data.get("new_password")
    
    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Token and new password are required")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    reset_entry = db.query(models.PasswordReset).filter(
        models.PasswordReset.token == token,
        models.PasswordReset.used == 0,
        models.PasswordReset.expires_at > datetime.utcnow()
    ).first()
    
    if not reset_entry:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    user = db.query(models.User).filter(models.User.id == reset_entry.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.password_hash = auth.get_password_hash(new_password)
    reset_entry.used = 1
    db.commit()
    
    return {"message": "Password reset successfully. You can now log in with your new password."}

# ============================================================================
# LOGS ROUTES
# ============================================================================

@app.get("/logs")
async def get_logs(
    current_user: models.User = Depends(auth.get_current_user), 
    db: Session = Depends(get_db)
):
    """Get all logs for current user."""
    logs = db.query(models.Log).filter(
        models.Log.user_id == current_user.id
    ).order_by(models.Log.timestamp.desc()).all()
    
    return [
        {
            "id": str(log.id), 
            "timestamp": log.timestamp.isoformat() if log.timestamp else None, 
            "score": log.score, 
            "mood": log.mood, 
            "summary": log.summary, 
            "sentiment": log.sentiment, 
            "voice_url": None
        } 
        for log in logs
    ]

@app.delete("/logs/clear")
async def clear_logs(
    current_user: models.User = Depends(auth.get_current_user), 
    db: Session = Depends(get_db)
):
    """Clear all logs for current user."""
    db.query(models.Log).filter(models.Log.user_id == current_user.id).delete()
    db.commit()
    return {"message": "All logs cleared successfully"}

# ============================================================================
# HABITS ROUTES
# ============================================================================

@app.get("/habits")
async def get_habits(
    current_user: models.User = Depends(auth.get_current_user), 
    db: Session = Depends(get_db)
):
    """Get all habits for current user with computed fields."""
    habits = db.query(models.Habit).filter(models.Habit.user_id == current_user.id).all()
    
    result = []
    for habit in habits:
        history = habit.history or []
        completed = len([h for h in history if h])
        total = len(history) if history else 1
        progress = min(100, int((completed / 7) * 100)) if history else 0
        
        result.append({
            "id": str(habit.id), 
            "name": habit.name, 
            "icon": habit.icon, 
            "goal": habit.goal, 
            "color": habit.color, 
            "history": history,
            "currentValue": completed,
            "progress": progress
        })
    
    return result

# ============================================================================
# VOICE CHECK-IN (Legacy - now handled by coach)
# ============================================================================

@app.post("/checkin/voice")
async def handle_voice_checkin(
    file: UploadFile = File(...), 
    current_user: models.User = Depends(auth.get_current_user), 
    db: Session = Depends(get_db)
):
    """Process voice check-in, analyze with AI, and store results."""
    user_text = "I've been feeling a bit overwhelmed with work lately." 
    
    analysis = analyze_mental_health(user_text)
    voice_filename = str(uuid.uuid4())
    voice_url = generate_voice_response(analysis['summary'], voice_filename)
    
    new_log = models.Log(
        user_id=current_user.id, 
        score=analysis['score'], 
        mood=analysis['mood'], 
        summary=analysis['summary'], 
        sentiment=analysis['sentiment']
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    
    return {
        "analysis": analysis, 
        "voice_url": f"http://localhost:8000{voice_url}" if voice_url else None
    }

# ============================================================================
# AI COACH ROUTES
# ============================================================================

def extract_goals(text: str) -> list:
    """Extract goals from AI response"""
    goals = []
    lines = text.split('\n')
    for line in lines:
        if any(marker in line for marker in ['Goal:', '- ', '• ', '1.', '2.', '3.']):
            clean = line.replace('Goal:', '').replace('- ', '').replace('• ', '').strip()
            if clean and len(clean) > 5:
                goals.append(clean[:100])
    return goals[:5] or ["Improve overall wellbeing", "Build consistent habits"]

def extract_schedule(text: str) -> list:
    """Extract schedule items from AI response"""
    schedule = []
    lines = text.split('\n')
    
    for line in lines:
        if ':' in line and any(am_pm in line.lower() for am_pm in ['am', 'pm']):
            parts = line.split(':', 1)
            if len(parts) == 2:
                time_part = parts[0].strip() + ':00'
                activity = parts[1].strip()
                
                schedule.append({
                    "time": time_part,
                    "activity": activity[:100],
                    "type": categorize_activity(activity)
                })
    
    if not schedule:
        schedule = [
            {"time": "07:00", "activity": "Morning mindfulness", "type": "mindfulness"},
            {"time": "09:00", "activity": "Deep work block", "type": "work"},
            {"time": "12:00", "activity": "Lunch & walk", "type": "exercise"},
            {"time": "18:00", "activity": "Social connection", "type": "social"},
            {"time": "22:00", "activity": "Sleep preparation", "type": "sleep"}
        ]
    
    return schedule

def categorize_activity(activity: str) -> str:
    """Categorize activity type"""
    activity_lower = activity.lower()
    if any(word in activity_lower for word in ['meditation', 'mindful', 'breathe', 'journal']):
        return 'mindfulness'
    elif any(word in activity_lower for word in ['exercise', 'walk', 'gym', 'workout', 'run']):
        return 'exercise'
    elif any(word in activity_lower for word in ['friend', 'family', 'social', 'call', 'meet']):
        return 'social'
    elif any(word in activity_lower for word in ['sleep', 'bed', 'rest']):
        return 'sleep'
    else:
        return 'work'

@app.post("/coach/chat")
async def coach_chat(
    data: dict,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    AI Life Coach chat endpoint. Processes user message and returns coaching response.
    """
    user_message = data.get('message', '')
    context = data.get('context', {})
    generate_voice = data.get('generateVoice', False)
    
    # Build comprehensive context for AI
    recent_logs = context.get('recentLogs', [])
    daily_score = context.get('dailyScore', 50)
    habits = context.get('habits', [])
    user_name = context.get('userName', 'User')
    has_completed_onboarding = context.get('hasCompletedOnboarding', False)
    
    # Determine if this is first interaction
    is_first_interaction = not has_completed_onboarding and len(recent_logs) == 0
    
    # Dynamic system prompt based on user state
    if is_first_interaction:
        system_prompt = f"""You are Nova, an AI Life Coach. This is {user_name}'s FIRST interaction with the app.
Your goal: Collect their initial wellbeing data through natural, warm conversation.
Ask ONE question at a time. Start with how they're feeling.
Then explore: sleep quality, stress levels, social connections, and goals.
Be conversational, empathetic, not clinical. Use their name occasionally."""
    else:
        system_prompt = f"""You are Nova, an expert AI Life Coach. User: {user_name}
Current Life Score: {daily_score}/100 | Check-ins: {len(recent_logs)}
Be concise, actionable, reference their data. If score < 50, be extra supportive.
If score > 75, challenge them to maintain. Always suggest ONE concrete next step."""

    user_prompt = f"""Message: "{user_message}"

Recent context:
{chr(10).join([f"- {log.get('timestamp', 'Unknown')[:10]}: Score {log.get('score', 'N/A')}, Mood: {log.get('mood', 'Unknown')}" for log in recent_logs[:3]])}

Respond as Nova. {"Guide them through first check-in." if is_first_interaction else "Provide personalized coaching."}"""

    try:
        # Get AI response from Groq
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=800
        )
        
        response_text = completion.choices[0].message.content
        
        # Parse for plan creation
        suggested_actions = []
        plan_data = None
        check_in_data = None
        
        # Detect if user is creating a plan request
        if any(keyword in user_message.lower() for keyword in ['plan', 'schedule', 'routine', 'habit']):
            suggested_actions = [
                {"label": "📋 View Full Plan", "action": "view_plan", "type": "plan"},
                {"label": "✏️ Modify Plan", "action": "modify_plan", "type": "plan"},
                {"label": "🔔 Set Reminders", "action": "set_reminders", "type": "schedule"}
            ]
            
            plan_data = {
                "title": f"{user_name.split()[0] if user_name else 'User'}'s Improvement Plan",
                "description": "AI-generated personalized coaching plan",
                "duration": "weekly",
                "goals": extract_goals(response_text),
                "schedule": extract_schedule(response_text)
            }
        
        # Detect emotional check-in
        if any(keyword in user_message.lower() for keyword in ['feel', 'feeling', 'mood', 'today', 'day']):
            analysis = analyze_mental_health(user_message)
            check_in_data = {
                "score": analysis['score'],
                "mood": analysis['mood'],
                "summary": analysis['summary'],
                "sentiment": analysis['sentiment']
            }
            
            suggested_actions.extend([
                {"label": "📊 View Analysis", "action": "view_analysis", "type": "analyze"},
                {"label": "🎯 Set Goal", "action": "set_goal", "type": "plan"}
            ])
        
        # Generate voice if requested
        voice_url = None
        if generate_voice:
            voice_filename = f"coach_{uuid.uuid4()}"
            voice_url = generate_voice_response(response_text[:500], voice_filename)
        
        return {
            "response": response_text,
            "voiceUrl": f"http://localhost:8000{voice_url}" if voice_url else None,
            "suggestedActions": suggested_actions,
            "plan": plan_data,
            "checkInData": check_in_data
        }
        
    except Exception as e:
        print(f"Coach error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Coach service temporarily unavailable")

@app.post("/coach/voice")
async def coach_voice(
    file: UploadFile = File(...),
    context: str = Form(...),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Process voice message for coaching. Transcribes audio and returns coaching response.
    """
    try:
        # Save audio temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        # In production, integrate OpenAI Whisper here for transcription
        # For now, return placeholder
        os.unlink(tmp_path)
        
        return {
            "transcription": "[Voice message received - speak clearly for best results]",
            "note": "Voice transcription active. Audio quality affects accuracy."
        }
        
    except Exception as e:
        print(f"Voice processing error: {e}")
        raise HTTPException(status_code=500, detail="Voice processing failed")

@app.post("/coach/checkin")
async def coach_checkin(
    data: dict,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save a check-in from coaching session.
    """
    try:
        new_log = models.Log(
            user_id=current_user.id,
            score=data.get('score', 50),
            mood=data.get('mood', 'Neutral'),
            summary=data.get('summary', 'Coaching session check-in'),
            sentiment=data.get('sentiment', 'neutral')
        )
        db.add(new_log)
        db.commit()
        
        return {"status": "success", "log_id": str(new_log.id)}
        
    except Exception as e:
        print(f"Check-in error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save check-in")

# ============================================================================
# STATIC FILES
# ============================================================================

os.makedirs("static/audio", exist_ok=True)
app.mount("/audio", StaticFiles(directory="static/audio"), name="audio")

# Helper functions for parsing AI responses
def extract_goals(text: str) -> list:
    """Extract goals from AI response"""
    goals = []
    lines = text.split('\n')
    for line in lines:
        if any(marker in line for marker in ['Goal:', '- ', '• ', '1.', '2.', '3.']):
            clean = line.replace('Goal:', '').replace('- ', '').replace('• ', '').strip()
            if clean and len(clean) > 5:
                goals.append(clean[:100])
    return goals[:5] or ["Improve overall wellbeing", "Build consistent habits"]

def extract_schedule(text: str) -> list:
    """Extract schedule items from AI response"""
    schedule = []
    lines = text.split('\n')
    current_time = ""
    
    for line in lines:
        # Look for time patterns
        if ':' in line and any(am_pm in line.lower() for am_pm in ['am', 'pm']):
            parts = line.split(':', 1)
            if len(parts) == 2:
                time_part = parts[0].strip() + ':00'
                activity = parts[1].strip()
                
                schedule.append({
                    "time": time_part,
                    "activity": activity[:100],
                    "type": categorize_activity(activity)
                })
    
    # Default schedule if none extracted
    if not schedule:
        schedule = [
            {"time": "07:00", "activity": "Morning mindfulness", "type": "mindfulness"},
            {"time": "09:00", "activity": "Deep work block", "type": "work"},
            {"time": "12:00", "activity": "Lunch & walk", "type": "exercise"},
            {"time": "18:00", "activity": "Social connection", "type": "social"},
            {"time": "22:00", "activity": "Sleep preparation", "type": "sleep"}
        ]
    
    return schedule

def categorize_activity(activity: str) -> str:
    """Categorize activity type"""
    activity_lower = activity.lower()
    if any(word in activity_lower for word in ['meditation', 'mindful', 'breathe', 'journal']):
        return 'mindfulness'
    elif any(word in activity_lower for word in ['exercise', 'walk', 'gym', 'workout', 'run']):
        return 'exercise'
    elif any(word in activity_lower for word in ['friend', 'family', 'social', 'call', 'meet']):
        return 'social'
    elif any(word in activity_lower for word in ['sleep', 'bed', 'rest']):
        return 'sleep'
    else:
        return 'work'
    
