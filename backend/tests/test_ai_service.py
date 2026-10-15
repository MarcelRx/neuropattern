"""
Tests for AI provider configuration failure handling.
"""

import os
from unittest.mock import Mock, patch

import pytest
from app.api.services.ai_service import AIService, STTError


def test_ai_service_warns_without_groq_key():
    """Test that AIService logs warning when GROQ_API_KEY is not configured."""
    # Ensure GROQ_API_KEY is not set
    if "GROQ_API_KEY" in os.environ:
        del os.environ["GROQ_API_KEY"]

    # Service should initialize but client will be None
    service = AIService()
    assert service.client is None


def test_ai_service_initializes_with_groq_key():
    """Test that AIService initializes successfully when GROQ_API_KEY is configured."""
    # Set a fake API key for testing
    os.environ["GROQ_API_KEY"] = "gsk_test_key_12345"

    try:
        service = AIService()
        assert service.client is not None
    finally:
        # Clean up
        if "GROQ_API_KEY" in os.environ:
            del os.environ["GROQ_API_KEY"]


def test_ai_service_handles_missing_elevenlabs_key(monkeypatch):
    """Voice generation returns None when the ElevenLabs API key is missing."""
    # Remove the key from both the environment and cached settings.
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
    monkeypatch.setattr(
        "app.api.services.ai_service.settings.ELEVENLABS_API_KEY",
        "",
    )

    # Provide a Groq key so service initialization remains independent.
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test_key_12345")

    service = AIService()
    result = service.generate_voice_response("Hello world", "test_file")

    assert result is None


def test_ai_service_returns_default_when_no_client():
    """Test that emotion analysis returns default values when client is not available."""
    service = AIService.__new__(AIService)
    service.client = None

    result = service.analyze_user_emotion("I'm feeling happy", "")

    assert result["state"] == "neutral"
    assert result["confidence"] == 0.5
    assert result["arousal"] == 0.5
    assert result["valence"] == 0.5


def test_ai_service_returns_default_on_transcription_error():
    """Test that transcription returns default values when client is not available."""
    service = AIService.__new__(AIService)
    service.client = None

    result = service.transcribe_audio("fake_audio_file.wav")

    assert result["text"] == ""
    assert result["confidence"] == 0
    assert result.get("segments", []) == []
    assert result.get("duration", 0) == 0


def test_ai_service_returns_default_on_response_generation_error():
    """Test that response generation returns default values when client is not available."""
    service = AIService.__new__(AIService)
    service.client = None

    result = service.generate_coach_response("Hello", "")

    assert result["text"] == "I'm here for you. Tell me more about how you're feeling."
    assert result["score"] == 50
    assert result["mood"] == "Calm"
    assert result["energy"] == 70
    assert result["language"] == "en"
    assert result["user_emotion"] == "Neutral"


def test_transcribe_chunk_raises_stt_error_on_groq_api_error():
    """Test that _transcribe_chunk converts Groq API errors to STTError."""
    os.environ["GROQ_API_KEY"] = "gsk_test_key_12345"

    try:
        service = AIService()
        # Mock the Groq client to raise an API error
        with patch.object(service.client.audio.transcriptions, "create") as mock_transcribe:
            from groq import APIError
            from httpx import Request

            # Create a mock request for the APIError
            mock_request = Request("POST", "https://api.groq.com/v1/audio/transcriptions")
            mock_transcribe.side_effect = APIError(
                message="API rate limit exceeded",
                request=mock_request,
                body=None,
            )

            with pytest.raises(STTError) as exc_info:
                service._transcribe_chunk("fake_file.wav", "en")
            assert "Groq Whisper transcription failed" in str(exc_info.value)
    finally:
        if "GROQ_API_KEY" in os.environ:
            del os.environ["GROQ_API_KEY"]


def test_transcribe_chunk_raises_stt_error_on_os_error():
    """Test that _transcribe_chunk converts OSError to STTError."""
    os.environ["GROQ_API_KEY"] = "gsk_test_key_12345"

    try:
        service = AIService()
        # Mock file read to raise OSError
        with patch("builtins.open", side_effect=OSError("File not found")):
            with pytest.raises(STTError) as exc_info:
                service._transcribe_chunk("fake_file.wav", "en")
            assert "Groq Whisper transcription failed" in str(exc_info.value)
    finally:
        if "GROQ_API_KEY" in os.environ:
            del os.environ["GROQ_API_KEY"]


def test_analyze_user_emotion_returns_fallback_on_groq_api_error():
    """Test that analyze_user_emotion returns fallback on Groq API errors."""
    os.environ["GROQ_API_KEY"] = "gsk_test_key_12345"

    try:
        service = AIService()
        # Mock the Groq client to raise an API error
        with patch.object(service.client.chat.completions, "create") as mock_completion:
            # Use a generic exception to simulate any API error
            mock_completion.side_effect = Exception("Connection failed")

            result = service.analyze_user_emotion("I'm feeling happy", "")

            assert result["state"] == "neutral"
            assert result["confidence"] == 0.5
            assert result["arousal"] == 0.5
            assert result["valence"] == 0.5
    finally:
        if "GROQ_API_KEY" in os.environ:
            del os.environ["GROQ_API_KEY"]


def test_analyze_user_emotion_returns_fallback_on_json_decode_error():
    """Test that analyze_user_emotion returns fallback on JSON decode errors."""
    os.environ["GROQ_API_KEY"] = "gsk_test_key_12345"

    try:
        service = AIService()
        # Mock the Groq client to return invalid JSON
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "invalid json"

        with patch.object(service.client.chat.completions, "create", return_value=mock_response):
            result = service.analyze_user_emotion("I'm feeling happy", "")

            assert result["state"] == "neutral"
            assert result["confidence"] == 0.5
            assert result["arousal"] == 0.5
            assert result["valence"] == 0.5
    finally:
        if "GROQ_API_KEY" in os.environ:
            del os.environ["GROQ_API_KEY"]
