/**
 * Core Type Definitions for NeuroPattern LifeTracker
 *
 * Naming Convention:
 * - Backend fields: snake_case (full_name, avatar_url)
 * - Frontend fields: camelCase (fullName, avatarUrl)
 * - API mapping handled in service layer
 */

export interface Habit {
  id: string;
  name: string;
  icon: string;
  goal: number;
  progress: number;
  currentValue: number;
  color: "primary" | "secondary" | "accent-purple" | "accent-orange";
  history: boolean[];
}

export interface LogEntry {
  id: string;
  time?: string;
  timestamp?: string | Date;
  title?: string;
  content?: string;
  tags?: string[];
  sentiment?: "positive" | "neutral" | "negative";
  type?: "voice" | "text";
  score?: number;
  mood?: string;
  summary?: string;
}

export interface UserStats {
  score: number;
  sleep: string;
  steps: string;
  mood: string;
}

export enum AppRoute {
  ONBOARDING = "/",
  AUTH = "/auth",
  FORGOT_PASSWORD = "/forgot-password",
  RESET_PASSWORD = "/reset-password",
  HOME = "/home",
  ANALYSIS = "/analysis",
  COACH = "/coach",
  PROFILE = "/profile",
  INSIGHTS = "/insights",
  HABITS = "/habits",
}

export interface VoiceProcessResult {
  transcription: string;
  confidence: number;
  isClear: boolean;
  qualityIssues: string[];
  suggestedAction?: string;
  duration: number;
  toneFeatures?: {
    energy_variance: number;
    pitch_trend: "rising" | "falling" | "stable";
    speech_rate: number;
    emotional_tone: {
      arousal: number;
      valence: number;
    };
  };
  analysis?: {
    score: number;
    mood: string;
    summary: string;
    sentiment: "positive" | "neutral" | "negative";
    emotional_indicators: string[];
    tone_analysis: string;
  };
  language?: string;
  languageConfidence?: number;
}

export interface ChatResponse {
  response: string;
  suggestedActions: Array<{
    label: string;
    action: string;
    type: string;
  }>;
  checkInData?: VoiceProcessResult["analysis"];
  audioUrl?: string;
}
