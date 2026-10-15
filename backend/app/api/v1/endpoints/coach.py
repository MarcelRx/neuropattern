import json
import logging
import os
import tempfile
from datetime import UTC, datetime

from app.api.core import security as auth
from app.api.models.models import ChatRequest, LogCreate, QualityReport
from app.api.services.ai_service import ai_service, generate_voice_response
from app.database import get_db
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

logger = logging.getLogger(__name__)

router = APIRouter()

WHISPER_MODEL = "whisper-large-v3"
MIN_CONFIDENCE_THRESHOLD = 0.6
MIN_TRANSCRIPTION_LENGTH = 10


@router.post("/chat")
async def coach_chat(
    request: ChatRequest,
    current_user: dict = Depends(auth.get_current_user),
    db=Depends(get_db),
):
    """
    Process text chat with AI Coach Aura.
    Returns structured coaching response with emotional metadata and voice URL.
    """
    try:
        user_message = request.message

        # Generate structured response (text + metadata)
        response_data = ai_service.generate_coach_response(
            message=user_message,
            tone_context=getattr(request, "toneContext", "")
            or getattr(request, "tone_context", ""),
            history=getattr(request, "history", None),
        )

        response_text = response_data.get("text", "")
        detected_language = response_data.get("language", "en")

        result = {
            "response": response_text,
            "language": detected_language,
            "energy": response_data.get("energy", 80),
            "mood": response_data.get("mood", "Calm"),
            "score": response_data.get("score", 50),
            "user_emotion": response_data.get("user_emotion", "Neutral"),
            "voice_enabled": True,
            "timestamp": response_data.get("timestamp", datetime.now(UTC).isoformat()),
            "suggestedActions": [
                {
                    "label": "📊 View Analysis",
                    "action": "view_analysis",
                    "type": "analyze",
                }
            ],
            "checkInData": {
                "score": response_data.get("score", 50),
                "mood": response_data.get("mood", "Calm"),
                "summary": response_data.get("summary", ""),
                "sentiment": response_data.get("sentiment", "neutral"),
                "user_emotion": response_data.get("user_emotion", "Neutral"),
            },
        }

        # Always attempt voice generation when requested
        if getattr(request, "generateVoice", False) and response_text:
            try:
                filename = (
                    f"coach_{current_user.get('_id', 'anon')}_{int(datetime.now(UTC).timestamp())}"
                )
                audio_url = generate_voice_response(response_text, filename, detected_language)
                if audio_url:
                    result["audioUrl"] = audio_url
            except Exception as tts_err:
                # Log but never fail the chat because of TTS
                logger.debug(f"[TTS Error] {tts_err}")

        return result
    except Exception as e:
        logger.exception(f"Unexpected error in coach_chat: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")


@router.post("/voice")
async def coach_voice(
    file: UploadFile = File(...),
    quality_report: str | None = Form(None),
    preferred_language: str | None = Form(None),
    language: str | None = Form(None),
    current_user: dict = Depends(auth.get_current_user),
):
    """
    Process voice audio with quality and tone assessment.
    Returns structured response with transcription, metadata, and voice audio.
    """
    tmp_path = None
    try:
        frontend_quality = None
        tone_features = {
            "energy_variance": 0.5,
            "pitch_trend": "stable",
            "speech_rate": 4,
            "emotional_tone": {"arousal": 0.5, "valence": 0.5},
        }

        if quality_report:
            try:
                report_data = json.loads(quality_report)
                validated = QualityReport(**report_data)
                frontend_quality = validated.model_dump()
                tone_features = {
                    "energy_variance": validated.energyVariance or 0.5,
                    "pitch_trend": validated.pitchTrend or "stable",
                    "speech_rate": validated.speechRate or 4,
                    "emotional_tone": validated.emotionalTone.model_dump()
                    if validated.emotionalTone
                    else {"arousal": 0.5, "valence": 0.5},
                }
            except (json.JSONDecodeError, ValueError) as e:
                logger.debug(f"[Voice] Quality report validation warning: {e}")

        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        transcription_result = ai_service.transcribe_audio(tmp_path, preferred_language or language)
        transcription_text = transcription_result.get("text", "")
        confidence = transcription_result.get("confidence") or 0.7
        detected_language = (
            transcription_result.get("language") or preferred_language or language or "en"
        )
        language_confidence = transcription_result.get("language_confidence") or 0.75

        # Build tone context for AI
        tone_context = ""
        if tone_features.get("emotional_tone"):
            tone = tone_features["emotional_tone"]
            arousal = tone.get("arousal", 0.5)
            valence = tone.get("valence", 0.5)

            if arousal > 0.7:
                tone_context += " User sounds highly energized, potentially excited or intense. "
            elif arousal < 0.3:
                tone_context += " User sounds low energy, subdued, or potentially weary. "

            if valence > 0.7:
                tone_context += " Vocal tone radiates positivity and warmth. "
            elif valence < 0.3:
                tone_context += (
                    " Vocal tone suggests distress, stress, or a heavy emotional weight. "
                )

            if tone_features.get("pitch_trend") == "rising":
                tone_context += (
                    " There's a rising pitch at the end, suggesting a question or uncertainty. "
                )
            elif tone_features.get("pitch_trend") == "falling":
                tone_context += " There's a falling pitch, suggesting finality or a somber tone. "

        # Generate structured AI response
        ai_response = ai_service.generate_coach_response(
            message=transcription_text, tone_context=tone_context
        )

        response_text = ai_response.get("text", "")
        response_language = ai_response.get("language", detected_language)

        # Generate voice for the response
        audio_url = None
        if response_text:
            try:
                filename = f"coach_voice_{current_user.get('_id', 'anon')}_{int(datetime.now(UTC).timestamp())}"
                audio_url = generate_voice_response(response_text, filename, response_language)
            except Exception as tts_err:
                logger.debug(f"[Voice TTS Error] {tts_err}")

        # Quality checks
        quality_issues = []
        is_clear = True

        if frontend_quality and not frontend_quality.get("isClear", True):
            quality_issues.extend(frontend_quality.get("issues", []))

        if confidence < MIN_CONFIDENCE_THRESHOLD:
            quality_issues.append("low_confidence")
            is_clear = False

        if language_confidence < 0.65:
            quality_issues.append("low_language_confidence")
            is_clear = False

        if len(transcription_text.strip()) < MIN_TRANSCRIPTION_LENGTH:
            quality_issues.append("too_short")
            is_clear = False

        file_size = os.path.getsize(tmp_path)
        if file_size < 1000:
            quality_issues.append("audio_too_short")
            is_clear = False

        words = transcription_text.split()
        if words:
            avg_word_length = sum(len(w) for w in words) / len(words)
            if avg_word_length > 15:
                quality_issues.append("possible_gibberish")
                is_clear = False

        suggested_action = None
        if "too_quiet" in quality_issues or "low_confidence" in quality_issues:
            suggested_action = "speak_louder"
        elif "too_much_silence" in quality_issues or "audio_too_short" in quality_issues:
            suggested_action = "speak_continuously"
        elif "too_loud" in quality_issues or "clipping_detected" in quality_issues:
            suggested_action = "speak_softer"
        elif "too_short" in quality_issues:
            suggested_action = "speak_longer"
        elif "possible_gibberish" in quality_issues:
            suggested_action = "speak_clearly"

        return {
            "transcription": transcription_text,
            "confidence": round(confidence, 2),
            "isClear": is_clear,
            "qualityIssues": quality_issues,
            "suggestedAction": suggested_action,
            "duration": frontend_quality.get("duration", 0)
            if frontend_quality
            else transcription_result.get("duration", 0),
            "toneFeatures": tone_features,
            "analysis": {
                "score": ai_response.get("score", 50),
                "mood": ai_response.get("mood", "Calm"),
                "summary": ai_response.get("summary", ""),
                "user_emotion": ai_response.get("user_emotion", "Neutral"),
                "sentiment": ai_response.get("sentiment", "neutral"),
            },
            "language": response_language,
            "languageConfidence": round(language_confidence, 2),
            "response": response_text,
            "energy": ai_response.get("energy", 70),
            "mood": ai_response.get("mood", "Calm"),
            "audioUrl": audio_url,
            "voice_enabled": True,
            "timestamp": ai_response.get("timestamp", datetime.now(UTC).isoformat()),
        }

    except Exception as e:
        logger.exception(f"[Voice Processing Error] {e}")
        raise HTTPException(status_code=500, detail="Voice processing failed")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post("/checkin")
async def save_coach_checkin(
    data: LogCreate,
    current_user: dict = Depends(auth.get_current_user),
    db=Depends(get_db),
):
    """
    Save a completed check-in to the database.
    """
    log_data = data.model_dump()
    log_data["user_id"] = current_user["_id"]
    log_data["timestamp"] = datetime.now(UTC)

    result = await db.logs.insert_one(log_data)
    return {"status": "success", "id": str(result.inserted_id)}
