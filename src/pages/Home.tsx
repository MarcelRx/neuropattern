import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Gauge from '../components/Gauge';
import { AppRoute } from '../types';
import { useApp } from '../context/AppContext';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { dailyScore, logs, habits, userProfile } = useApp();
  const [showFocusMenu, setShowFocusMenu] = useState(false);
  const [focusFilter, setFocusFilter] = useState<'Today' | 'This Week' | 'This Month'>('Today');
  const [showAllLogs, setShowAllLogs] = useState(false);

  // Calculate focus data based on selected filter
  const focusData = useMemo(() => {
    const now = new Date();
    let productiveHours = 0;
    let distractionHours = 0;
    let totalHours = 0;
    
    // Filter logs based on time range
    const filteredLogs = logs.filter(log => {
      const logDate = new Date(log.timestamp);
      const diffTime = now.getTime() - logDate.getTime();
      const diffDays = diffTime / (1000 * 3600 * 24);
      
      switch (focusFilter) {
        case 'Today':
          return diffDays < 1;
        case 'This Week':
          return diffDays < 7;
        case 'This Month':
          return diffDays < 30;
        default:
          return true;
      }
    });

    // Calculate simulated focus metrics based on scores and moods
    filteredLogs.forEach(log => {
      const productive = log.score > 60 ? (log.score / 100) * 2 : 0.5;
      const distraction = log.score < 50 ? ((100 - log.score) / 100) * 1.5 : 0.3;
      productiveHours += productive;
      distractionHours += distraction;
    });

    // Add some base hours if no logs
    if (filteredLogs.length === 0) {
      productiveHours = focusFilter === 'Today' ? 0 : focusFilter === 'This Week' ? 0 : 0;
      distractionHours = focusFilter === 'Today' ? 0 : focusFilter === 'This Week' ? 0 : 0;
    }

    totalHours = productiveHours + distractionHours;
    const productivePercent = totalHours > 0 ? Math.round((productiveHours / totalHours) * 100) : 0;
    
    return {
      productiveHours: Math.round(productiveHours * 10) / 10,
      distractionHours: Math.round(distractionHours * 10) / 10,
      productivePercent,
      hasData: filteredLogs.length > 0
    };
  }, [logs, focusFilter]);

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
  };

  const getHabitColorClass = (colorType: string) => {
    switch (colorType) {
        case 'primary': return { bg: 'bg-primary', text: 'text-primary' };
        case 'secondary': return { bg: 'bg-indigo-500', text: 'text-indigo-400' };
        case 'accent-orange': return { bg: 'bg-orange-500', text: 'text-orange-400' };
        case 'accent-purple': return { bg: 'bg-purple-500', text: 'text-purple-400' };
        default: return { bg: 'bg-primary', text: 'text-primary' };
    }
  };

  const displayedLogs = showAllLogs ? logs : logs.slice(0, 1);

  return (
    <div className="pb-24 pt-4 px-5 max-w-md mx-auto" onClick={() => showFocusMenu && setShowFocusMenu(false)}>
      {/* Header - REMOVED voice/CheckIn button */}
      <header className="sticky top-0 z-30 glass-panel rounded-2xl px-5 py-4 flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative cursor-pointer" onClick={() => navigate(AppRoute.PROFILE)}>
            <div className="h-10 w-10 rounded-full bg-cover bg-center border-2 border-primary/30 overflow-hidden">
               <img src={userProfile.avatar} alt="Profile" className="w-full h-full object-cover" />
            </div>
            <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-secondary border-2 border-background-dark"></div>
          </div>
          <div>
            <h1 className="text-sm text-gray-400 font-medium leading-tight">Welcome back,</h1>
            <p className="text-base font-bold text-white leading-tight">{userProfile.name}</p>
          </div>
        </div>
        {/* REMOVED: Voice/CheckIn button - accessible via Navigation instead */}
      </header>

      {/* Score Gauge */}
      <section className="flex flex-col items-center justify-center mb-8">
        <Gauge value={dailyScore} label="Daily Score" />
      </section>

      {/* Quick Stats */}
      <section className="grid grid-cols-3 gap-4 mb-8">
        {[
            { icon: 'bedtime', val: '7h 20m', label: 'Sleep', color: 'text-indigo-400', bg: 'bg-indigo-500/20' },
            { icon: 'footprint', val: '8,432', label: 'Steps', color: 'text-orange-400', bg: 'bg-orange-500/20' },
            { icon: 'mood', val: logs.length > 0 ? logs[0].mood : '--', label: 'Mood', color: 'text-secondary', bg: 'bg-secondary/20' },
        ].map((stat, i) => (
            <div key={i} className="glass-panel rounded-2xl p-3 flex flex-col items-center justify-center gap-1 group hover:bg-background-card/80 transition-colors">
                <div className={`h-8 w-8 rounded-full ${stat.bg} flex items-center justify-center ${stat.color} mb-1`}>
                    <span className="material-symbols-outlined text-[20px] capitalize">{stat.icon === 'mood' ? 'sentiment_satisfied' : stat.icon}</span>
                </div>
                <p className="text-lg font-bold text-white truncate max-w-full px-1 capitalize">{stat.val}</p>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{stat.label}</p>
            </div>
        ))}
      </section>

      {/* Focus Analysis */}
      <section className="glass-panel rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4 relative">
            <div>
                <h3 className="text-white font-semibold text-lg">Focus Analysis</h3>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{focusFilter} View</span>
            </div>
            <div className="relative">
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowFocusMenu(!showFocusMenu);
                    }} 
                    className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                    <span className="material-symbols-outlined">more_horiz</span>
                </button>
                
                {showFocusMenu && (
                    <div className="absolute right-0 top-full mt-2 w-36 bg-background-card border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {(['Today', 'This Week', 'This Month'] as const).map((option) => (
                            <button
                                key={option}
                                onClick={() => {
                                    setFocusFilter(option);
                                    setShowFocusMenu(false);
                                }}
                                className={`w-full text-left px-4 py-3 text-xs font-medium hover:bg-white/5 transition-colors flex items-center justify-between ${focusFilter === option ? 'text-primary bg-primary/5' : 'text-gray-300'}`}
                            >
                                {option}
                                {focusFilter === option && <span className="material-symbols-outlined text-sm">check</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {!focusData.hasData ? (
            <div className="text-center py-8 text-gray-500">
                <span className="material-symbols-outlined text-4xl mb-2">bar_chart</span>
                <p className="text-sm">Not enough data for {focusFilter.toLowerCase()}</p>
                <p className="text-xs mt-1">Complete more check-ins to see focus analysis</p>
            </div>
        ) : (
            <div className="flex items-center gap-6">
                <div className="relative h-32 w-32 shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path className="text-background-card" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4"></path>
                        <path className="text-secondary drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]" 
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                              fill="none" 
                              stroke="currentColor" 
                              strokeDasharray={`${focusData.productivePercent}, 100`} 
                              strokeLinecap="round" 
                              strokeWidth="4"></path>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className="text-2xl font-bold text-white">{focusData.productivePercent}%</span>
                    </div>
                </div>
                <div className="flex flex-col gap-3 w-full">
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-300 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span> 
                                Productive
                            </span>
                            <span className="font-bold text-white">{focusData.productiveHours}h</span>
                        </div>
                        <div className="text-xs text-gray-500">Deep work, coding, writing</div>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-300 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(61,153,245,0.8)]"></span> 
                                Distraction
                            </span>
                            <span className="font-bold text-white">{focusData.distractionHours}h</span>
                        </div>
                        <div className="text-xs text-gray-500">Social media, meetings</div>
                    </div>
                </div>
            </div>
        )}
      </section>

      {/* Habit Tracking */}
      <section className="glass-panel rounded-2xl p-5 mb-6 cursor-pointer" onClick={() => navigate(AppRoute.HABITS)}>
        <h3 className="text-white font-semibold text-lg mb-4">Habit Tracking</h3>
        <div className="flex flex-col gap-5">
            {habits.map((habit, i) => {
                const colors = getHabitColorClass(habit.color);
                return (
                <div key={i} className="flex flex-col gap-2">
                    <div className="flex justify-between items-end">
                        <div className="flex items-center gap-2">
                            <span className={`material-symbols-outlined ${colors.text} text-xl`}>{habit.icon}</span>
                            <span className="text-sm font-medium text-white">{habit.name}</span>
                        </div>
                        <span className={`text-xs font-semibold ${colors.text}`}>{habit.currentValue} / {habit.goal}</span>
                    </div>
                    <div className="h-2 w-full bg-background-card rounded-full overflow-hidden">
                        <div className={`h-full ${colors.bg} rounded-full shadow-lg transition-all duration-500`} style={{ width: `${habit.progress}%` }}></div>
                    </div>
                </div>
            )})}
        </div>
      </section>

      {/* Daily Logs */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-lg">Daily Logs</h3>
            {logs.length > 1 && (
                <button 
                    onClick={() => setShowAllLogs(!showAllLogs)}
                    className="text-sm text-primary font-medium hover:text-primary/80 transition-colors flex items-center gap-1"
                >
                    {showAllLogs ? (
                        <>
                            Show Less
                            <span className="material-symbols-outlined text-sm">expand_less</span>
                        </>
                    ) : (
                        <>
                            View All
                            <span className="material-symbols-outlined text-sm">expand_more</span>
                        </>
                    )}
                </button>
            )}
        </div>
        
        <div className={`flex flex-col gap-4 transition-all duration-500 ease-in-out overflow-hidden ${showAllLogs ? 'max-h-[2000px]' : 'max-h-[200px]'}`}>
            {logs.length === 0 ? (
              <div className="text-center p-6 text-gray-500 bg-background-card rounded-xl border border-white/5">
                No logs yet. Go to Coach to check in.
              </div>
            ) : (
              <>
                {displayedLogs.map((log, index) => (
                    <div 
                        key={log.id} 
                        className={`relative bg-background-card rounded-xl p-4 border-l-4 border-secondary shadow-lg overflow-hidden group animate-in slide-in-from-bottom-2 duration-500 ${!showAllLogs && index === 0 ? 'ring-1 ring-white/5' : ''}`}
                        style={{ animationDelay: `${index * 100}ms` }}
                    >
                        {log.moodImageUrl && (
                            <div className="absolute inset-0 z-0">
                                <img src={log.moodImageUrl} alt="" className="w-full h-full object-cover opacity-10 blur-sm group-hover:opacity-20 group-hover:blur-none transition-all duration-700" />
                                <div className="absolute inset-0 bg-gradient-to-r from-background-card via-background-card/90 to-transparent"></div>
                            </div>
                        )}
                        
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400 font-mono">{formatTime(log.timestamp)}</span>
                                    <span className="h-1 w-1 rounded-full bg-gray-600"></span>
                                    <span className="text-xs font-semibold text-white capitalize">{log.mood} Check-in</span>
                                    {showAllLogs && (
                                        <span className="text-[10px] text-gray-500 ml-1">{formatDate(log.timestamp)}</span>
                                    )}
                                </div>
                                <span className="material-symbols-outlined text-gray-500 text-lg">psychology</span>
                            </div>
                            <p className="text-sm text-gray-300 leading-relaxed mb-3">
                                "{log.summary}"
                            </p>
                            <div className="flex items-center justify-between">
                                <div className="flex flex-wrap gap-2">
                                    <span className="px-2 py-1 rounded-md bg-secondary/10 text-secondary text-[10px] font-bold uppercase tracking-wider">Score: {log.score}</span>
                                    <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-wider">#{log.mood}</span>
                                </div>
                                {log.moodImageUrl && (
                                    <div className="h-6 w-6 rounded border border-white/20 overflow-hidden">
                                        <img src={log.moodImageUrl} alt="art" className="w-full h-full object-cover" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                
                {!showAllLogs && logs.length > 1 && (
                    <div className="h-12 bg-gradient-to-t from-background-dark to-transparent pointer-events-none -mt-8 relative z-10"></div>
                )}
              </>
            )}
        </div>
        
        {!showAllLogs && logs.length > 1 && (
            <div className="text-center mt-2">
                <span className="text-xs text-gray-500 bg-background-card/50 px-3 py-1 rounded-full border border-white/5">
                    +{logs.length - 1} more {logs.length - 1 === 1 ? 'log' : 'logs'}
                </span>
            </div>
        )}
      </section>
    </div>
  );
};

export default Home;