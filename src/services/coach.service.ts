/**
 * Coach API service.
 * Keeps AI check-in interactions, voice uploads and coaching APIs isolated from components.
 */
import { API_CONFIG } from "../constants/api";
import { VoiceProcessResult } from "../types";
import { ChatContext } from "../types/CoachTypes";
import { getAuthHeaders, getMultipartAuthHeaders } from "./auth.service";

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

const buildUrl = (path: string): string => `${API_CONFIG.BASE_URL}${path}`;

const handleResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();

  if (!response.ok) {
    const data = text ? JSON.parse(text) : {};
    throw new Error(
      (data?.detail as string) || response.statusText || "Coach service failed",
    );
  }

  return text ? JSON.parse(text) : ({} as T);
};

export const coachService = {
  async chat(
    message: string,
    context: ChatContext,
    language?: string,
    generateVoice: boolean = false,
  ) {
    const payload = {
      message,
      context,
      generateVoice,
      language,
    };

    const response = await fetch(buildUrl("/coach/chat"), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    return handleResponse<any>(response);
  },

  async processVoice(
    audioBlob: Blob,
    qualityReport?: AudioQualityReport,
    language?: string,
  ): Promise<VoiceProcessResult> {
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");
    if (qualityReport) {
      formData.append("quality_report", JSON.stringify(qualityReport));
    }
    if (language) {
      formData.append("preferred_language", language);
    }

    const response = await fetch(buildUrl("/coach/voice"), {
      method: "POST",
      headers: getMultipartAuthHeaders(),
      body: formData,
    });

    return handleResponse<VoiceProcessResult>(response);
  },

  async saveCheckIn(checkInData: {
    score: number;
    mood: string;
    summary: string;
    sentiment?: string;
    emotional_indicators?: string[];
    tone_analysis?: string;
  }) {
    const response = await fetch(buildUrl("/coach/checkin"), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(checkInData),
    });

    return handleResponse<any>(response);
  },
};
