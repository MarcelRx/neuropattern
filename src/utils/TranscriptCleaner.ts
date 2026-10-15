/**
 * TranscriptCleaner normalizes transcribed text for consistent display and storage.
 */
export class TranscriptCleaner {
  public static clean(text: string): string {
    if (!text) {
      return "";
    }

    return text
      .replace(/\s+/g, " ")
      .replace(/\s+([?.!,;:])/g, "$1")
      .replace(/([?.!,;:])([A-Za-zÀ-ÖØ-öø-ÿ])/g, "$1 $2")
      .trim();
  }
}
