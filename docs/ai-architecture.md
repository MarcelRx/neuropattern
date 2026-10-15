# AI Architecture

## Actual AI Providers and Their Responsibilities

NeuroPattern integrates with two primary AI providers:

### Groq API

**Responsibilities:**
- Speech-to-text transcription (Whisper-large-v3 model)
- Language detection from audio
- Emotion analysis from text and vocal context
- Response generation for AI coach (Llama-3.3-70b-specdec model)

**Configuration:**
- API Key: `GROQ_API_KEY` environment variable
- LLM Model: `GROQ_MODEL` environment variable (default: `llama-3.3-70b-specdec`)
- STT Model: Hardcoded to `whisper-large-v3`

### ElevenLabs API

**Responsibilities:**
- Text-to-speech synthesis
- Multi-language voice generation
- Audio file creation for coach responses

**Configuration:**
- API Key: `ELEVENLABS_API_KEY` environment variable
- Voice ID: `ELEVENLABS_VOICE_ID` environment variable (default: `BpjGufoPiobT79j2vtj4`)
- Model ID: `ELEVENLABS_MODEL_ID` environment variable (default: `eleven_multilingual_v2`)

## Model Names and Configuration Sources

### Groq Models

**LLM Model:**
- Name: `llama-3.3-70b-specdec`
- Purpose: Emotion analysis and response generation
- Configuration: `GROQ_MODEL` environment variable
- Default: `llama-3.3-70b-specdec`
- Source: Environment variable or fallback in `backend/app/api/core/config.py`

**STT Model:**
- Name: `whisper-large-v3`
- Purpose: Speech-to-text transcription
- Configuration: Hardcoded in `backend/app/api/v1/endpoints/coach.py`
- Source: `WHISPER_MODEL = "whisper-large-v3"` constant

### ElevenLabs Models

**TTS Model:**
- Name: `eleven_multilingual_v2`
- Purpose: Text-to-speech synthesis
- Configuration: `ELEVENLABS_MODEL_ID` environment variable
- Default: `eleven_multilingual_v2`
- Source: Environment variable or fallback in `backend/app/api/services/ai_service.py`

**Voice:**
- Name: Configurable voice ID
- Purpose: Voice selection for TTS
- Configuration: `ELEVENLABS_VOICE_ID` environment variable
- Default: `BpjGufoPiobT79j2vtj4`
- Source: Environment variable or fallback

## LLM Request and Response Processing

### Emotion Analysis Flow

**Input:**
- User message text
- Optional vocal tone context (arousal, valence, pitch trend)

**Request:**
```python
prompt = f"""Analyze the emotional state of the user based on their message and vocal tone context.
Return ONLY a JSON object with:
- "state": ONE of [Happy, Excited, Frustrated, Confused, Stressed, Curious, Sad, Neutral]
- "confidence": 0-1
- "arousal": 0-1 (energy level)
- "valence": 0-1 (positive vs negative)

User message: "{message}"
Tone context: {tone_context}"""
```

**Groq API Call:**
```python
completion = self.client.chat.completions.create(
    model=settings.GROQ_MODEL,
    messages=[
        {"role": "system", "content": "You are an expert emotion analyst. Return only valid JSON."},
        {"role": "user", "content": prompt}
    ],
    response_format={"type": "json_object"},
    temperature=0.1,
    max_tokens=150
)
```

**Response Processing:**
```python
result = json.loads(completion.choices[0].message.content)
# Returns: {"state": "Happy", "confidence": 0.85, "arousal": 0.7, "valence": 0.8}
```

**Error Handling:**
- On failure: Returns default neutral emotion
- Logs error for debugging
- Does not fail the request

### Response Generation Flow

**Input:**
- User message
- Detected emotion (from emotion analysis)
- Optional conversation history (last 3 turns)
- Vocal tone context

**System Prompt Construction:**
- Base prompt: Professional, empathetic coach persona
- Adaptive instructions: Added based on detected emotion
- Language preservation: Instructions to respond in detected language

**Request:**
```python
messages = [
    {"role": "system", "content": adaptive_prompt},
    {"role": "user", "content": user_prompt}
]

completion = self.client.chat.completions.create(
    model=settings.GROQ_MODEL,
    messages=messages,
    response_format={"type": "json_object"},
    temperature=0.7
)
```

**Response Processing:**
```python
result = json.loads(completion.choices[0].message.content)
# Ensures all required fields exist with defaults
result["timestamp"] = datetime.now(timezone.utc).isoformat()
result["voice_enabled"] = True
result["language"] = result.get("language", "en")
result["energy"] = max(0, min(100, int(result.get("energy", 80))))
result["mood"] = result.get("mood", "Calm")
result["score"] = max(0, min(100, int(result.get("score", 50))))
result["user_emotion"] = user_emotion.get("state", "Neutral")
result["text"] = result.get("text", "I'm here for you.")
```

**Error Handling:**
- On failure: Returns default response
- Logs error for debugging
- Graceful degradation to prevent request failure

## Speech-to-Text and Text-to-Speech Flows

### Speech-to-Text (Groq Whisper)

**Input:**
- Audio file path (WebM, MP3, WAV)
- Optional preferred language

**Preprocessing:**
1. Load audio with pydub
2. Convert to 16kHz mono
3. Normalize audio level
4. Trim silence
5. Chunk audio if >30 seconds

**Transcription Request:**
```python
result = self.client.audio.transcriptions.create(
    file=(chunk_path, audio_file.read()),
    model="whisper-large-v3",
    response_format="verbose_json",
    prompt=self._build_transcription_prompt(preferred_language),
    temperature=0.0,
)
```

**Response Processing:**
```python
{
    "text": "Transcribed text",
    "confidence": 0.95,
    "segments": [...],
    "language": "en",
    "language_confidence": 0.92
}
```

**Language Detection:**
- Automatically detected by Whisper
- Confidence score provided
- Fallback to preferred language if confidence low

**Error Handling:**
- On failure: Returns empty transcription with 0 confidence
- Logs error for debugging
- Does not fail the request

### Text-to-Speech (ElevenLabs)

**Input:**
- Response text
- Filename for output
- Detected language

**Request:**
```python
audio = generate(
    api_key=settings.ELEVENLABS_API_KEY,
    text=text,
    voice=voice_id,
    model=model_id
)
```

**Response Processing:**
1. Save audio to `static/audio/{filename}.mp3`
2. Return URL: `/audio/{filename}.mp3`
3. Audio served via static file endpoint

**Language Handling:**
- ElevenLabs multilingual v2 handles language automatically
- No explicit language parameter required
- Voice selection determines language support

**Error Handling:**
- On failure: Returns None (no audio URL)
- Chat continues without audio
- Logs error for debugging
- Frontend can fallback to browser TTS

## Voice Analysis and Emotional-Signal Processing

### Client-Side Voice Analysis

The frontend performs initial voice analysis before sending to backend:

**Location:** `src/core/VoiceProcessor.ts`

**Analysis Performed:**
- Average volume calculation
- Peak volume detection
- Silence ratio calculation
- Clipping detection
- Energy variance calculation
- Pitch trend analysis (rising, falling, stable)
- Speech rate calculation (words per minute)
- Emotional tone estimation (arousal, valence)

**Quality Report:**
```typescript
{
  averageVolume: number,
  peakVolume: number,
  silenceRatio: number,
  duration: number,
  isClear: boolean,
  issues: string[],
  energyVariance?: number,
  pitchTrend?: "rising" | "falling" | "stable",
  speechRate?: number,
  emotionalTone?: {
    arousal: number,
    valence: number
  }
}
```

### Backend Tone Context Construction

The backend converts quality report into text context for AI:

**Conversion Logic:**
```python
tone_context = ""
if arousal > 0.7:
    tone_context += " User sounds highly energized, potentially excited or intense. "
elif arousal < 0.3:
    tone_context += " User sounds low energy, subdued, or potentially weary. "

if valence > 0.7:
    tone_context += " Vocal tone radiates positivity and warmth. "
elif valence < 0.3:
    tone_context += " Vocal tone suggests distress, stress, or a heavy emotional weight. "

if pitch_trend == "rising":
    tone_context += " There's a rising pitch at the end, suggesting a question or uncertainty. "
elif pitch_trend == "falling":
    tone_context += " There's a falling pitch, suggesting finality or a somber tone. "
```

### AI Emotion Adaptation

The AI adapts its response based on detected emotion:

**Stressed/Frustrated:**
- Be extra calm, grounding, and reassuring
- Use shorter sentences
- Validate feelings

**Happy/Excited:**
- Match energy with warmth and enthusiasm
- Celebrate with user

**Confused:**
- Be patient, clear, and structured
- Break complex ideas into simple steps

**Sad:**
- Be deeply empathetic, gentle, and supportive
- Avoid toxic positivity
- Just be present

## Language Detection and Multilingual Behavior

### Language Detection Sources

**Priority Order:**
1. Whisper language detection from audio
2. LLM language detection from text
3. User preference (not currently implemented)
4. Default to English

### Language Detection Implementation

**From Audio (Whisper):**
- Automatically detected by Whisper-large-v3
- Returns ISO 639-1 language code (e.g., "en", "sv", "ar")
- Provides confidence score
- Supports 100+ languages

**From Text (LLM):**
- LLM analyzes text and detects language
- Returns ISO 639-1 code in response
- Lower confidence than audio detection

### Multilingual Response Behavior

**System Prompt Instructions:**
```
You are a native speaker of over 100 languages (English, Swedish, Arabic, German, French, Spanish, Italian, Turkish, etc.).
You must respond in the EXACT language the user is currently using.
If a user switches languages mid-conversation, you must adapt instantly and seamlessly without mentioning the change.
Understand mixed-language inputs.
```

**Implementation:**
- Detected language passed to LLM in prompt
- LLM instructed to respond in detected language
- Response includes language field for verification
- TTS uses detected language for voice generation

**RTL Language Support:**
- Frontend handles RTL layout for Arabic, Hebrew, etc.
- Unicode helper utilities for text normalization
- No special LLM handling required

## Prompt Construction and Output Validation

### System Prompt Construction

**Base Persona:**
- Professional, intelligent, empathetic AI companion
- Named "Aura"
- Soulful, sophisticated presence
- Wise, calm, and professional yet friendly

**Voice Instructions:**
- Natural rhythm
- Expressive, contextual language
- Avoid corporate or clinical jargon
- Safe harbor for hurting users
- Biggest cheerleader for winning users

**Multilingual Instructions:**
- Native speaker of 100+ languages
- Respond in exact language user is using
- Adapt instantly to language switches
- Maintain warmth across all languages
- Use appropriate cultural nuances

**Conversational Style:**
- Concise when appropriate (2-4 sentences for voice)
- Detailed when topic requires depth
- Use user's name warmly but not excessively
- Ask one thoughtful follow-up question
- Prioritize emotion behind words

**Vocal Awareness:**
- Provided with user vocal tone data
- Adjust style based on emotional state
- Match energy for positive users
- Slow pace for stressed users
- Be patient for confused users
- Be soft for sad users

### Output Validation

**Required Fields:**
```python
{
    "text": str,              # Response text
    "language": str,          # ISO 639-1 code
    "energy": int (0-100),    # Confidence/enthusiasm
    "mood": str,              # One of: Happy, Calm, Focused, Excited, Thoughtful, Empathetic
    "score": int (0-100),     # Wellness score
    "user_emotion": str,      # Detected user emotion
    "voice_enabled": bool,    # Always true
    "summary": str,           # Internal summary
    "timestamp": str          # ISO timestamp
}
```

**Validation Logic:**
```python
res["energy"] = max(0, min(100, int(res.get("energy", 80))))
res["mood"] = res.get("mood", "Calm")
res["score"] = max(0, min(100, int(res.get("score", 50))))
res["text"] = res.get("text", "I'm here for you.")
```

**Default Values:**
- If any field missing: Use sensible default
- If parsing fails: Return default response
- Never return invalid or incomplete response

## Data Passed to External Providers and Privacy Considerations

### Data Sent to Groq

**Speech-to-Text:**
- Audio file (WebM/MP3/WAV)
- Optional preferred language
- Transcription prompt

**Emotion Analysis:**
- User message text
- Vocal tone context (arousal, valence, pitch trend)

**Response Generation:**
- User message text
- Detected emotion
- Conversation history (last 3 turns)
- Vocal tone context
- System prompt

### Data Sent to ElevenLabs

**Text-to-Speech:**
- Response text
- Voice ID
- Model ID

### Privacy Considerations

**Data Retention:**
- Groq: No explicit retention policy stated
- ElevenLabs: No explicit retention policy stated
- Application: Audio files stored locally in `static/audio/`

**Data Sensitivity:**
- User messages may contain personal mental health information
- Voice recordings may contain identifying information
- No encryption in transit (HTTPS recommended for production)

**Recommendations:**
1. Review Groq and ElevenLabs privacy policies
2. Implement HTTPS for all API calls
3. Consider data anonymization
4. Implement audio file cleanup (TTL)
5. Add privacy policy to application
6. Obtain user consent for AI processing

## Timeouts, Retries, Rate Limits, and Provider-Error Handling

### Timeouts

**Current Implementation:**
- No explicit timeout configuration
- Relies on default HTTP client timeouts
- Groq: Default timeout (~60 seconds)
- ElevenLabs: Default timeout (~30 seconds)

**Recommended:**
- Configure explicit timeouts
- STT: 120 seconds (audio can be long)
- LLM: 30 seconds (response generation)
- TTS: 30 seconds (audio generation)

### Retries

**Current Implementation:**
- No retry logic implemented
- Single attempt per operation
- Immediate failure on error

**Recommended:**
- Implement exponential backoff retry
- Max 3 retries for transient errors
- Retry on: 503, 504, 429 (rate limit)
- No retry on: 400, 401, 403, 404

### Rate Limits

**Current Implementation:**
- No rate limiting implemented
- No rate limit handling
- May hit provider limits under load

**Provider Limits:**
- Groq: Rate limits based on plan
- ElevenLabs: Rate limits based on plan

**Recommended:**
- Implement client-side rate limiting
- Cache responses where appropriate
- Monitor rate limit headers
- Queue requests if hitting limits

### Error Handling

**Groq Errors:**
- Authentication failure: Returns 500 error
- Rate limit exceeded: Returns 500 error
- Invalid request: Returns 500 error
- Network error: Returns 500 error

**ElevenLabs Errors:**
- Authentication failure: Returns None (no audio)
- Rate limit exceeded: Returns None (no audio)
- Invalid request: Returns None (no audio)
- Network error: Returns None (no audio)

**Graceful Degradation:**
- TTS failure: Chat continues without audio
- STT failure: Returns empty transcription
- LLM failure: Returns default response
- Application remains functional

## Authentication and Secret Configuration for Providers

### Groq Authentication

**Configuration:**
- Environment variable: `GROQ_API_KEY`
- Fallback: Check at runtime
- Source: `backend/app/api/core/config.py`

**Usage:**
```python
from groq import Groq
client = Groq(api_key=settings.GROQ_API_KEY)
```

**Secret Management:**
- Loaded from environment variables
- Not hardcoded in application
- Stored in `.env` file (excluded from git)
- Setup script generates placeholder

### ElevenLabs Authentication

**Configuration:**
- Environment variable: `ELEVENLABS_API_KEY`
- Fallback: Check at runtime
- Source: `backend/app/api/core/config.py`

**Usage:**
```python
from elevenlabs import generate
audio = generate(
    api_key=settings.ELEVENLABS_API_KEY,
    text=text,
    voice=voice_id,
    model=model_id
)
```

**Secret Management:**
- Loaded from environment variables
- Not hardcoded in application
- Stored in `.env` file (excluded from git)
- Setup script generates placeholder

## Mocking and Testing of AI Integrations

### Current Testing

**No AI Integration Tests:**
- No unit tests for AI service
- No integration tests for Groq
- No integration tests for ElevenLabs
- No mocked responses
- Tests use real API calls (if keys available)

### Recommended Testing Strategy

**Unit Tests:**
- Mock Groq client
- Mock ElevenLabs client
- Test prompt construction
- Test response parsing
- Test error handling
- Test default responses

**Integration Tests:**
- Use test API keys
- Test actual API calls
- Test rate limit handling
- Test timeout behavior
- Test authentication failures

**End-to-End Tests:**
- Test complete chat flow
- Test voice check-in flow
- Test TTS fallback
- Test multilingual behavior

### Mocking Example

```python
from unittest.mock import Mock, patch

@patch('app.api.services.ai_service.Groq')
def test_emotion_analysis(mock_groq):
    mock_client = Mock()
    mock_groq.return_value = mock_client
    mock_completion = Mock()
    mock_completion.choices[0].message.content = '{"state": "Happy", "confidence": 0.9, "arousal": 0.7, "valence": 0.8}'
    mock_client.chat.completions.create.return_value = mock_completion

    result = ai_service.analyze_user_emotion("I'm feeling great!")
    assert result["state"] == "Happy"
```

## Known Limitations, Operational Dependencies, and Future Improvements

### Known Limitations

**1. No Retry Logic:**
- Single attempt per operation
- Fails immediately on transient errors
- No exponential backoff

**2. No Rate Limiting:**
- No client-side rate limiting
- May hit provider limits
- No queue for throttled requests

**3. No Timeouts:**
- Relies on default HTTP timeouts
- Long audio may timeout
- No timeout configuration

**4. No Caching:**
- No response caching
- Repeated requests hit API
- Wastes API quota

**5. No Fallback Models:**
- Single model per provider
- No fallback if model unavailable
- No model selection logic

**6. Audio Storage:**
- Audio files stored locally
- No replication across servers
- No CDN for delivery
- No cleanup mechanism

**7. Privacy Gaps:**
- No data anonymization
- No encryption at rest
- No explicit data retention policy
- No user consent flow

### Operational Dependencies

**Required for Operation:**
- Groq API key (required for all AI features)
- ElevenLabs API key (required for TTS)
- Network access to Groq API
- Network access to ElevenLabs API
- ffmpeg binary (for audio processing)

**Optional:**
- SMTP server (for email notifications)
- MongoDB (for data persistence)

**Degrades Gracefully Without:**
- ElevenLabs: Chat continues without audio
- SMTP: Registration succeeds without email
- MongoDB: Application fails (required)

### Future Improvements

**High Priority:**
1. Implement retry logic with exponential backoff
2. Add client-side rate limiting
3. Configure explicit timeouts
4. Implement response caching
5. Add audio file cleanup (TTL)

**Medium Priority:**
6. Add fallback models (e.g., OpenAI if Groq fails)
7. Implement CDN for audio delivery
8. Add data anonymization
9. Implement encryption at rest
10. Add user consent flow

**Low Priority:**
11. Add model selection logic
12. Implement cost monitoring
13. Add usage analytics
14. Implement A/B testing for prompts
15. Add custom fine-tuned models
