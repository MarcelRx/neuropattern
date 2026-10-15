import { coachService } from "../services/coach.service";
import { ChatContext, CoachResponse } from "../types/CoachTypes";
import { ICoachProvider } from "../types/ProviderTypes";
import { AudioQualityReport, VoiceProcessingResult } from "../types/VoiceTypes";

/**
 * ResponseGenerator builds and formats request payloads for the Aura backend.
 * It isolates network encoding and response transformation from the UI.
 */
export class ResponseGenerator implements ICoachProvider {
  public async chat(
    message: string,
    context: ChatContext,
    language?: string,
    generateVoice?: boolean,
  ): Promise<CoachResponse> {
    const raw = await coachService.chat(
      message,
      context,
      language,
      generateVoice ?? false,
    );
    return this.formatCoachResponse(raw, language);
  }

  public async processVoice(
    audioBlob: Blob,
    qualityReport?: AudioQualityReport,
    language?: string,
  ): Promise<VoiceProcessingResult> {
    return coachService.processVoice(audioBlob, qualityReport, language);
  }

  public async saveCheckIn(checkInData: {
    score: number;
    mood: string;
    summary: string;
    sentiment?: string;
    emotional_indicators?: string[];
    tone_analysis?: string;
  }): Promise<any> {
    return coachService.saveCheckIn(checkInData);
  }

  private formatCoachResponse(raw: any, language?: string): CoachResponse {
    return {
      response: raw.response || "",
      suggestedActions: raw.suggestedActions || [],
      checkInData: raw.checkInData,
      audioUrl: raw.audioUrl,
      language: language || raw.language || "en",
    };
  }
}
