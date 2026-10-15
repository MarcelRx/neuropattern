import { useCallback, useRef, useState } from "react";

export interface AudioQualityReport {
  averageVolume: number; // 0-1 scale
  peakVolume: number; // 0-1 scale
  silenceRatio: number; // % of recording that's silent
  duration: number; // seconds
  isClear: boolean; // overall quality judgment
  issues: string[]; // list of detected issues
  // Tone analysis fields
  energyVariance?: number; // emotional arousal (0-1)
  pitchTrend?: "rising" | "falling" | "stable";
  speechRate?: number; // estimated syllables per second
  emotionalTone?: {
    arousal: number; // 0-1 (calm vs excited/angry)
    valence: number; // 0-1 (negative vs positive)
  };
}

export const useAudioRecorder = (
  onStop: (blob: Blob, qualityReport: AudioQualityReport) => void,
) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);

  // Refs for cleanup and state management
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const volumeDataRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // ─── Audio Analysis Helpers ───

  /**
   * Calculate energy variance (emotional arousal indicator)
   */
  const calculateEnergyVariance = (channelData: Float32Array): number => {
    const frameSize = 1024;
    const frames = Math.floor(channelData.length / frameSize);
    if (frames === 0) return 0.5;

    const energies: number[] = [];

    for (let i = 0; i < frames; i++) {
      let sum = 0;
      for (let j = 0; j < frameSize; j++) {
        sum += channelData[i * frameSize + j] ** 2;
      }
      energies.push(Math.sqrt(sum / frameSize));
    }

    const mean = energies.reduce((a, b) => a + b, 0) / energies.length;
    const variance =
      energies.reduce((sum, e) => sum + (e - mean) ** 2, 0) / energies.length;
    return Math.min(1, variance * 10); // Normalize to 0-1
  };

  /**
   * Estimate pitch trend using zero-crossing rate
   */
  const estimatePitchTrend = (
    channelData: Float32Array,
    sampleRate: number,
  ): "rising" | "falling" | "stable" => {
    const frameSize = 2048;
    const hopSize = 512;
    const frames = Math.floor((channelData.length - frameSize) / hopSize);

    if (frames < 3) return "stable";

    const zeroCrossingRates: number[] = [];

    for (let i = 0; i < frames; i++) {
      let crossings = 0;
      const start = i * hopSize;
      for (let j = start; j < start + frameSize - 1; j++) {
        if (channelData[j] > 0 !== channelData[j + 1] > 0) {
          crossings++;
        }
      }
      zeroCrossingRates.push(crossings / frameSize);
    }

    // Compare first half vs second half
    const mid = Math.floor(zeroCrossingRates.length / 2);
    const firstHalf =
      zeroCrossingRates.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const secondHalf =
      zeroCrossingRates.slice(mid).reduce((a, b) => a + b, 0) /
      (zeroCrossingRates.length - mid);

    const diff = secondHalf - firstHalf;
    if (Math.abs(diff) < 0.02) return "stable";
    return diff > 0 ? "rising" : "falling";
  };

  /**
   * Estimate speech rate from amplitude envelope
   */
  const estimateSpeechRate = (
    channelData: Float32Array,
    sampleRate: number,
    duration: number,
  ): number => {
    const frameSize = Math.floor(sampleRate * 0.02); // 20ms frames
    const frames = Math.floor(channelData.length / frameSize);
    if (frames === 0 || duration <= 0) return 0;

    const energies: number[] = [];

    for (let i = 0; i < frames; i++) {
      let sum = 0;
      for (let j = 0; j < frameSize; j++) {
        sum += channelData[i * frameSize + j] ** 2;
      }
      energies.push(sum / frameSize);
    }

    // Find peaks (syllable nuclei)
    const threshold =
      (energies.reduce((a, b) => a + b, 0) / energies.length) * 1.5;
    let syllableCount = 0;
    let inSyllable = false;

    for (const energy of energies) {
      if (energy > threshold && !inSyllable) {
        syllableCount++;
        inSyllable = true;
      } else if (energy < threshold * 0.5) {
        inSyllable = false;
      }
    }

    return syllableCount / duration;
  };

  /**
   * Analyze audio blob for quality AND tone metrics
   * Includes comprehensive error handling for audio context failures
   */
  const analyzeAudioQuality = async (
    blob: Blob,
    duration: number,
  ): Promise<AudioQualityReport> => {
    let audioContext: AudioContext | null = null;

    try {
      // ─── Guard: Check if AudioContext is available ───
      if (
        typeof AudioContext === "undefined" &&
        typeof (window as any).webkitAudioContext === "undefined"
      ) {
        console.warn(
          "[AudioRecorder] AudioContext not supported, returning defaults",
        );
        return createDefaultReport(duration);
      }

      const arrayBuffer = await blob.arrayBuffer();

      // Create audio context with fallback
      const AudioContextClass =
        AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioContextClass();

      // Guard: Check if decodeAudioData is available
      if (!audioContext.decodeAudioData) {
        console.warn("[AudioRecorder] decodeAudioData not supported");
        await safelyCloseAudioContext(audioContext);
        return createDefaultReport(duration);
      }

      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Guard: Check if we have valid channel data
      if (audioBuffer.numberOfChannels === 0 || audioBuffer.length === 0) {
        console.warn("[AudioRecorder] Empty audio buffer");
        await safelyCloseAudioContext(audioContext);
        return createDefaultReport(duration);
      }

      const channelData = audioBuffer.getChannelData(0);
      const totalSamples = channelData.length;

      if (totalSamples === 0) {
        await safelyCloseAudioContext(audioContext);
        return createDefaultReport(duration);
      }

      // ─── Basic Audio Metrics ───
      let sum = 0;
      let peak = 0;
      let silentSamples = 0;

      for (let i = 0; i < totalSamples; i++) {
        const abs = Math.abs(channelData[i]);
        sum += abs;
        if (abs > peak) peak = abs;
        if (abs < 0.01) silentSamples++;
      }

      const averageVolume = sum / totalSamples;
      const silenceRatio = silentSamples / totalSamples;

      // ─── Tone Analysis ───
      const energyVariance = calculateEnergyVariance(channelData);
      const pitchTrend = estimatePitchTrend(
        channelData,
        audioBuffer.sampleRate,
      );
      const speechRate = estimateSpeechRate(
        channelData,
        audioBuffer.sampleRate,
        duration,
      );

      // Estimate emotional tone from audio features
      const emotionalTone = {
        arousal: Math.min(1, energyVariance * 2 + speechRate / 10),
        valence:
          pitchTrend === "rising" ? 0.7 : pitchTrend === "falling" ? 0.3 : 0.5,
      };

      // ─── Quality Issues Detection ───
      const issues: string[] = [];

      if (averageVolume < 0.05) issues.push("too_quiet");
      if (averageVolume > 0.8) issues.push("too_loud");
      if (silenceRatio > 0.5) issues.push("too_much_silence");
      if (duration < 3) issues.push("too_short");
      if (duration > 60) issues.push("too_long");
      if (peak > 0.95) issues.push("clipping_detected");

      const isClear =
        issues.length === 0 ||
        (issues.length === 1 && issues[0] === "too_short" && duration >= 2);

      // ─── Cleanup ───
      await safelyCloseAudioContext(audioContext);

      return {
        averageVolume,
        peakVolume: peak,
        silenceRatio,
        duration,
        isClear,
        issues,
        energyVariance,
        pitchTrend,
        speechRate,
        emotionalTone,
      };
    } catch (err) {
      console.error("[AudioRecorder] Audio quality analysis failed:", err);

      // Ensure cleanup even on error
      if (audioContext) {
        await safelyCloseAudioContext(audioContext);
      }

      return createDefaultReport(duration);
    }
  };

  /**
   * Safely close AudioContext, handling all edge cases
   */
  const safelyCloseAudioContext = async (ctx: AudioContext): Promise<void> => {
    try {
      if (ctx.state !== "closed") {
        await ctx.close();
      }
    } catch (closeErr) {
      console.warn("[AudioRecorder] Error closing AudioContext:", closeErr);
    }
  };

  /**
   * Create default quality report when analysis fails
   */
  const createDefaultReport = (duration: number): AudioQualityReport => ({
    averageVolume: 0.5,
    peakVolume: 0.5,
    silenceRatio: 0.1,
    duration,
    isClear: true,
    issues: [],
    energyVariance: 0.5,
    pitchTrend: "stable",
    speechRate: 4,
    emotionalTone: { arousal: 0.5, valence: 0.5 },
  });

  // ─── Real-time Volume Monitoring ───

  const monitorVolume = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalizedVolume = average / 255;

    setVolumeLevel(normalizedVolume);
    volumeDataRef.current.push(normalizedVolume);

    animationFrameRef.current = requestAnimationFrame(monitorVolume);
  }, []);

  // ─── Recording Controls ───

  const startRecording = useCallback(async () => {
    try {
      // Guard: Check if MediaRecorder is supported
      if (typeof MediaRecorder === "undefined") {
        throw new Error("MediaRecorder API not supported in this browser");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up audio analysis
      const AudioContextClass =
        AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();

      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      volumeDataRef.current = [];
      monitorVolume();

      // Determine supported MIME type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/wav")
          ? "audio/wav"
          : "audio/ogg";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const duration = recordingTime;

        // Stop volume monitoring
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        // Analyze quality with tone features
        const qualityReport = await analyzeAudioQuality(audioBlob, duration);
        onStop(audioBlob, qualityReport);
      };

      mediaRecorder.onerror = (event) => {
        console.error("[AudioRecorder] MediaRecorder error:", event);
        stopRecording();
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("[AudioRecorder] Microphone access denied or error:", err);

      // User-friendly error message
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Unknown error accessing microphone";

      if (
        errorMessage.includes("Permission denied") ||
        errorMessage.includes("NotAllowedError")
      ) {
        alert(
          "Please allow microphone access to use voice check-in. You can change this in your browser settings.",
        );
      } else if (errorMessage.includes("NotFoundError")) {
        alert(
          "No microphone found. Please connect a microphone and try again.",
        );
      } else {
        alert(`Microphone error: ${errorMessage}`);
      }
    }
  }, [onStop, monitorVolume, recordingTime]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      // Stop the media recorder
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }

      // Stop all tracks
      mediaRecorderRef.current.stream
        ?.getTracks()
        .forEach((track) => track.stop());

      setIsRecording(false);

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setRecordingTime(0);
      setVolumeLevel(0);

      // Stop volume monitoring
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Close audio context safely
      if (audioContextRef.current) {
        safelyCloseAudioContext(audioContextRef.current);
        audioContextRef.current = null;
      }

      analyserRef.current = null;
    }
  }, [isRecording]);

  return {
    isRecording,
    recordingTime,
    volumeLevel,
    startRecording,
    stopRecording,
  };
};
