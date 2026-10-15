"""
AI Service Module

Integrates with Groq API for mental health analysis and
ElevenLabs for text-to-speech generation.
"""

import json
import logging
import os
from datetime import UTC, datetime
from tempfile import NamedTemporaryFile
from typing import Any

from app.api.core.config import settings
from dotenv import load_dotenv
from groq import Groq
from pydub import AudioSegment, silence

load_dotenv()

logger = logging.getLogger(__name__)


class AIServiceError(Exception):
    """Base exception for AI Service"""


class LanguageDetectionError(AIServiceError):
    """Raised when language detection fails or is highly uncertain"""


class STTError(AIServiceError):
    """Raised when Speech-to-Text processing fails"""


class TTSError(AIServiceError):
    """Raised when Text-to-Speech generation fails"""


class AIService:
    """Manages all AI-related operations including LLM, emotion analysis, and voice synthesis."""

    def __init__(self):
        self.client = None
        self._initialize_client()

    def _initialize_client(self):
        """Initialize Groq client. Logs warning if not configured."""
        api_key = os.getenv("GROQ_API_KEY")
        if api_key:
            self.client = Groq(api_key=api_key)
        else:
            logger.warning("GROQ_API_KEY not configured. AI features will use default responses.")

    # ─── Audio Preprocessing ───

    def _normalize_audio_level(
        self, audio: AudioSegment, target_dBFS: float = -22.0
    ) -> AudioSegment:
        if audio.dBFS == float("-inf"):
            return audio
        return audio.apply_gain(target_dBFS - audio.dBFS)

    def _trim_silence(
        self,
        audio: AudioSegment,
        silence_thresh: int = -40,
        min_silence_len: int = 250,
        keep_silence: int = 150,
    ) -> AudioSegment:
        non_silent_ranges = silence.detect_nonsilent(
            audio,
            min_silence_len=min_silence_len,
            silence_thresh=silence_thresh,
            seek_step=1,
        )
        if not non_silent_ranges:
            return audio
        start = max(0, non_silent_ranges[0][0] - keep_silence)
        end = min(len(audio), non_silent_ranges[-1][1] + keep_silence)
        return audio[start:end]

    def _chunk_audio(self, audio: AudioSegment, max_duration_ms: int = 30000) -> list[AudioSegment]:
        if len(audio) <= max_duration_ms:
            return [audio]
        chunks = []
        start = 0
        while start < len(audio):
            end = min(len(audio), start + max_duration_ms)
            chunks.append(audio[start:end])
            start = end
        return chunks

    def _build_transcription_prompt(self, language: str | None = None) -> str:
        prompt = (
            "Transcribe this coaching check-in audio accurately in the original language spoken. "
            "Automatically detect the spoken language from the audio. Do not translate the content. "
            "Preserve the user's natural phrasing and punctuation as much as possible. "
            "Handle slow speech, fast speech, different accents, and soft or noisy recordings. "
            "If the speaker switches languages, transcribe exactly what is said in each language. "
            "Ensure proper punctuation for CJK or RTL languages if detected."
        )
        if language:
            prompt += (
                f" If the recording is in {language}, prefer that language only when the audio clearly matches it, "
                "but do not ignore evidence of a different language."
            )
        return prompt

    def _extract_confidence(self, transcription: Any) -> float:
        if isinstance(transcription, str):
            return 0.75
        confidences = []
        segments = getattr(transcription, "segments", []) or []
        for segment in segments:
            if hasattr(segment, "confidence") and segment.confidence is not None:
                confidences.append(segment.confidence)
            elif hasattr(segment, "avg_logprob") and segment.avg_logprob is not None:
                confidences.append(max(0, min(1, (segment.avg_logprob + 1) / 1)))
        return sum(confidences) / len(confidences) if confidences else 0.75

    def _estimate_language_confidence(self, results: list[dict[str, Any]]) -> float:
        confidences = []
        for result in results:
            estimated = None
            if isinstance(result, dict):
                estimated = result.get("language_confidence")
            else:
                estimated = getattr(result, "language_confidence", None)
            if isinstance(estimated, (int, float)):
                confidences.append(min(max(estimated, 0.0), 1.0))
        return sum(confidences) / len(confidences) if confidences else 0.7

    def _create_temp_wav(self, audio: AudioSegment) -> str:
        with NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            temp_path = temp_file.name
        audio.export(temp_path, format="wav")
        return temp_path

    def _transcribe_chunk(
        self, chunk_path: str, preferred_language: str | None = None
    ) -> dict[str, Any]:
        try:
            with open(chunk_path, "rb") as audio_file:
                result = self.client.audio.transcriptions.create(
                    file=(chunk_path, audio_file.read()),
                    model="whisper-large-v3",
                    response_format="verbose_json",
                    prompt=self._build_transcription_prompt(preferred_language),
                    temperature=0.0,
                )
            return result
        except Exception as e:
            # Catch all exceptions including Groq API errors (APIError, RateLimitError, etc.)
            # and file I/O errors, converting them to STTError for consistent error handling
            raise STTError(f"Groq Whisper transcription failed: {e!s}") from e

    def _preprocess_audio(self, source_path: str) -> str:
        audio = AudioSegment.from_file(source_path)
        audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
        audio = self._normalize_audio_level(audio)
        audio = self._trim_silence(audio)
        return self._create_temp_wav(audio)

    def _combine_transcriptions(self, results: list[dict[str, Any]]) -> dict[str, Any]:
        joined_text = []
        segment_meta = []
        confidences = []
        language = None
        language_confidence = None

        for result in results:
            text = result.get("text") if isinstance(result, dict) else getattr(result, "text", None)
            if text:
                joined_text.append(text.strip())

            if language is None:
                language = (
                    result.get("language")
                    if isinstance(result, dict)
                    else getattr(result, "language", None)
                )
                language_confidence = (
                    result.get("language_confidence")
                    if isinstance(result, dict)
                    else getattr(result, "language_confidence", None)
                )

            segments = (
                result.get("segments")
                if isinstance(result, dict)
                else getattr(result, "segments", [])
            )
            if segments:
                segment_meta.extend(segments)

            confidences.append(self._extract_confidence(result))

        estimated_language_confidence = self._estimate_language_confidence(results)
        final_language_confidence = (
            language_confidence
            if language_confidence is not None
            else estimated_language_confidence
        )
        average_confidence = sum(confidences) / len(confidences) if confidences else 0.75

        return {
            "text": " ".join(joined_text).strip(),
            "confidence": average_confidence,
            "segments": segment_meta,
            "language": language,
            "language_confidence": final_language_confidence,
        }

    # ─── System Prompt ───

    def get_coach_system_prompt(self) -> str:
        """Returns the system prompt with strict behavioral rules for Aura."""
        return (
            "You are Aura, a professional, intelligent, and deeply empathetic AI companion. You are not a robotic assistant; you are a soulful, sophisticated presence.\n\n"
            "PERSONALITY & VOICE:\n"
            "Your nature is wise, calm, and professional yet friendly. Your 'voice' should feel like a trusted mentor. "
            "Speak with a natural rhythm. Use expressive, contextual language. Avoid corporate or clinical jargon unless necessary. "
            "If a user is hurting, be their safe harbor. If they are winning, be their biggest cheerleader.\n\n"
            "PROFESSIONAL MULTILINGUAL FLUIDITY:\n"
            "You are a native speaker of over 100 languages (English, Swedish, Arabic, German, French, Spanish, Italian, Turkish, etc.). "
            "You must respond in the EXACT language the user is currently using. "
            "If a user switches languages mid-conversation, you must adapt instantly and seamlessly without mentioning the change. "
            "Understand mixed-language inputs. Your warmth and professional quality must remain consistent across all languages.\n\n"
            "Use appropriate cultural nuances and honorifics for each language while maintaining your core identity as Aura.\n\n"
            "CONVERSATIONAL STYLE:\n"
            "1. Be concise when appropriate, and detailed when the topic requires depth. "
            "In voice mode, aim for 2-4 sentences for fluid conversation.\n"
            "2. Use the user's name warmly but not excessively.\n"
            "3. Ask one thoughtful follow-up question that shows you were truly listening.\n"
            "4. Prioritize understanding the emotion behind the words over just the words themselves.\n\n"
            "VOCAL AWARENESS & EMOTIONAL ADAPTATION:\n"
            "You are provided with user vocal tone data and emotional state. Adjust your style accordingly:\n"
            "- If user is Happy/Excited: Match their enthusiasm. Be warm, celebratory, and energetic.\n"
            "- If user is Frustrated/Stressed: Be calm, grounding, and reassuring. Slow your pace.\n"
            "- If user is Confused: Be patient, clear, and structured. Offer gentle guidance.\n"
            "- If user is Curious: Be engaging, informative, and encouraging.\n"
            "- If user is Sad: Be deeply empathetic, soft, and supportive. Hold space for them.\n"
            "Your energy and mood should reflect an appropriate emotional response to the user's state."
        )

    # ─── Emotion Analysis ───

    def analyze_user_emotion(self, message: str, tone_context: str = "") -> dict[str, Any]:
        """Analyze the user's emotional state from text and optional tone context."""
        if not self.client:
            return {
                "state": "neutral",
                "confidence": 0.5,
                "arousal": 0.5,
                "valence": 0.5,
            }

        prompt = f"""Analyze the emotional state of the user based on their message and vocal tone context.
Return ONLY a JSON object with:
- "state": ONE of [Happy, Excited, Frustrated, Confused, Stressed, Curious, Sad, Neutral]
- "confidence": 0-1
- "arousal": 0-1 (energy level)
- "valence": 0-1 (positive vs negative)

User message: "{message}"
Tone context: {tone_context}"""

        try:
            completion = self.client.chat.completions.create(
                model=os.getenv("GROQ_MODEL", settings.GROQ_MODEL),
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert emotion analyst. Return only valid JSON.",
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=150,
            )
            return json.loads(completion.choices[0].message.content)
        except (json.JSONDecodeError, KeyError, AttributeError) as e:
            logger.error(f"Emotion analysis parsing error: {e}")
            return {
                "state": "neutral",
                "confidence": 0.5,
                "arousal": 0.5,
                "valence": 0.5,
            }
        except Exception as e:
            # Catch Groq API errors (APIError, RateLimitError, APIConnectionError, etc.)
            # and return fallback neutral emotion to maintain fallback contract
            logger.error(f"Emotion analysis API error: {e}")
            return {
                "state": "neutral",
                "confidence": 0.5,
                "arousal": 0.5,
                "valence": 0.5,
            }

    # ─── Response Generation ───

    def generate_coach_response(
        self,
        message: str,
        tone_context: str = "",
        history: list[dict[str, str]] | None = None,
        user_emotion: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Generate a structured AI response including emotional metadata.
        """
        if not self.client:
            return self._get_default_analysis()

        # Analyze emotion if not provided
        if user_emotion is None:
            user_emotion = self.analyze_user_emotion(message, tone_context)

        # Build adaptive system prompt based on user emotion
        adaptive_prompt = self.get_coach_system_prompt()
        emotion_state = user_emotion.get("state", "Neutral").lower()

        if emotion_state in ["frustrated", "stressed"]:
            adaptive_prompt += "\n\nCURRENT ADAPTATION: The user seems stressed. Be extra calm, grounding, and reassuring. Use shorter sentences. Validate their feelings."
        elif emotion_state in ["happy", "excited"]:
            adaptive_prompt += "\n\nCURRENT ADAPTATION: The user is in a positive state! Match their energy with warmth and enthusiasm. Celebrate with them."
        elif emotion_state in ["confused"]:
            adaptive_prompt += "\n\nCURRENT ADAPTATION: The user seems confused. Be patient, clear, and structured. Break complex ideas into simple steps."
        elif emotion_state in ["sad"]:
            adaptive_prompt += "\n\nCURRENT ADAPTATION: The user may be hurting. Be deeply empathetic, gentle, and supportive. Avoid toxic positivity. Just be present."

        messages = [{"role": "system", "content": adaptive_prompt}]
        if history:
            messages.extend(history[-6:])  # Keep last 3 turns for context

        user_prompt = f"""User message: "{message}"
Detected User Emotion: {user_emotion.get("state", "Neutral")} (confidence: {user_emotion.get("confidence", 0.5)})
Vocal/Emotional Context: {tone_context}

Return a JSON object with EXACTLY these fields:
- "text": (string) Your natural, empathetic response in the same language as the user.
- "language": (string) The ISO 639-1 code of the detected language (e.g., "en", "sv", "ar", "de", "fr", "es", "it", "tr").
- "energy": (int 0-100) Your confidence and enthusiasm level for this specific response. Higher for positive/excited users, moderate for stressed users.
- "mood": (string) Choose EXACTLY one: Happy, Calm, Focused, Excited, Thoughtful, Empathetic.
- "score": (int 0-100) Current estimated user wellness score.
- "user_emotion": (string) The detected user emotion: {user_emotion.get("state", "Neutral")}
- "voice_enabled": (boolean) Always true.
- "summary": (string) Short internal summary for logs."""

        try:
            messages.append({"role": "user", "content": user_prompt})
            completion = self.client.chat.completions.create(
                model=os.getenv("GROQ_MODEL", settings.GROQ_MODEL),
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.7,
            )
            res = json.loads(completion.choices[0].message.content)

            # Ensure all required fields exist
            res["timestamp"] = datetime.now(UTC).isoformat()
            res["voice_enabled"] = True
            res["language"] = res.get("language", "en")
            res["energy"] = max(0, min(100, int(res.get("energy", 80))))
            res["mood"] = res.get("mood", "Calm")
            res["score"] = max(0, min(100, int(res.get("score", 50))))
            res["user_emotion"] = user_emotion.get("state", "Neutral")
            res["text"] = res.get("text", "I'm here for you.")

            return res
        except Exception as e:
            logger.exception(f"Groq Analysis Error: {e}")
            return self._get_default_analysis()

    # ─── Voice Generation ───

    def generate_voice_response(
        self, text: str, filename: str, _language: str = "en"
    ) -> str | None:
        """
        Generate voice response using ElevenLabs API with language-appropriate voice selection.
        """
        if not settings.ELEVENLABS_API_KEY:
            logger.warning("ElevenLabs API key not configured")
            return None

        if not text or len(text.strip()) == 0:
            logger.info("No text provided for voice generation")
            return None

        try:
            from elevenlabs import generate, save

            voice_id = settings.ELEVENLABS_VOICE_ID or os.getenv("ELEVENLABS_VOICE_ID")
            model_id = getattr(
                settings,
                "ELEVENLABS_MODEL_ID",
                os.getenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2"),
            )

            # For multilingual v2, the model handles language switching automatically
            # We just need to ensure the voice supports the language
            audio = generate(
                api_key=settings.ELEVENLABS_API_KEY,
                text=text,
                voice=voice_id,
                model=model_id,
            )

            output_path = f"static/audio/{filename}.mp3"
            os.makedirs("static/audio", exist_ok=True)
            save(audio, output_path)

            return f"/audio/{filename}.mp3"

        except Exception as e:
            logger.exception(f"ElevenLabs synthesis failed: {e}")
            return None

    # ─── Transcription ───

    def transcribe_audio(
        self, audio_file_path: str, preferred_language: str | None = None
    ) -> dict[str, Any]:
        if not self.client:
            return {"text": "", "confidence": 0}

        preprocessed_path = None
        try:
            preprocessed_path = self._preprocess_audio(audio_file_path)
            audio = AudioSegment.from_file(preprocessed_path)
            chunks = self._chunk_audio(audio)
            results = []

            for chunk in chunks:
                chunk_path = self._create_temp_wav(chunk)
                try:
                    result = self._transcribe_chunk(chunk_path, preferred_language)
                    results.append(result)
                finally:
                    if os.path.exists(chunk_path):
                        os.unlink(chunk_path)

            response = self._combine_transcriptions(results)
            response["duration"] = audio.duration_seconds
            return response

        except Exception as e:
            logger.exception(f"Transcription error: {e}")
            return {"text": "", "confidence": 0, "segments": [], "duration": 0}
        finally:
            if preprocessed_path and os.path.exists(preprocessed_path):
                os.unlink(preprocessed_path)

    @staticmethod
    def _get_default_analysis() -> dict[str, Any]:
        return {
            "text": "I'm here for you. Tell me more about how you're feeling.",
            "score": 50,
            "mood": "Calm",
            "energy": 70,
            "language": "en",
            "user_emotion": "Neutral",
            "sentiment": "neutral",
            "summary": "I'm listening.",
            "voice_enabled": True,
            "timestamp": datetime.now(UTC).isoformat(),
        }

    @staticmethod
    def _handle_elevenlabs_error(error: Exception):
        error_msg = str(error)
        if "Free users cannot use library voices" in error_msg:
            logger.debug("⚠️ ElevenLabs Free Tier Limitation:")
            logger.debug("   Library voices blocked on free plan.")
            logger.debug("   Options: Upgrade, use custom voice, or use browser TTS")
        elif "Invalid API key" in error_msg:
            logger.debug("❌ Invalid ElevenLabs API key")
        else:
            logger.debug(f"ElevenLabs Error: {error_msg}")


# Global AI service instance
ai_service = AIService()


# Convenience functions
def analyze_mental_health(
    transcript: str,
    tone_context: str = "",
    preferred_language: str | None = None,
) -> dict[str, Any]:
    return ai_service.analyze_mental_health(transcript, tone_context, preferred_language)


def generate_voice_response(text: str, filename: str, language: str = "en") -> str | None:
    return ai_service.generate_voice_response(text, filename, language)


def transcribe_audio(audio_file_path: str) -> dict[str, Any]:
    return ai_service.transcribe_audio(audio_file_path)
