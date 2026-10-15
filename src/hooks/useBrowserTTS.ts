import { useState, useEffect, useCallback, useRef } from 'react';

interface UseBrowserTTSReturn {
  /** Speak the given text using the browser's Speech Synthesis API */
  speak: (text: string) => void;
  /** Stop any currently playing speech */
  stop: () => void;
  /** Whether the browser supports speech synthesis */
  isSupported: boolean;
  /** Whether speech is currently playing */
  isSpeaking: boolean;
  /** Currently selected voice */
  voice: SpeechSynthesisVoice | null;
  /** Available voices */
  voices: SpeechSynthesisVoice[];
  /** Change the active voice */
  setVoice: (voice: SpeechSynthesisVoice) => void;
  /** Speech rate (0.1 - 10, default 1) */
  rate: number;
  /** Set speech rate */
  setRate: (rate: number) => void;
  /** Speech pitch (0 - 2, default 1) */
  pitch: number;
  /** Set speech pitch */
  setPitch: (pitch: number) => void;
}

/**
 * React hook for browser-native Text-to-Speech (Web Speech API).
 * Falls back gracefully when the API is unavailable.
 */
export function useBrowserTTS(): UseBrowserTTSReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const synth = window.speechSynthesis;
    if (!synth) {
      setIsSupported(false);
      return;
    }

    synthRef.current = synth;
    setIsSupported(true);

    const loadVoices = () => {
      const availableVoices = synth.getVoices();
      setVoices(availableVoices);

      // Prefer a natural-sounding English voice, fallback to default
      const preferred =
        availableVoices.find((v) => v.name.includes('Google US English')) ||
        availableVoices.find((v) => v.name.includes('Samantha')) ||
        availableVoices.find((v) => v.name.includes('Microsoft Zira')) ||
        availableVoices.find((v) => v.lang.startsWith('en') && v.default) ||
        availableVoices[0];

      if (preferred) setVoice(preferred);
    };

    loadVoices();

    // Chrome loads voices asynchronously
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }

    return () => {
      synth.cancel();
      synth.onvoiceschanged = null;
    };
  }, []);

  const stop = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsSpeaking(false);
    utteranceRef.current = null;
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!synthRef.current || !isSupported) return;

      // Stop any ongoing speech first
      synthRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;

      if (voice) utterance.voice = voice;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = 1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (event) => {
        // "canceled" is expected when we call .cancel()
        if (event.error !== 'canceled') {
          console.error('Browser TTS error:', event.error);
        }
        setIsSpeaking(false);
      };

      synthRef.current.speak(utterance);
    },
    [isSupported, voice, rate, pitch]
  );

  return {
    speak,
    stop,
    isSupported,
    isSpeaking,
    voice,
    voices,
    setVoice,
    rate,
    setRate,
    pitch,
    setPitch,
  };
}