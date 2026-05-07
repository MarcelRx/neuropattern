import os
import json
from groq import Groq
from elevenlabs import generate, save
from dotenv import load_dotenv

load_dotenv()

# Initialize Groq client
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in environment variables")

client = Groq(api_key=GROQ_API_KEY)

def analyze_mental_health(transcript: str):
    """
    Analyze mental health from user transcript using Groq LLM.
    Returns JSON with score, mood, summary, and sentiment.
    """
    prompt = f"""Analyze this user check-in: "{transcript}". 
    Return ONLY a JSON object with: "score" (0-100), "mood" (string), "summary" (short text), "sentiment" (string)."""
    
    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return json.loads(completion.choices[0].message.content)
    except Exception as e:
        print(f"Groq Error: {e}")
        return {
            "score": 50, 
            "mood": "Neutral", 
            "summary": "I'm listening.", 
            "sentiment": "neutral"
        }

def generate_voice_response(text: str, filename: str):
    """
    Generate voice response using ElevenLabs API.
    Returns URL path to the generated audio file.
    """
    if not ELEVENLABS_API_KEY:
        print("ElevenLabs API key not configured")
        return None
        
    try:
        audio = generate(
            api_key=ELEVENLABS_API_KEY,
            text=text,
            voice=ELEVENLABS_VOICE_ID,
            model="eleven_multilingual_v2"
        )
        output_path = f"static/audio/{filename}.mp3"
        save(audio, output_path)
        return f"/audio/{filename}.mp3"
    except Exception as e:
        print(f"ElevenLabs Error: {e}")
        return None