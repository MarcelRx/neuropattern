/**
 * Core Type Definitions for NeuroPattern LifeTracker
 *
 * Naming Convention:
 * - Backend fields: snake_case (full_name, avatar_url)
 * - Frontend fields: camelCase (fullName, avatarUrl)
 * - API mapping handled in service layer
 */

// ─── Habit Types ───

export interface Habit {
  id: string;
  name: string;
  icon: string;
  goal: number; // Backend sends number (e.g., 7 for weekly goal)
  progress: number; // 0-100 percentage
  currentValue: number; // Completed count (e.g., 5 out of 7)
  color: "primary" | "secondary" | "accent-purple" | "accent-orange";
  history: boolean[]; // Last 7 days heatmap
}

// ─── Log Types ───

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

/** @deprecated Use Log interface from AppContext instead */
export interface UserStats {
  score: number;
  sleep: string;
  steps: string;
  mood: string;
}

// ─── Route Definitions ───

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

// ─── API Response Types ───

export interface VoiceProcessResult {
  transcription: string;
  confidence: number;
  isClear: boolean;
  qualityIssues: string[];
  suggestedAction?: string;
  duration: number; // Audio duration in seconds
  toneFeatures: {
    energy_variance: number;
    pitch_trend: "rising" | "falling" | "stable";
    speech_rate: number;
    emotional_tone: {
      arousal: number; // 0-1 (calm vs excited)
      valence: number; // 0-1 (negative vs positive)
    };
  };
  analysis: {
    score: number; // 0-100 life quality score
    mood: string; // Primary emotional state
    summary: string; // Brief empathetic reflection
    sentiment: "positive" | "neutral" | "negative";
    emotional_indicators: string[];
    tone_analysis: string;
  };
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
