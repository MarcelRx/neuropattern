import React from 'react';

interface GaugeProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
  showTrend?: boolean;
}

const Gauge: React.FC<GaugeProps> = ({ value, size = 200, strokeWidth = 15, label = "Score", showTrend = true }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Outer Glow */}
      <div className="absolute inset-0 rounded-full bg-primary/10 blur-3xl"></div>
      
      <svg className="w-full h-full transform -rotate-90 drop-shadow-lg" viewBox={`0 0 ${size} ${size}`}>
        {/* Background Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#1e293b"
          strokeWidth={strokeWidth}
          className="stroke-background-card"
        />
        {/* Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#3d99f5"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="gauge-circle shadow-neon-blue"
          style={{ filter: 'drop-shadow(0 0 4px #3d99f5)' }}
        />
      </svg>
      
      {/* Center Content */}
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">{label}</span>
        <div className="flex items-baseline">
          <span className="text-5xl font-bold text-white tracking-tighter drop-shadow-md">{value}</span>
          <span className="text-lg text-gray-500 font-medium ml-1">/100</span>
        </div>
        {showTrend && (
          <div className="mt-2 flex items-center gap-1 bg-secondary/10 px-3 py-1 rounded-full border border-secondary/20">
            <span className="material-symbols-outlined text-secondary text-sm">trending_up</span>
            <span className="text-xs font-bold text-secondary">+5% vs avg</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Gauge;