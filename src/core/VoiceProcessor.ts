import { AudioQualityReport } from "../types/VoiceTypes";
import { AudioNormalizer } from "../utils/AudioNormalizer";

export interface VoiceProcessorOptions {
  maxChunkDurationMs?: number;
}

/**
 * VoiceProcessor is responsible for normalizing browser audio and slicing long
 * recordings into safe chunks before voice analysis is sent to the backend.
 */
export class VoiceProcessor {
  private readonly maxChunkDurationMs: number;

  constructor(options?: VoiceProcessorOptions) {
    this.maxChunkDurationMs = options?.maxChunkDurationMs ?? 30000;
  }

  public async normalizeAudio(blob: Blob): Promise<Blob> {
    try {
      return await AudioNormalizer.normalizeAudio(blob);
    } catch (error) {
      console.warn(
        "[VoiceProcessor] normalization failed, sending original blob",
        error,
      );
      return blob;
    }
  }

  public async trimSilence(blob: Blob): Promise<Blob> {
    if (
      typeof AudioContext === "undefined" &&
      typeof (window as any).webkitAudioContext === "undefined"
    ) {
      return blob;
    }

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const AudioCtx = AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioCtx();
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const channelData = decoded.getChannelData(0);
      const silenceThreshold = 0.01;
      const minSilenceSamples = Math.floor(decoded.sampleRate * 0.25);

      let start = 0;
      while (
        start < channelData.length &&
        Math.abs(channelData[start]) < silenceThreshold
      ) {
        start += 1;
      }

      let end = channelData.length - 1;
      while (end > start && Math.abs(channelData[end]) < silenceThreshold) {
        end -= 1;
      }

      if (start === 0 && end === channelData.length - 1) {
        return blob;
      }

      const trimmedLength = end - start + 1;
      const trimmedBuffer = audioContext.createBuffer(
        decoded.numberOfChannels,
        trimmedLength,
        decoded.sampleRate,
      );

      for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
        const channelSlice = decoded
          .getChannelData(channel)
          .slice(start, end + 1);
        trimmedBuffer.copyToChannel(channelSlice, channel, 0);
      }

      const offlineContext = new OfflineAudioContext(
        trimmedBuffer.numberOfChannels,
        trimmedBuffer.length,
        trimmedBuffer.sampleRate,
      );
      const source = offlineContext.createBufferSource();
      source.buffer = trimmedBuffer;
      source.connect(offlineContext.destination);
      source.start();
      const rendered = await offlineContext.startRendering();
      const wavData = AudioNormalizer.convertBufferToWav(rendered);

      return new Blob([wavData], { type: "audio/wav" });
    } catch (error) {
      console.warn(
        "[VoiceProcessor] trimSilence failed, using original blob",
        error,
      );
      return blob;
    }
  }

  public async chunkAudio(blob: Blob): Promise<Blob[]> {
    if (blob.size === 0) {
      return [blob];
    }

    const maxBytes = Math.floor((this.maxChunkDurationMs / 30000) * blob.size);
    if (blob.size <= maxBytes) {
      return [blob];
    }

    const chunks: Blob[] = [];
    let offset = 0;

    while (offset < blob.size) {
      const end = Math.min(blob.size, offset + maxBytes);
      chunks.push(blob.slice(offset, end, blob.type));
      offset = end;
    }

    return chunks;
  }

  public summarizeQuality(report: AudioQualityReport): string {
    const issues =
      report.issues.length > 0 ? report.issues.join(", ") : "clear";
    return `Audio quality is ${report.isClear ? "good" : "imperfect"} with issues: ${issues}.`;
  }
}
