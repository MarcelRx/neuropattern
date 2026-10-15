export interface TTSEngineOptions {
  useBrowserVoice?: boolean;
}

export class TTSEngine {
  private readonly useBrowserVoice: boolean;
  private currentAudio: HTMLAudioElement | null = null;

  constructor(options?: TTSEngineOptions) {
    this.useBrowserVoice = options?.useBrowserVoice ?? true;
  }

  public async speak(text: string, language = "en"): Promise<void> {
    if (!text || typeof window === "undefined") {
      return;
    }

    if (this.useBrowserVoice && "speechSynthesis" in window) {
      return this.speakWithBrowser(text, language);
    }

    console.warn(
      "[TTSEngine] Browser speech synthesis unavailable; text-only response will be displayed.",
    );
  }

  /**
   * Stop any playing TTS or audio.
   */
  public stop(): void {
    if (typeof window !== "undefined") {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio = null;
      }
    }
  }

  /**
   * Play audio from URL and wait until it finishes.
   */
  public async playAudio(url: string): Promise<void> {
    if (!url || typeof window === "undefined") {
      return;
    }

    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      this.currentAudio = audio;

      audio.onended = () => {
        this.currentAudio = null;
        resolve();
      };

      audio.onerror = (e) => {
        this.currentAudio = null;
        reject(new Error(`Audio playback error: ${e}`));
      };

      audio.play().catch((err) => {
        this.currentAudio = null;
        reject(err);
      });
    });
  }

  private async speakWithBrowser(
    text: string,
    language: string,
  ): Promise<void> {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.volume = 1.0;

    const preferredVoice = await this.selectPreferredVoice(language);
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang || this.normalizeLanguageTag(language);
    } else {
      utterance.lang = this.normalizeLanguageTag(language);
    }

    return new Promise((resolve) => {
      utterance.onend = () => resolve();
      utterance.onerror = (event) => {
        if (event.error !== 'canceled') {
          console.error('Browser TTS error:', event.error);
        }
        resolve();
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }

  private normalizeLanguageTag(language: string): string {
    const langMap: Record<string, string> = {
      en: "en-US", sv: "sv-SE", ar: "ar-SA", de: "de-DE", fr: "fr-FR",
      es: "es-ES", it: "it-IT", tr: "tr-TR", pt: "pt-BR", ru: "ru-RU",
      ja: "ja-JP", ko: "ko-KR", zh: "zh-CN", hi: "hi-IN", fa: "fa-IR",
      he: "he-IL", nl: "nl-NL", pl: "pl-PL", uk: "uk-UA", el: "el-GR",
      th: "th-TH", vi: "vi-VN", id: "id-ID",
    };
    const normalized = language.trim().toLowerCase().split("-")[0];
    return langMap[normalized] || language;
  }

  private async selectPreferredVoice(
    language: string,
  ): Promise<SpeechSynthesisVoice | null> {
    const synth = window.speechSynthesis;
    const qualityKeywords = ["neural", "premium", "enhanced", "wavenet", "natural"];
    const femaleKeywords = [
      "female", "woman", "girl", "samantha", "zira", "nora",
      "bella", "arya", "aria", "linda", "anna", "lucy", "eva", "maya", "emma"
    ];

    const getVoices = () => synth.getVoices();
    let voices = getVoices();

    if (!voices.length) {
      voices = await new Promise((resolve) => {
        const onVoicesChanged = () => {
          synth.removeEventListener("voiceschanged", onVoicesChanged);
          resolve(getVoices());
        };
        synth.addEventListener("voiceschanged", onVoicesChanged);
        setTimeout(() => resolve(getVoices()), 500);
      });
    }

    if (!voices.length) return null;

    const normalizedLang = this.normalizeLanguageTag(language).toLowerCase();
    const langPrefix = normalizedLang.split("-")[0];

    const exactMatches = voices.filter((voice) =>
      voice.lang.toLowerCase().startsWith(normalizedLang) ||
      voice.lang.toLowerCase().startsWith(langPrefix)
    );

    const scoreVoice = (voice: SpeechSynthesisVoice): number => {
      let score = 0;
      const nameLower = voice.name.toLowerCase();
      const uriLower = voice.voiceURI.toLowerCase();

      if (voice.lang.toLowerCase().startsWith(normalizedLang)) score += 10;
      else if (voice.lang.toLowerCase().startsWith(langPrefix)) score += 5;

      for (const keyword of qualityKeywords) {
        if (nameLower.includes(keyword) || uriLower.includes(keyword)) {
          score += 3;
          break;
        }
      }
      for (const keyword of femaleKeywords) {
        if (nameLower.includes(keyword) || uriLower.includes(keyword)) {
          score += 2;
          break;
        }
      }
      if (voice.default) score += 1;
      return score;
    };

    const scored = (exactMatches.length > 0 ? exactMatches : voices)
      .map(v => ({ voice: v, score: scoreVoice(v) }))
      .sort((a, b) => b.score - a.score);

    return scored[0]?.voice || null;
  }
}
