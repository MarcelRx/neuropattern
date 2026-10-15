import { ChatContext, CoachResponse } from "../types/CoachTypes";
import { ICoachProvider } from "../types/ProviderTypes";
import { AudioQualityReport, VoiceProcessingResult } from "../types/VoiceTypes";
import { LanguageDetector } from "./LanguageDetector";
import { ResponseGenerator } from "./ResponseGenerator";
import { TTSEngine } from "./TTSEngine";
import { VoiceProcessor } from "./VoiceProcessor";

export interface AuraCoachOptions {
  voiceProcessor?: VoiceProcessor;
  languageDetector?: LanguageDetector;
  coachProvider?: ICoachProvider;
  responseGenerator?: ICoachProvider;
  ttsEngine?: TTSEngine;
}

const MIN_ACCEPTABLE_CONFIDENCE = 0.55;
const MIN_LANGUAGE_CONFIDENCE = 0.68;

export class AuraCoach {
  private voiceProcessor: VoiceProcessor;
  private languageDetector: LanguageDetector;
  private coachProvider: ICoachProvider;
  private ttsEngine: TTSEngine;
  private preferredLanguage = "en";
  private languageCache = new Map<string, string>();

  constructor(options?: AuraCoachOptions) {
    this.voiceProcessor = options?.voiceProcessor ?? new VoiceProcessor();
    this.languageDetector = options?.languageDetector ?? new LanguageDetector({ defaultLanguage: "en" });
    this.coachProvider =
      options?.coachProvider ??
      options?.responseGenerator ??
      new ResponseGenerator();
    this.ttsEngine = options?.ttsEngine ?? new TTSEngine({ useBrowserVoice: true });
  }

  public setPreferServerVoice(preferServer: boolean) {
    this.ttsEngine = new TTSEngine({ useBrowserVoice: !preferServer });
  }

  /**
   * Stop any currently playing audio (ElevenLabs or Browser TTS).
   */
  public stopAudio(): void {
    this.ttsEngine.stop();
  }

  /**
   * Send text message. Auto-detects language and ALWAYS speaks the response.
   */
  public async sendTextMessage(
    message: string,
    context: ChatContext,
    generateVoice: boolean = true,
  ): Promise<CoachResponse> {
    const detection = this.languageDetector.detectFromText(message);

    // If language changed, stop any playing audio immediately
    if (detection.language !== this.preferredLanguage) {
      this.stopAudio();
    }

    this.preferredLanguage = detection.language;
    this.languageCache.set(message, detection.language);

    const response = await this.coachProvider.chat(
      message,
      context,
      this.preferredLanguage,
      generateVoice,
    );

    response.language = response.language || this.preferredLanguage;

    // ─── AUTO-PLAY: Every assistant response is spoken ───
    if (response.response) {
      await this.playCoachResponse(response.response, response.audioUrl);
    }

    return response;
  }

  /**
   * Process voice recording. Normalizes audio and speaks the AI response.
   */
  public async processVoiceMessage(
    audioBlob: Blob,
    qualityReport: AudioQualityReport,
  ): Promise<VoiceProcessingResult> {
    const trimmedAudio = await this.voiceProcessor.trimSilence(audioBlob);
    const normalizedAudio = await this.voiceProcessor.normalizeAudio(trimmedAudio);

    const chunks =
      normalizedAudio.size > 1024 * 1024 * 5
        ? await this.voiceProcessor.chunkAudio(normalizedAudio)
        : [normalizedAudio];

    const primaryAudio = chunks[0] ?? normalizedAudio;
    const result = await this.coachProvider.processVoice(
      primaryAudio,
      qualityReport,
      undefined,
    );

    const detection = this.languageDetector.detectFromAudio(
      result.transcription,
      {
        language: result.language,
        confidence: result.languageConfidence ?? 0.8,
      },
    );

    if (result.confidence < MIN_ACCEPTABLE_CONFIDENCE) {
      result.isClear = false;
      result.qualityIssues.push("low_confidence");
    }

    if (detection.confidence < MIN_LANGUAGE_CONFIDENCE) {
      result.isClear = false;
      result.qualityIssues.push("low_language_confidence");
      result.suggestedAction = result.suggestedAction || "confirm_language";
    }

    if (detection.confidence >= MIN_LANGUAGE_CONFIDENCE) {
      if (detection.language !== this.preferredLanguage) {
        this.stopAudio();
      }
      this.preferredLanguage = detection.language;
    }

    this.languageCache.set(result.transcription, this.preferredLanguage);
    result.language = this.preferredLanguage;
    result.languageConfidence = detection.confidence;

    // ─── AUTO-PLAY: Speak the voice response ───
    if (result.response) {
      await this.playCoachResponse(result.response, result.audioUrl);
    }

    return result;
  }

  /**
   * Play a coach response. Prefers ElevenLabs URL, falls back to Browser TTS.
   * Now waits for audio to fully finish before resolving.
   */
  public async playCoachResponse(
    responseText: string,
    audioUrl?: string,
  ): Promise<void> {
    if (audioUrl) {
      try {
        await this.ttsEngine.playAudio(audioUrl);
        return;
      } catch (err) {
        console.warn("[AuraCoach] ElevenLabs playback failed, falling back to browser TTS:", err);
      }
    }

    if (responseText) {
      const fallbackEngine = new TTSEngine({ useBrowserVoice: true });
      await fallbackEngine.speak(responseText, this.preferredLanguage);
    }
  }

  public async saveCheckIn(checkInData: {
    score: number;
    mood: string;
    summary: string;
    sentiment?: string;
    emotional_indicators?: string[];
    tone_analysis?: string;
  }): Promise<any> {
    return this.coachProvider.saveCheckIn(checkInData);
  }

  public getPreferredLanguage(): string {
    return this.preferredLanguage;
  }
}
