import { LanguageDetectionResult } from "../types/VoiceTypes";
import { getDirection } from "../utils/UnicodeHelper";

export interface LanguageDetectorOptions {
  defaultLanguage?: string;
}

const LANGUAGE_KEYWORD_PATTERNS = [
  {
    code: "es",
    regex:
      /\b(?:que|para|como|porque|tú|usted|estoy|hola|gracias|adiós|mañana|noche|día)\b/gi,
  },
  {
    code: "fr",
    regex:
      /\b(?:je|tu|nous|vous|merci|bonjour|aujourd'hui|s'il vous plaît|bonne|soirée|très)\b/gi,
  },
  {
    code: "de",
    regex: /\b(?:die|der|und|ich|dass|ein|hallo|danke|morgen|guten|schön)\b/gi,
  },
  {
    code: "it",
    regex: /\b(?:questa|sono|grazie|ciao|oggi|come|perché|buongiorno|sera)\b/gi,
  },
  {
    code: "pt",
    regex: /\b(?:que|para|como|porque|obrigado|bom|dia|boa|tarde|noite)\b/gi,
  },
  {
    code: "tr",
    regex: /\b(?:merhaba|nasılsın|teşekkür|günaydın|iyi|bugün|çok)\b/gi,
  },
  {
    code: "nl",
    regex: /\b(?:hallo|dank|goed|morgen|avond|ja|nee|hoe|gaat)\b/gi,
  },
  {
    code: "ru",
    regex: /\b(?:привет|спасибо|как|дела|сегодня|добрый|утро|вечер)\b/gi,
  },
  {
    code: "hi",
    regex: /\b(?:नमस्ते|धन्यवाद|कैसे|है|आज|सुबह|शुभ|क्या)\b/gi,
  },
];

/**
 * LanguageDetector uses lightweight heuristics to infer language from text
 * and transcription metadata. It is designed to preserve the user's detected
 * language across voice and text interactions while handling uncertainty.
 */
export class LanguageDetector {
  private preferredLanguage: string;

  constructor(options?: LanguageDetectorOptions) {
    this.preferredLanguage = options?.defaultLanguage ?? "en";
  }

  public detectFromText(text: string): LanguageDetectionResult {
    const value = text.trim();
    if (!value) {
      return this.fromPreferred("text");
    }

    const inference = this.inferLanguageCode(value);
    const language = inference?.language || this.preferredLanguage;
    const confidence =
      inference?.confidence ?? this.estimateConfidence(value.length);
    const isRTL = getDirection(value) === "rtl";

    this.preferredLanguage = language;

    return {
      language,
      isRTL,
      source: inference ? "text" : "preferred",
      confidence,
    };
  }

  public detectFromAudio(
    transcription: string,
    metadata?: { language?: string; confidence?: number },
  ): LanguageDetectionResult {
    const value = transcription.trim();
    if (!value) {
      return this.fromPreferred("audio");
    }

    const inferred = this.inferLanguageCode(value);
    const metadataLanguage = metadata?.language;
    const metadataConfidence = metadata?.confidence;

    let language = this.preferredLanguage;
    let confidence =
      metadataConfidence ??
      inferred?.confidence ??
      this.estimateConfidence(value.length);
    let source: LanguageDetectionResult["source"] = "audio";

    if (metadataLanguage && metadataConfidence != null) {
      if (metadataConfidence >= 0.72) {
        language = metadataLanguage;
        confidence = Math.min(0.99, metadataConfidence + 0.06);
      } else if (inferred && inferred.confidence > metadataConfidence + 0.08) {
        language = inferred.language;
        confidence = inferred.confidence;
      } else {
        language = metadataLanguage;
        confidence = Math.max(metadataConfidence, inferred?.confidence ?? 0.45);
      }
    } else if (inferred) {
      language = inferred.language;
      confidence = inferred.confidence;
    }

    this.preferredLanguage = language;

    return {
      language,
      isRTL: getDirection(value) === "rtl",
      source,
      confidence,
    };
  }

  public getPreferredLanguage(): string {
    return this.preferredLanguage;
  }

  private fromPreferred(
    source: LanguageDetectionResult["source"],
  ): LanguageDetectionResult {
    return {
      language: this.preferredLanguage,
      isRTL: false,
      source: "preferred",
      confidence: 0.55,
    };
  }

  private estimateConfidence(length: number): number {
    return Math.min(0.85, Math.max(0.35, 0.45 + Math.min(length / 120, 0.3)));
  }

  private inferLanguageCode(
    text: string,
  ): { language: string; confidence: number } | null {
    if (!text) {
      return null;
    }

    const samples = text.trim().slice(0, 320);
    const counts = {
      rtl: (samples.match(/[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/g) || [])
        .length,
      cjk: (samples.match(/[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/g) || [])
        .length,
      devanagari: (samples.match(/[\u0900-\u097F]/g) || []).length,
      cyrillic: (samples.match(/[\u0400-\u04FF]/g) || []).length,
      latin: (samples.match(/[A-Za-z]/g) || []).length,
    };

    if (counts.rtl > 0 && counts.rtl > counts.latin) {
      if (/[א-ת]/.test(samples)) {
        return { language: "he", confidence: 0.92 };
      }
      if (/[پچژگک]/.test(samples)) {
        return { language: "fa", confidence: 0.92 };
      }
      if (/[ٹڈڑںھ]/.test(samples)) {
        return { language: "ur", confidence: 0.92 };
      }
      return { language: "ar", confidence: 0.9 };
    }

    if (counts.cjk > 0) {
      if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(samples)) {
        return { language: "ja", confidence: 0.93 };
      }
      if (/\p{Script=Hangul}/u.test(samples)) {
        return { language: "ko", confidence: 0.93 };
      }
      return { language: "zh", confidence: 0.92 };
    }

    if (counts.devanagari > 0) {
      return { language: "hi", confidence: 0.92 };
    }

    if (counts.cyrillic > 0) {
      return { language: "ru", confidence: 0.9 };
    }

    if (/[şŞıİöÖüÜçÇğĞ]/.test(samples)) {
      return { language: "tr", confidence: 0.9 };
    }

    const scoreMap: Record<string, number> = {};
    for (const matcher of LANGUAGE_KEYWORD_PATTERNS) {
      const matches = samples.match(matcher.regex)?.length || 0;
      if (matches > 0) {
        scoreMap[matcher.code] = (scoreMap[matcher.code] || 0) + matches;
      }
    }

    const scored = Object.entries(scoreMap).sort((a, b) => b[1] - a[1]);
    const top = scored[0];

    if (top && top[1] > 0) {
      const second = scored[1]?.[1] ?? 0;
      const delta = top[1] - second;
      const baseConfidence = Math.min(0.9, 0.6 + Math.min(top[1] * 0.1, 0.2));
      const bonus = Math.min(0.15, delta * 0.05);
      return {
        language: top[0],
        confidence: Math.min(0.99, baseConfidence + bonus),
      };
    }

    if (counts.latin > 0) {
      return {
        language: "en",
        confidence: Math.min(0.7, 0.45 + Math.min(samples.length / 140, 0.25)),
      };
    }

    return null;
  }
}
