export interface AudioQualityReport {
  averageVolume: number;
  peakVolume: number;
  silenceRatio: number;
  duration: number;
  isClear: boolean;
  issues: string[];
  energyVariance?: number;
  pitchTrend?: "rising" | "falling" | "stable";
  speechRate?: number;
  emotionalTone?: {
    arousal: number;
    valence: number;
  };
}

export interface LanguageDetectionResult {
  language: string;
  isRTL: boolean;
  source: "text" | "audio" | "preferred";
  confidence: number;
}

export interface VoiceProcessingResult {
  transcription: string;
  confidence: number;
  isClear: boolean;
  qualityIssues: string[];
  suggestedAction?: string;
  duration: number;
  toneFeatures?: {
    energy_variance?: number;
    pitch_trend?: "rising" | "falling" | "stable";
    speech_rate?: number;
    emotional_tone?: {
      arousal: number;
      valence: number;
    };
  };
  analysis?: Record<string, unknown>;
  audioUrl?: string;
  language?: string;
  languageConfidence?: number;
  response?: string;
}
