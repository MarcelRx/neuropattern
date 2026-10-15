/**
 * AudioNormalizer provides browser-side gain normalization for voice recordings.
 */
export class AudioNormalizer {
  public static async normalizeAudio(blob: Blob): Promise<Blob> {
    if (
      typeof AudioContext === "undefined" &&
      typeof (window as any).webkitAudioContext === "undefined"
    ) {
      return blob;
    }

    const arrayBuffer = await blob.arrayBuffer();
    const AudioCtx = AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioCtx();

    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const channelData = decoded.getChannelData(0);

    let rms = 0;
    for (let i = 0; i < channelData.length; i += 1) {
      rms += channelData[i] ** 2;
    }
    rms = Math.sqrt(rms / channelData.length) || 1;
    const targetRms = 0.1;
    const gain = targetRms / rms;

    const offlineContext = new OfflineAudioContext(
      decoded.numberOfChannels,
      decoded.length,
      decoded.sampleRate,
    );

    const source = offlineContext.createBufferSource();
    source.buffer = decoded;

    const gainNode = offlineContext.createGain();
    gainNode.gain.value = Math.min(2, gain);

    source.connect(gainNode).connect(offlineContext.destination);
    source.start(0);

    const rendered = await offlineContext.startRendering();
    const normalizedBuffer = rendered.getChannelData(0);
    const wavData = AudioNormalizer.convertBufferToWav(rendered);

    return new Blob([wavData], { type: "audio/wav" });
  }

  public static convertBufferToWav(audioBuffer: AudioBuffer): ArrayBuffer {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1;
    const bitDepth = 16;

    const samples = audioBuffer.length * numChannels;
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i += 1) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    let offset = 0;
    writeString(offset, "RIFF");
    offset += 4;
    view.setUint32(offset, 36 + samples * 2, true);
    offset += 4;
    writeString(offset, "WAVE");
    offset += 4;
    writeString(offset, "fmt ");
    offset += 4;
    view.setUint32(offset, 16, true);
    offset += 4;
    view.setUint16(offset, format, true);
    offset += 2;
    view.setUint16(offset, numChannels, true);
    offset += 2;
    view.setUint32(offset, sampleRate, true);
    offset += 4;
    view.setUint32(offset, sampleRate * numChannels * (bitDepth / 8), true);
    offset += 4;
    view.setUint16(offset, numChannels * (bitDepth / 8), true);
    offset += 2;
    view.setUint16(offset, bitDepth, true);
    offset += 2;
    writeString(offset, "data");
    offset += 4;
    view.setUint32(offset, samples * 2, true);
    offset += 4;

    const interleaved = AudioNormalizer.interleave(audioBuffer);
    AudioNormalizer.floatTo16BitPCM(view, 44, interleaved);

    return buffer;
  }

  private static interleave(audioBuffer: AudioBuffer): Float32Array {
    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numChannels;
    const result = new Float32Array(length);
    let offset = 0;

    for (let i = 0; i < audioBuffer.length; i += 1) {
      for (let channel = 0; channel < numChannels; channel += 1) {
        result[offset] = audioBuffer.getChannelData(channel)[i];
        offset += 1;
      }
    }

    return result;
  }

  private static floatTo16BitPCM(
    output: DataView,
    offset: number,
    input: Float32Array,
  ) {
    for (let i = 0; i < input.length; i += 1, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
  }
}
