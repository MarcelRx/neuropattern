import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppRoute } from "../constants/routes";
import { useApp } from "../context/AppContext";

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { finishOnboarding } = useApp();
  const [step, setStep] = useState(0);

  // NEW: State for mic test visualization
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [micVolumeBars, setMicVolumeBars] = useState<number[]>(
    new Array(12).fill(0),
  );
  const micTestRef = useRef<{
    stream: MediaStream | null;
    audioContext: AudioContext | null;
    analyser: AnalyserNode | null;
    animationFrame: number | null;
    timeout: number | null;
  }>({
    stream: null,
    audioContext: null,
    analyser: null,
    animationFrame: null,
    timeout: null,
  });

  const nextStep = () => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      finishOnboarding();
      navigate(AppRoute.AUTH);
    }
  };

  // NEW: Real microphone test with visualization
  const handleGrantMicAccess = async () => {
    if (!window.isSecureContext) {
      alert(
        "Microphone access requires a secure connection (HTTPS or localhost). Please check your connection.",
      );
      nextStep();
      return;
    }

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up audio analysis for visualization
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64; // Small FFT for responsive bars

      micTestRef.current = {
        stream,
        audioContext,
        analyser,
        animationFrame: null,
        timeout: null,
      };

      setIsMicTesting(true);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Animation loop for volume bars
      const animate = () => {
        if (!analyser) return;

        analyser.getByteFrequencyData(dataArray);

        // Map frequency data to 12 bars
        const bars = new Array(12).fill(0);
        const binsPerBar = Math.floor(dataArray.length / 12);

        for (let i = 0; i < 12; i++) {
          let sum = 0;
          for (let j = 0; j < binsPerBar; j++) {
            sum += dataArray[i * binsPerBar + j];
          }
          bars[i] = sum / binsPerBar / 255; // Normalize 0-1
        }

        setMicVolumeBars(bars);
        micTestRef.current.animationFrame = requestAnimationFrame(animate);
      };

      animate();

      // Stop after 3 seconds and proceed
      micTestRef.current.timeout = window.setTimeout(async () => {
        // Cleanup
        if (micTestRef.current.animationFrame) {
          cancelAnimationFrame(micTestRef.current.animationFrame);
        }
        if (micTestRef.current.stream) {
          micTestRef.current.stream
            .getTracks()
            .forEach((track) => track.stop());
        }
        if (
          micTestRef.current.audioContext &&
          micTestRef.current.audioContext.state !== "closed"
        ) {
          await micTestRef.current.audioContext.close();
        }

        setIsMicTesting(false);
        setMicVolumeBars(new Array(12).fill(0));
        nextStep();
      }, 3000);
    } catch (err) {
      console.warn("Microphone access denied or failed:", err);
      alert(
        "Microphone permission was denied. You can enable it later in browser settings. Proceeding...",
      );
      nextStep();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (micTestRef.current.animationFrame) {
        cancelAnimationFrame(micTestRef.current.animationFrame);
      }
      if (micTestRef.current.timeout) {
        clearTimeout(micTestRef.current.timeout);
      }
      if (micTestRef.current.stream) {
        micTestRef.current.stream.getTracks().forEach((track) => track.stop());
      }
      if (
        micTestRef.current.audioContext &&
        micTestRef.current.audioContext.state !== "closed"
      ) {
        micTestRef.current.audioContext.close();
      }
    };
  }, []);

  const skipToLogin = () => {
    finishOnboarding();
    navigate(AppRoute.AUTH);
  };

  // Step 0: Welcome Screen
  if (step === 0) {
    return (
      <div className="min-h-screen bg-background-dark flex flex-col items-center justify-between p-6 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[40%] bg-primary/10 blur-[100px] rounded-full"></div>

        <div className="flex-1 flex flex-col items-center justify-center w-full">
          <div className="relative w-64 h-64 mb-8">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl"></div>
            <div className="relative w-full h-full rounded-full border border-white/10 flex items-center justify-center bg-background-dark/50 backdrop-blur-sm">
              <span className="material-symbols-outlined text-[80px] text-primary animate-pulse">
                neurology
              </span>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-center mb-4 text-white">
            Welcome to <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400">
              NeuroPattern
            </span>
          </h1>
          <p className="text-gray-400 text-center max-w-xs text-lg">
            Transform your daily reflections into actionable life insights.
          </p>
        </div>

        <div className="w-full flex flex-col items-center gap-8 pb-8">
          <div className="flex gap-3">
            <div className="h-2.5 w-8 rounded-full bg-primary shadow-neon-blue"></div>
            <div className="h-2.5 w-2.5 rounded-full bg-gray-700"></div>
            <div className="h-2.5 w-2.5 rounded-full bg-gray-700"></div>
          </div>
          <button
            onClick={nextStep}
            className="w-full max-w-sm h-14 rounded-full bg-primary text-white font-bold text-lg shadow-lg hover:bg-blue-400 transition-all flex items-center justify-center gap-2 group"
          >
            Next{" "}
            <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </button>
        </div>
      </div>
    );
  }

  // Step 1: Voice Setup Screen — WITH LIVE MIC VISUALIZATION
  if (step === 1) {
    return (
      <div className="min-h-screen bg-background-dark flex flex-col items-center justify-between p-6 relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[40%] bg-primary/10 blur-[100px] rounded-full"></div>

        <div className="flex-1 flex flex-col items-center justify-center w-full">
          {/* Progress dots */}
          <div className="flex gap-3 mb-8">
            <div className="h-2.5 w-2.5 rounded-full bg-gray-700"></div>
            <div className="h-2.5 w-8 rounded-full bg-primary shadow-neon-blue"></div>
            <div className="h-2.5 w-2.5 rounded-full bg-gray-700"></div>
          </div>

          {/* Mic visualization circle — SAME SIZE AS STEP 0 */}
          <div className="relative w-64 h-64 mb-8">
            <div
              className={`absolute inset-0 rounded-full blur-3xl transition-colors duration-300 ${isMicTesting ? "bg-primary/40" : "bg-primary/20"}`}
            ></div>
            <div
              className={`relative w-full h-full rounded-full border flex items-center justify-center bg-background-dark/50 backdrop-blur-sm overflow-hidden transition-all duration-300 ${isMicTesting ? "border-primary/60 shadow-[0_0_30px_rgba(61,153,245,0.3)]" : "border-primary/30"}`}
            >
              {/* LIVE AUDIO WAVEFORM */}
              {isMicTesting ? (
                <div className="flex items-center gap-[3px] h-32 px-8">
                  {micVolumeBars.map((vol, i) => (
                    <div
                      key={i}
                      className="w-2 bg-primary rounded-full transition-all duration-75"
                      style={{
                        height: `${Math.max(8, vol * 100)}%`,
                        opacity: 0.4 + vol * 0.6,
                        transform: `scaleY(${0.5 + vol})`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                /* Static mic icon when not testing */
                <div className="flex flex-col items-center gap-3">
                  <span className="material-symbols-outlined text-[64px] text-primary">
                    mic
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    Tap to test microphone
                  </span>
                </div>
              )}
            </div>

            {/* Recording indicator */}
            {isMicTesting && (
              <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-rose-500 border-2 border-background-dark animate-pulse flex items-center justify-center">
                <span className="material-symbols-outlined text-[12px] text-white">
                  fiber_manual_record
                </span>
              </div>
            )}
          </div>

          {/* SAME TEXT SIZES AS STEP 0 */}
          <h1 className="text-4xl font-bold text-center mb-4 text-white">
            {isMicTesting ? "Listening..." : "Just Talk."}
            <br />
            <span className="text-primary">
              {isMicTesting ? "Speak normally" : "We'll Listen."}
            </span>
          </h1>
          <p className="text-gray-400 text-center max-w-xs text-lg mb-6">
            {isMicTesting
              ? "Your voice is being analyzed. Keep speaking naturally..."
              : "Capture your day in seconds. Our AI analyzes tone and sentiment."}
          </p>

          {/* Security badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800/50 border border-gray-700">
            <span className="material-symbols-outlined text-primary text-sm">
              lock
            </span>
            <span className="text-xs font-medium text-gray-400">
              End-to-end encrypted audio
            </span>
          </div>
        </div>

        <div className="w-full flex flex-col items-center gap-4 pb-8">
          <button
            onClick={handleGrantMicAccess}
            disabled={isMicTesting}
            className={`w-full max-w-sm h-14 rounded-full font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${isMicTesting ? "bg-gray-700 text-gray-400 cursor-not-allowed" : "bg-primary text-white hover:bg-blue-400"}`}
          >
            {isMicTesting ? (
              <>
                <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Testing...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">mic</span>
                Grant Microphone Access
              </>
            )}
          </button>
          {!isMicTesting && (
            <button
              onClick={nextStep}
              className="text-sm font-medium text-gray-500 hover:text-white transition-colors"
            >
              Maybe later
            </button>
          )}
        </div>
      </div>
    );
  }

  // Step 2: Analytics Preview Screen
  return (
    <div className="min-h-screen bg-background-dark flex flex-col items-center justify-between p-6 relative overflow-hidden">
      <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[40%] bg-secondary/10 blur-[100px] rounded-full"></div>

      <div className="flex-1 flex flex-col items-center justify-center w-full">
        {/* Progress dots */}
        <div className="flex gap-3 mb-8">
          <div className="h-2.5 w-2.5 rounded-full bg-gray-700"></div>
          <div className="h-2.5 w-2.5 rounded-full bg-gray-700"></div>
          <div className="h-2.5 w-8 rounded-full bg-secondary shadow-neon-green"></div>
        </div>

        {/* SAME SIZE AS STEP 0: w-64 h-64 */}
        <div className="relative w-64 h-64 mb-8">
          <div className="absolute inset-0 bg-secondary/20 rounded-full blur-3xl"></div>
          <div className="relative w-full h-full rounded-full border border-secondary/30 flex items-center justify-center bg-background-dark/50 backdrop-blur-sm">
            <div className="text-center flex flex-col items-center">
              <span className="material-symbols-outlined text-[80px] text-secondary mb-2">
                ssid_chart
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">84</span>
                <span className="text-secondary text-lg font-semibold">
                  +12%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SAME TEXT SIZES AS STEP 0 */}
        <h1 className="text-4xl font-bold text-center mb-4 text-white">
          Your Life,
          <br />
          <span className="text-secondary">Quantified</span>
        </h1>
        <p className="text-gray-400 text-center max-w-xs text-lg">
          Our AI analyzes your voice logs to calculate your daily Life Score.
        </p>
      </div>

      <div className="w-full flex flex-col items-center gap-8 pb-8">
        <div className="flex gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-gray-700"></div>
          <div className="h-2.5 w-2.5 rounded-full bg-gray-700"></div>
          <div className="h-2.5 w-8 rounded-full bg-secondary shadow-neon-green"></div>
        </div>
        <button
          onClick={nextStep}
          className="w-full max-w-sm h-14 rounded-full bg-secondary text-white font-bold text-lg shadow-lg hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 group"
        >
          Get Started{" "}
          <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
            arrow_forward
          </span>
        </button>
      </div>
    </div>
  );
};

export default Onboarding;
