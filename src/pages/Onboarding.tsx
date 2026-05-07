import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppRoute } from '../types';

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const nextStep = () => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      navigate(AppRoute.AUTH);
    }
  };

  const skipToLogin = () => {
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
                    <span className="material-symbols-outlined text-[80px] text-primary animate-pulse">neurology</span>
                </div>
            </div>
            <h1 className="text-4xl font-bold text-center mb-4 text-white">
                Welcome to <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400">NeuroPattern</span>
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
                Next <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
        </div>
      </div>
    );
  }

  // Step 1: Voice Setup Screen - EXACT SAME SIZES AS STEP 0
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

            {/* SAME SIZE AS STEP 0: w-64 h-64 */}
            <div className="relative w-64 h-64 mb-8">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl"></div>
                <div className="relative w-full h-full rounded-full border border-primary/30 flex items-center justify-center bg-background-dark/50 backdrop-blur-sm overflow-hidden">
                    {/* Audio waveform inside same size circle */}
                    <div className="flex items-center gap-1 h-20">
                        {[25, 45, 65, 85, 100, 75, 55, 35, 60, 80, 50, 30].map((h, i) => (
                            <div key={i} className="w-1.5 bg-primary rounded-full animate-pulse" style={{height: `${h}%`, animationDelay: `${i * 0.08}s`}}></div>
                        ))}
                    </div>
                </div>
            </div>
            
            {/* SAME TEXT SIZES AS STEP 0 */}
            <h1 className="text-4xl font-bold text-center mb-4 text-white">
                Just Talk.<br />
                <span className="text-primary">We\'ll Listen.</span>
            </h1>
            <p className="text-gray-400 text-center max-w-xs text-lg mb-6">
                Capture your day in seconds. Our AI analyzes tone and sentiment.
            </p>
            
            {/* Security badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800/50 border border-gray-700">
                <span className="material-symbols-outlined text-primary text-sm">lock</span>
                <span className="text-xs font-medium text-gray-400">End-to-end encrypted audio</span>
            </div>
        </div>

        <div className="w-full flex flex-col items-center gap-4 pb-8">
            <button 
                onClick={nextStep}
                className="w-full max-w-sm h-14 rounded-full bg-primary text-white font-bold text-lg shadow-lg hover:bg-blue-400 transition-all flex items-center justify-center gap-2"
            >
                <span className="material-symbols-outlined">mic</span> Grant Microphone Access
            </button>
            <button 
                onClick={nextStep} 
                className="text-sm font-medium text-gray-500 hover:text-white transition-colors"
            >
                Maybe later
            </button>
        </div>
      </div>
    );
  }

  // Step 2: Analytics Preview Screen - EXACT SAME SIZES AS STEP 0
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
                    {/* Chart icon same size as brain icon */}
                    <div className="text-center flex flex-col items-center">
                        <span className="material-symbols-outlined text-[80px] text-secondary mb-2">ssid_chart</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold text-white">84</span>
                            <span className="text-secondary text-lg font-semibold">+12%</span>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* SAME TEXT SIZES AS STEP 0 */}
            <h1 className="text-4xl font-bold text-center mb-4 text-white">
                Your Life,<br />
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
                Get Started <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
        </div>
    </div>
  );
};

export default Onboarding;