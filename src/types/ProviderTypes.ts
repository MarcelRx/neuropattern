import { ChatContext, CoachResponse } from "./CoachTypes";
import { AudioQualityReport, VoiceProcessingResult } from "./VoiceTypes";

export interface ICoachProvider {
  chat(
    message: string,
    context: ChatContext,
    language?: string,
    generateVoice?: boolean,
  ): Promise<CoachResponse>;

  processVoice(
    audioBlob: Blob,
    qualityReport?: AudioQualityReport,
    language?: string,
  ): Promise<VoiceProcessingResult>;

  saveCheckIn(checkInData: {
    score: number;
    mood: string;
    summary: string;
    sentiment?: string;
    emotional_indicators?: string[];
    tone_analysis?: string;
  }): Promise<any>;
}

export interface ITTSEngine {
  speak(text: string, language?: string): Promise<void>;
  playAudio(url: string): Promise<void>;
}
