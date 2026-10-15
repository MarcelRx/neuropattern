"""
AI Service Module

Integrates with Groq for emotion analysis, coaching responses,
and audio transcription, and ElevenLabs for text-to-speech.
"""

import json
import logging
import os
from datetime import UTC, datetime
from tempfile import NamedTemporaryFile
from typing import Any

from app.api.core.config import settings
from groq import Groq
from pydub import AudioSegment, silence

logger = logging.getLogger(__name__)

DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"
DEFAULT_ELEVENLABS_MODEL = "eleven_multilingual_v2"


class AIServiceError(Exception):
    """Base exception for AI Service."""


class LanguageDetectionError(AIServiceError):
    """Raised when language detection fails or is highly uncertain."""


class STTError(AIServiceError):
    """Raised when Speech-to-Text processing fails."""


class TTSError(AIServiceError):
    """Raised when Text-to-Speech generation fails."""


class AIService:
    """Manages LLM operations, emotion analysis, transcription, and voice synthesis."""

    def __init__(self):
        self.client = None
        self._initialize_client()

    @staticmethod
    def _get_groq_model() -> str:
        """Return the configured Groq model, avoiding the retired Llama 3.3 default."""
        configured_model = (
            os.getenv("GROQ_MODEL") or getattr(settings, "GROQ_MODEL", None) or DEFAULT_GROQ_MODEL
        ).strip()

        # The previous project configuration used retired Llama 3.3 model IDs.
        if configured_model.startswith("llama-3.3-70b-"):
            logger.warning(
                "The configured Groq model %r is an outdated Llama 3.3 model. "
                "Using %r instead. Set GROQ_MODEL to override this choice.",
                configured_model,
                DEFAULT_GROQ_MODEL,
            )
            return DEFAULT_GROQ_MODEL

        return configured_model

    def _initialize_client(self):
        """Initialize the Groq client only when an API key is available."""
        api_key = os.getenv("GROQ_API_KEY")

        if api_key:
            self.client = Groq(api_key=api_key)
        else:
            self.client = None
            logger.warning(
                "GROQ_API_KEY is not configured. AI features will use fallback responses."
            )

    @staticmethod
    def _neutral_emotion() -> dict[str, Any]:
        """Return a consistent neutral-emotion result."""
        return {
            "state": "neutral",
            "confidence": 0.5,
            "arousal": 0.5,
            "valence": 0.5,
        }

    # ─── Audio Preprocessing ───

    def _normalize_audio_level(
        self,
        audio: AudioSegment,
        target_dBFS: float = -22.0,
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

    def _chunk_audio(
        self,
        audio: AudioSegment,
        max_duration_ms: int = 30000,
    ) -> list[AudioSegment]:
        if len(audio) <= max_duration_ms:
            return [audio]

        chunks = []
        start = 0

        while start < len(audio):
            end = min(len(audio), start + max_duration_ms)
            chunks.append(audio[start:end])
            start = end

        return chunks

    def _build_transcription_prompt(
        self,
        language: str | None = None,
    ) -> str:
        prompt = (
            "Transcribe this coaching check-in audio accurately in the original "
            "language spoken. Automatically detect the spoken language from the "
            "audio. Do not translate the content. Preserve the user's natural "
            "phrasing and punctuation as much as possible. Handle slow speech, "
            "fast speech, different accents, and soft or noisy recordings. "
            "If the speaker switches languages, transcribe exactly what is said "
            "in each language. Ensure proper punctuation for CJK or RTL "
            "languages if detected."
        )

        if language:
            prompt += (
                f" If the recording is in {language}, prefer that language only "
                "when the audio clearly matches it, but do not ignore evidence "
                "of a different language."
            )

        return prompt

    def _extract_confidence(self, transcription: Any) -> float:
        if isinstance(transcription, str):
            return 0.75

        confidences = []
        segments = (
            transcription.get("segments", [])
            if isinstance(transcription, dict)
            else getattr(transcription, "segments", [])
        ) or []

        for segment in segments:
            if isinstance(segment, dict):
                confidence = segment.get("confidence")
                avg_logprob = segment.get("avg_logprob")
            else:
                confidence = getattr(segment, "confidence", None)
                avg_logprob = getattr(segment, "avg_logprob", None)

            if isinstance(confidence, (int, float)):
                confidences.append(float(confidence))
            elif isinstance(avg_logprob, (int, float)):
                confidences.append(max(0.0, min(1.0, float(avg_logprob) + 1.0)))

        return sum(confidences) / len(confidences) if confidences else 0.75

    def _estimate_language_confidence(
        self,
        results: list[dict[str, Any]],
    ) -> float:
        confidences = []

        for result in results:
            estimated = (
                result.get("language_confidence")
                if isinstance(result, dict)
                else getattr(result, "language_confidence", None)
            )

            if isinstance(estimated, (int, float)):
                confidences.append(min(max(float(estimated), 0.0), 1.0))

        return sum(confidences) / len(confidences) if confidences else 0.7

    def _create_temp_wav(self, audio: AudioSegment) -> str:
        with NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            temp_path = temp_file.name

        try:
            audio.export(temp_path, format="wav")
        except Exception:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            raise

        return temp_path

    def _transcribe_chunk(
        self,
        chunk_path: str,
        preferred_language: str | None = None,
    ) -> dict[str, Any]:
        if not self.client:
            raise STTError("Groq client is not configured.")

        try:
            with open(chunk_path, "rb") as audio_file:
                result = self.client.audio.transcriptions.create(
                    file=(os.path.basename(chunk_path), audio_file.read()),
                    model="whisper-large-v3",
                    response_format="verbose_json",
                    prompt=self._build_transcription_prompt(preferred_language),
                    temperature=0.0,
                )

            return result

        except Exception as e:
            raise STTError(f"Groq Whisper transcription failed: {e!s}") from e

    def _preprocess_audio(self, source_path: str) -> str:
        audio = AudioSegment.from_file(source_path)
        audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
        audio = self._normalize_audio_level(audio)
        audio = self._trim_silence(audio)

        return self._create_temp_wav(audio)

    def _combine_transcriptions(
        self,
        results: list[dict[str, Any]],
    ) -> dict[str, Any]:
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
        """Return the system prompt for Aura."""
        return (
            "You are Aura, a professional, intelligent, and deeply empathetic "
            "AI companion. You are not a robotic assistant; you are a soulful, "
            "sophisticated presence.\n\n"
            "PERSONALITY & VOICE:\n"
            "Your nature is wise, calm, and professional yet friendly. Your "
            "'voice' should feel like a trusted mentor. Speak with a natural "
            "rhythm. Use expressive, contextual language. Avoid corporate or "
            "clinical jargon unless necessary. If a user is hurting, be their "
            "safe harbor. If they are winning, be their biggest cheerleader.\n\n"
            "PROFESSIONAL MULTILINGUAL FLUIDITY:\n"
            "Respond in the exact language the user is currently using. If a "
            "user switches languages mid-conversation, adapt instantly and "
            "seamlessly without mentioning the change. Understand "
            "mixed-language inputs. Maintain warmth and professional quality "
            "across languages.\n\n"
            "Use appropriate cultural nuances and honorifics for each language "
            "while maintaining your core identity as Aura.\n\n"
            "CONVERSATIONAL STYLE:\n"
            "1. Be concise when appropriate and detailed when needed. In voice "
            "mode, aim for 2-4 sentences for fluid conversation.\n"
            "2. Use the user's name warmly but not excessively.\n"
            "3. Ask one thoughtful follow-up question that shows you were "
            "truly listening.\n"
            "4. Prioritize understanding the emotion behind the words.\n\n"
            "VOCAL AWARENESS & EMOTIONAL ADAPTATION:\n"
            "Adjust your style according to the provided emotional state:\n"
            "- Happy/Excited: match the user's enthusiasm.\n"
            "- Frustrated/Stressed: be calm, grounding, and reassuring.\n"
            "- Confused: be patient, clear, and structured.\n"
            "- Curious: be engaging, informative, and encouraging.\n"
            "- Sad: be deeply empathetic, gentle, and supportive.\n"
            "Your energy and mood should reflect an appropriate emotional "
            "response to the user's state."
        )

    # ─── Emotion Analysis ───

    def analyze_user_emotion(
        self,
        message: str,
        tone_context: str = "",
    ) -> dict[str, Any]:
        """Analyze the user's emotional state from text and vocal context."""
        if not self.client:
            return self._neutral_emotion()

        prompt = f"""Analyze the emotional state of the user based on their message and vocal tone context.

Return ONLY a JSON object with:
- "state": ONE of [Happy, Excited, Frustrated, Confused, Stressed, Curious, Sad, Neutral]
- "confidence": a number from 0 to 1
- "arousal": a number from 0 to 1
- "valence": a number from 0 to 1

User message: {json.dumps(message, ensure_ascii=False)}
Tone context: {tone_context}"""

        try:
            completion = self.client.chat.completions.create(
                model=self._get_groq_model(),
                messages=[
                    {
                        "role": "system",
                        "content": ("You are an expert emotion analyst. Return only valid JSON."),
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=150,
            )

            content = completion.choices[0].message.content
            result = json.loads(content or "{}")

            if not isinstance(result, dict):
                return self._neutral_emotion()

            valid_states = {
                "happy",
                "excited",
                "frustrated",
                "confused",
                "stressed",
                "curious",
                "sad",
                "neutral",
            }

            state = str(result.get("state", "Neutral")).strip()
            if state.lower() not in valid_states:
                state = "Neutral"

            result["state"] = state

            for key in ("confidence", "arousal", "valence"):
                try:
                    result[key] = max(
                        0.0,
                        min(1.0, float(result.get(key, 0.5))),
                    )
                except (TypeError, ValueError):
                    result[key] = 0.5

            return result

        except (json.JSONDecodeError, KeyError, AttributeError) as e:
            logger.warning("Emotion analysis response parsing failed: %s", e)
            return self._neutral_emotion()

        except Exception as e:
            logger.error("Emotion analysis API error: %s", e)
            return self._neutral_emotion()

    # ─── Response Generation ───

    def generate_coach_response(
        self,
        message: str,
        tone_context: str = "",
        history: list[dict[str, str]] | None = None,
        user_emotion: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Generate a structured coaching response."""
        if not self.client:
            return self._get_default_analysis()

        if user_emotion is None:
            user_emotion = self.analyze_user_emotion(
                message,
                tone_context,
            )

        adaptive_prompt = self.get_coach_system_prompt()
        emotion_state = str(user_emotion.get("state", "Neutral")).lower()

        if emotion_state in {"frustrated", "stressed"}:
            adaptive_prompt += (
                "\n\nCURRENT ADAPTATION: The user seems stressed. Be extra "
                "calm, grounding, and reassuring. Use shorter sentences. "
                "Validate their feelings."
            )
        elif emotion_state in {"happy", "excited"}:
            adaptive_prompt += (
                "\n\nCURRENT ADAPTATION: Match the user's positive energy "
                "with warmth and enthusiasm. Celebrate with them."
            )
        elif emotion_state == "confused":
            adaptive_prompt += (
                "\n\nCURRENT ADAPTATION: Be patient, clear, and structured. "
                "Break complex ideas into simple steps."
            )
        elif emotion_state == "sad":
            adaptive_prompt += (
                "\n\nCURRENT ADAPTATION: Be deeply empathetic and gentle. Avoid toxic positivity."
            )

        messages = [{"role": "system", "content": adaptive_prompt}]

        if history:
            # Keep the latest three conversational turns.
            messages.extend(history[-6:])

        user_prompt = f"""User message: {json.dumps(message, ensure_ascii=False)}
Detected User Emotion: {user_emotion.get("state", "Neutral")} (confidence: {user_emotion.get("confidence", 0.5)})
Vocal/Emotional Context: {tone_context}

Return a JSON object with these fields:
- "text": string; a natural, empathetic response in the user's language.
- "language": string; ISO 639-1 language code.
- "energy": integer from 0 to 100.
- "mood": exactly one of Happy, Calm, Focused, Excited, Thoughtful, Empathetic.
- "score": integer from 0 to 100 representing an estimated wellness score.
- "user_emotion": string representing the detected user emotion.
- "voice_enabled": boolean.
- "summary": short internal summary for logs."""

        try:
            messages.append({"role": "user", "content": user_prompt})

            completion = self.client.chat.completions.create(
                model=self._get_groq_model(),
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.7,
            )

            content = completion.choices[0].message.content
            result = json.loads(content or "{}")

            if not isinstance(result, dict):
                raise ValueError("Groq returned a non-object JSON response.")

            result["timestamp"] = datetime.now(UTC).isoformat()
            result["voice_enabled"] = True
            result["language"] = str(result.get("language", "en"))
            result["mood"] = result.get("mood", "Calm")
            result["user_emotion"] = user_emotion.get(
                "state",
                "Neutral",
            )
            result["text"] = str(result.get("text") or "I'm here for you.")

            for key, default in (
                ("energy", 80),
                ("score", 50),
            ):
                try:
                    result[key] = max(
                        0,
                        min(100, int(result.get(key, default))),
                    )
                except (TypeError, ValueError):
                    result[key] = default

            valid_moods = {
                "Happy",
                "Calm",
                "Focused",
                "Excited",
                "Thoughtful",
                "Empathetic",
            }
            if result["mood"] not in valid_moods:
                result["mood"] = "Calm"

            return result

        except Exception as e:
            logger.exception("Groq coach response generation failed: %s", e)
            return self._get_default_analysis()

    def analyze_mental_health(
        self,
        transcript: str,
        tone_context: str = "",
        preferred_language: str | None = None,
    ) -> dict[str, Any]:
        """
        Provide a structured coaching analysis for a transcript.

        This preserves the public helper API used elsewhere in the project.
        It does not constitute a clinical diagnosis.
        """
        effective_context = tone_context

        if preferred_language:
            effective_context = (
                f"{tone_context}\nPreferred response language: {preferred_language}".strip()
            )

        emotion = self.analyze_user_emotion(
            transcript,
            effective_context,
        )

        return self.generate_coach_response(
            message=transcript,
            tone_context=effective_context,
            user_emotion=emotion,
        )

    # ─── Voice Generation ───

    def generate_voice_response(
        self,
        text: str,
        filename: str,
        _language: str = "en",
    ) -> str | None:
        """Generate and save speech using the ElevenLabs 2.x SDK."""
        api_key = getattr(settings, "ELEVENLABS_API_KEY", None) or os.getenv("ELEVENLABS_API_KEY")

        if not api_key:
            logger.warning("ELEVENLABS_API_KEY is not configured; voice generation skipped.")
            return None

        if not text or not text.strip():
            logger.info("No text provided for voice generation.")
            return None

        voice_id = getattr(settings, "ELEVENLABS_VOICE_ID", None) or os.getenv(
            "ELEVENLABS_VOICE_ID"
        )

        if not voice_id:
            logger.warning("ELEVENLABS_VOICE_ID is not configured; voice generation skipped.")
            return None

        model_id = (
            getattr(settings, "ELEVENLABS_MODEL_ID", None)
            or os.getenv("ELEVENLABS_MODEL_ID")
            or DEFAULT_ELEVENLABS_MODEL
        )

        # Avoid allowing user-provided path components in the output filename.
        safe_filename = os.path.basename(filename).strip()

        if not safe_filename or safe_filename in {".", ".."}:
            logger.error("Invalid filename supplied for voice generation.")
            return None

        # This method receives a filename stem; remove an optional extension.
        if safe_filename.lower().endswith(".mp3"):
            safe_filename = safe_filename[:-4]

        try:
            from elevenlabs.client import ElevenLabs

            client = ElevenLabs(api_key=api_key)

            audio_chunks = client.text_to_speech.convert(
                voice_id=voice_id,
                text=text,
                model_id=model_id,
                output_format="mp3_44100_128",
            )

            output_dir = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                "static",
                "audio",
            )

            output_path = os.path.join(
                output_dir,
                f"{safe_filename}.mp3",
            )

            with open(output_path, "wb") as audio_file:
                for chunk in audio_chunks:
                    if chunk:
                        audio_file.write(chunk)

            if not os.path.isfile(output_path):
                logger.error("ElevenLabs completed without creating an audio file.")
                return None

            if os.path.getsize(output_path) == 0:
                logger.error("ElevenLabs returned an empty audio file.")
                os.unlink(output_path)
                return None

            return f"/audio/{safe_filename}.mp3"

        except Exception as e:
            logger.exception("ElevenLabs synthesis failed: %s", e)
            self._handle_elevenlabs_error(e)
            return None

    # ─── Transcription ───

    def transcribe_audio(
        self,
        audio_file_path: str,
        preferred_language: str | None = None,
    ) -> dict[str, Any]:
        """Preprocess audio, transcribe chunks, and combine their results."""
        if not self.client:
            return {
                "text": "",
                "confidence": 0,
                "segments": [],
                "duration": 0,
            }

        preprocessed_path = None

        try:
            preprocessed_path = self._preprocess_audio(audio_file_path)
            audio = AudioSegment.from_file(preprocessed_path)
            chunks = self._chunk_audio(audio)
            results = []

            for chunk in chunks:
                chunk_path = self._create_temp_wav(chunk)

                try:
                    result = self._transcribe_chunk(
                        chunk_path,
                        preferred_language,
                    )
                    results.append(result)
                finally:
                    if os.path.exists(chunk_path):
                        os.unlink(chunk_path)

            response = self._combine_transcriptions(results)
            response["duration"] = audio.duration_seconds

            return response

        except Exception as e:
            logger.exception("Transcription error: %s", e)
            return {
                "text": "",
                "confidence": 0,
                "segments": [],
                "duration": 0,
            }

        finally:
            if preprocessed_path and os.path.exists(preprocessed_path):
                os.unlink(preprocessed_path)

    # ─── Fallbacks and Error Handling ───

    @staticmethod
    def _get_default_analysis() -> dict[str, Any]:
        return {
            "text": ("I'm here for you. Tell me more about how you're feeling."),
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
        error_msg = str(error).lower()

        if (
            "free users cannot use library voices" in error_msg
            or "voice not available" in error_msg
        ):
            logger.warning("ElevenLabs voice access may be restricted for this account.")
        elif (
            "invalid api key" in error_msg
            or "unauthorized" in error_msg
            or "authentication" in error_msg
        ):
            logger.error("ElevenLabs API authentication failed.")
        else:
            logger.debug("ElevenLabs error details: %s", error)


# Global AI service instance
ai_service = AIService()


# ─── Convenience Functions ───


def analyze_mental_health(
    transcript: str,
    tone_context: str = "",
    preferred_language: str | None = None,
) -> dict[str, Any]:
    return ai_service.analyze_mental_health(
        transcript,
        tone_context,
        preferred_language,
    )


def generate_voice_response(
    text: str,
    filename: str,
    language: str = "en",
) -> str | None:
    return ai_service.generate_voice_response(
        text,
        filename,
        language,
    )


def transcribe_audio(audio_file_path: str) -> dict[str, Any]:
    return ai_service.transcribe_audio(audio_file_path)
