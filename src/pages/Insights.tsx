import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

// Types for suggestions
interface Suggestion {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  category: 'sleep' | 'stress' | 'productivity' | 'health' | 'general';
  priority: 'high' | 'medium' | 'low';
  detail: string;
  actionSteps: string[];
  impact: string;
}

const Insights: React.FC = () => {
  const navigate = useNavigate();
  const { dailyScore, logs } = useApp();
  const [showCalendar, setShowCalendar] = useState(false);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  
  // Initialize to today but reset hours to start of day for proper comparison
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  
  const [currentDisplayDate, setCurrentDisplayDate] = useState(new Date());

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCalendar]);

  // Calculate calendar variables
  const daysInMonth = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth(), 1).getDay();

  // Filter logs based on selected date
  const filteredLogs = useMemo(() => {
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    return logs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= startOfDay && logDate <= endOfDay;
    });
  }, [logs, selectedDate]);

  // Calculate scores for selected date
  const selectedDateData = useMemo(() => {
    if (filteredLogs.length === 0) return null;
    
    const avgScore = Math.round(filteredLogs.reduce((sum, log) => sum + log.score, 0) / filteredLogs.length);
    const latestLog = filteredLogs[0];
    const moods = filteredLogs.map(l => l.mood);
    const dominantMood = moods.sort((a, b) => 
      moods.filter(v => v === a).length - moods.filter(v => v === b).length
    ).pop();
    
    return {
      score: avgScore,
      mood: dominantMood || latestLog.mood,
      summary: latestLog.summary,
      sentiment: latestLog.sentiment,
      logCount: filteredLogs.length,
      allMoods: moods
    };
  }, [filteredLogs]);

  // Date checks
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isFutureDate = selectedDate > today;
  const isToday = selectedDate.getTime() === today.getTime();

  // Projected score calculation
  const projectedScore = selectedDateData 
    ? Math.min(100, Math.round(selectedDateData.score * 1.05)) 
    : Math.min(100, Math.round(dailyScore * 1.05));
  const diff = projectedScore - (selectedDateData?.score || dailyScore);

  // Calendar handlers
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentDisplayDate(new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth() - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentDisplayDate(new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth() + 1, 1));
  };

  const handleDateClick = (e: React.MouseEvent, day: number) => {
    e.stopPropagation();
    const newDate = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth(), day);
    newDate.setHours(0, 0, 0, 0);
    setSelectedDate(newDate);
    setShowCalendar(false); // Auto-close calendar on date selection
  };

  const toggleSuggestion = (id: string) => {
    setExpandedSuggestion(prev => prev === id ? null : id);
  };

  const handleAcceptChallenge = (e: React.MouseEvent, title: string) => {
    e.stopPropagation();
    alert(`Challenge Accepted: "${title}" added to your goals!`);
    setExpandedSuggestion(null);
  };

  // Professional suggestions generator
  const suggestions: Suggestion[] = useMemo(() => {
    if (!selectedDateData) return [];
    
    const sugg: Suggestion[] = [];
    const score = selectedDateData.score;
    const mood = selectedDateData.mood?.toLowerCase() || '';
    const sentiment = selectedDateData.sentiment?.toLowerCase() || '';
    
    // High priority: Critical sleep issues
    if (score < 50 || mood.includes('exhausted') || mood.includes('tired')) {
      sugg.push({
        id: 'sleep-critical',
        icon: 'bedtime',
        title: 'Prioritize Sleep Recovery',
        subtitle: 'Your energy levels indicate sleep debt',
        category: 'sleep',
        priority: 'high',
        detail: 'Analysis of your check-ins shows significantly reduced cognitive performance markers. Sleep deprivation affects decision-making, emotional regulation, and physical recovery.',
        actionSteps: [
          'Establish a consistent 10:00 PM bedtime for the next 7 days',
          'Eliminate caffeine after 2:00 PM',
          'Create a 30-minute wind-down routine without screens'
        ],
        impact: 'Potential 25% improvement in daily score within one week'
      });
    }
    
    // High priority: Stress management
    if (mood.includes('stress') || mood.includes('anxious') || mood.includes('overwhelm') || sentiment === 'negative') {
      sugg.push({
        id: 'stress-management',
        icon: 'spa',
        title: 'Implement Stress Interventions',
        subtitle: 'Cortisol patterns suggest chronic stress response',
        category: 'stress',
        priority: 'high',
        detail: 'Your reported state indicates elevated sympathetic nervous system activity. Prolonged activation leads to burnout, reduced immunity, and cognitive decline.',
        actionSteps: [
          'Practice 4-7-8 breathing technique twice daily (4 inhale, 7 hold, 8 exhale)',
          'Schedule 15-minute nature exposure or walking breaks',
          'Implement boundary-setting: decline one non-essential commitment this week'
        ],
        impact: 'Reduce stress markers by 30% and improve sleep quality'
      });
    }
    
    // Medium priority: Social connection
    if (mood.includes('lonely') || mood.includes('isolated') || score < 65) {
      sugg.push({
        id: 'social-boost',
        icon: 'diversity_3',
        title: 'Strengthen Social Connections',
        subtitle: 'Social wellness directly correlates with longevity',
        category: 'health',
        priority: 'medium',
        detail: 'Research shows strong social bonds are the strongest predictor of happiness and longevity. Your patterns suggest reduced social engagement recently.',
        actionSteps: [
          'Reach out to one friend or family member today',
          'Schedule a face-to-face interaction within 48 hours',
          'Consider joining a group activity aligned with your interests'
        ],
        impact: 'Boost mood stability and provide emotional resilience buffers'
      });
    }
    
    // Productivity optimization for high performers
    if (score > 75 && !mood.includes('stress')) {
      sugg.push({
        id: 'peak-performance',
        icon: 'trending_up',
        title: 'Optimize Peak Performance Windows',
        subtitle: 'Your data reveals consistent high-performance patterns',
        category: 'productivity',
        priority: 'low',
        detail: 'Your check-ins show sustained elevated states. This is an opportunity to compound gains by aligning demanding tasks with your biological prime time.',
        actionSteps: [
          'Schedule deep work sessions between 9:00-11:00 AM',
          'Batch administrative tasks for post-lunch hours',
          'Document what conditions preceded your best days for replication'
        ],
        impact: 'Maintain momentum and achieve flow state more consistently'
      });
    }
    
    // Default if no specific triggers
    if (sugg.length === 0) {
      sugg.push({
        id: 'maintenance',
        icon: 'auto_awesome',
        title: 'Maintain Current Trajectory',
        subtitle: 'Your patterns are stable and healthy',
        category: 'general',
        priority: 'low',
        detail: 'Your metrics indicate equilibrium. Continue current habits while introducing micro-improvements to prevent plateau.',
        actionSteps: [
          'Continue daily check-ins for pattern recognition',
          'Introduce one new micro-habit this week (5-minute stretch, gratitude journaling)',
          'Review weekly trends to identify subtle shifts'
        ],
        impact: 'Sustained wellbeing and early detection of pattern changes'
      });
    }
    
    return sugg.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [selectedDateData]);

  const hasEnoughData = filteredLogs.length >= 1;

  // Category color mapping
  const getCategoryColor = (category: string) => {
    const colors: Record<string, { bg: string; text: string; border: string; glow: string }> = {
      sleep: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30', glow: 'shadow-indigo-500/20' },
      stress: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', glow: 'shadow-rose-500/20' },
      health: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
      productivity: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', glow: 'shadow-amber-500/20' },
      general: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30', glow: 'shadow-primary/20' }
    };
    return colors[category] || colors.general;
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      high: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    };
    return styles[priority] || styles.low;
  };

  return (
    <div className="pb-24 pt-4 px-5 max-w-md mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-6 pt-2 sticky top-0 z-30 bg-background-dark/95 backdrop-blur">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/5 transition-colors">
          <span className="material-symbols-outlined text-gray-400">arrow_back</span>
        </button>
        
        <div className="flex flex-col items-center">
          <h1 className="text-lg font-bold tracking-tight text-white">AI Insights</h1>
          <span className="text-xs font-medium text-primary tracking-wide">
            {isToday ? 'Live Analysis' : selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
        
        {/* Calendar Toggle */}
        <div className="relative" ref={calendarRef}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowCalendar(!showCalendar);
            }}
            className={`p-2 rounded-full transition-all duration-200 ${showCalendar ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-gray-400'}`}
          >
            <span className="material-symbols-outlined">calendar_month</span>
          </button>
          
          {showCalendar && (
            <div 
              className="absolute right-0 top-full mt-2 w-80 bg-background-card border border-white/10 rounded-2xl shadow-2xl z-50 p-4 animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Month Navigation */}
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-white text-sm">
                  {currentDisplayDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <div className="flex gap-1">
                  <button onClick={handlePrevMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>
                  <button onClick={handleNextMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </div>
              </div>
              
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2 text-gray-500 font-medium">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <span key={i}>{day}</span>
                ))}
              </div>
              
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 text-center text-sm">
                {[...Array(firstDayOfMonth)].map((_, i) => (
                  <div key={`empty-${i}`} className="h-9 w-9"></div>
                ))}
                
                {[...Array(daysInMonth)].map((_, i) => {
                  const day = i + 1;
                  const cellDate = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth(), day);
                  cellDate.setHours(0, 0, 0, 0);
                  
                  const isSelected = selectedDate.getTime() === cellDate.getTime();
                  const isTodayDate = today.getTime() === cellDate.getTime();
                  
                  const dayLogs = logs.filter(log => {
                    const logDate = new Date(log.timestamp);
                    logDate.setHours(0, 0, 0, 0);
                    return logDate.getTime() === cellDate.getTime();
                  });
                  
                  const hasLogs = dayLogs.length > 0;
                  const avgScore = hasLogs 
                    ? Math.round(dayLogs.reduce((sum, l) => sum + l.score, 0) / dayLogs.length)
                    : 0;

                  return (
                    <button 
                      key={day} 
                      onClick={(e) => handleDateClick(e, day)}
                      className={`
                        h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 relative text-xs font-medium
                        ${isSelected ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-105' : 'text-gray-300 hover:bg-white/10'}
                        ${isTodayDate && !isSelected ? 'border border-primary/50 text-primary' : ''}
                        ${hasLogs && !isSelected ? 'bg-secondary/10 text-secondary' : ''}
                      `}
                    >
                      {day}
                      {hasLogs && !isSelected && (
                        <span className={`
                          absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full
                          ${avgScore >= 70 ? 'bg-emerald-400' : avgScore >= 50 ? 'bg-amber-400' : 'bg-rose-400'}
                        `}></span>
                      )}
                    </button>
                  );
                })}
              </div>
              
              {/* Footer */}
              <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center">
                <span className="text-xs text-gray-400">
                  {filteredLogs.length} check-in{filteredLogs.length !== 1 ? 's' : ''}
                </span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    setSelectedDate(now);
                    setCurrentDisplayDate(new Date());
                    setShowCalendar(false);
                  }}
                  className="text-xs font-semibold text-primary hover:text-white transition-colors px-3 py-1 rounded-full hover:bg-primary/10"
                >
                  Jump to Today
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Data Status */}
      {!hasEnoughData && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-center">
          <span className="material-symbols-outlined text-amber-400 text-2xl mb-2">analytics</span>
          <p className="text-sm text-amber-200 font-medium">
            {isFutureDate ? 'Future Date Selected' : 'No Data Available'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {isFutureDate ? 'Insights will be available after this date' : 'Complete a voice check-in to generate insights'}
          </p>
        </div>
      )}

      {/* Score Projection Card */}
      <section className="mb-8">
        <div className="flex items-center justify-between px-1 mb-3">
          <h2 className="text-base font-semibold text-white">
            {isToday ? 'Life Quality Score' : 'Historical Analysis'}
          </h2>
          {hasEnoughData && (
            <span className="bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full border border-primary/30">
              {diff >= 0 ? '+' : ''}{diff} projected
            </span>
          )}
        </div>
        
        <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5" 
            style={{
              backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)', 
              backgroundSize: '40px 40px'
            }}
          />

          {!hasEnoughData ? (
            <div className="h-48 flex flex-col items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-3xl text-gray-600">insert_chart</span>
              </div>
              <p className="text-gray-500 text-sm font-medium">Select a date with check-in data</p>
              <p className="text-gray-600 text-xs mt-1">Insights require at least one voice entry</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-end mb-6 relative z-10">
                <div>
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">
                    {isToday ? 'Current' : 'Day Average'}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-white tracking-tight">{selectedDateData?.score}</span>
                    <span className="text-sm text-gray-500 font-medium">/100</span>
                  </div>
                  {selectedDateData && selectedDateData.logCount > 1 && (
                    <p className="text-xs text-gray-400 mt-1">{selectedDateData.logCount} entries analyzed</p>
                  )}
                </div>
                
                <div className="text-right">
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Projected</p>
                  <span className="text-4xl font-bold text-primary">{projectedScore}</span>
                </div>
              </div>

              {/* Visual Chart */}
              <div className="relative h-24 w-full">
                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 200 60">
                  <defs>
                    <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#3d99f5" stopOpacity="0.3"/>
                      <stop offset="100%" stopColor="#3d99f5" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <path 
                    d="M0,50 C40,45 80,20 120,25 C160,30 180,10 200,5" 
                    fill="none" 
                    stroke="#3d99f5" 
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path 
                    d="M0,50 C40,45 80,20 120,25 C160,30 180,10 200,5 L200,60 L0,60 Z" 
                    fill="url(#chartGradient)"
                  />
                  <circle cx="120" cy="25" r="4" fill="#0f172a" stroke="#3d99f5" strokeWidth="2"/>
                  <circle cx="200" cy="5" r="4" fill="#3d99f5" className="animate-pulse"/>
                </svg>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Professional Correction Suggestions */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-white text-lg font-bold">Personalized Recommendations</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {hasEnoughData ? 'AI-generated based on your patterns' : 'Complete check-in to unlock'}
            </p>
          </div>
          {hasEnoughData && (
            <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
              {suggestions.length} active
            </span>
          )}
        </div>
        
        {!hasEnoughData ? (
          <div className="glass-panel rounded-2xl p-8 text-center border border-white/5">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-primary">psychology</span>
            </div>
            <p className="text-sm text-gray-300 font-medium mb-1">No recommendations yet</p>
            <p className="text-xs text-gray-500">Voice check-ins enable personalized AI coaching</p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((sugg, index) => {
              const colors = getCategoryColor(sugg.category);
              const isExpanded = expandedSuggestion === sugg.id;
              
              return (
                <div 
                  key={sugg.id}
                  className={`
                    group relative overflow-hidden rounded-2xl border transition-all duration-300
                    ${isExpanded ? `${colors.border} bg-background-card` : 'border-white/5 hover:border-white/10'}
                  `}
                >
                  {/* Priority Indicator Bar */}
                  <div className={`
                    absolute left-0 top-0 bottom-0 w-1 transition-all duration-300
                    ${sugg.priority === 'high' ? 'bg-rose-500' : sugg.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}
                    ${isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                  `}></div>
                  
                  {/* Header - Always Visible */}
                  <div 
                    onClick={() => toggleSuggestion(sugg.id)}
                    className="p-4 cursor-pointer"
                  >
                    <div className="flex gap-4 items-start">
                      {/* Icon */}
                      <div className={`
                        h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300
                        ${colors.bg} ${colors.text}
                        ${isExpanded ? 'shadow-lg ' + colors.glow : ''}
                      `}>
                        <span className="material-symbols-outlined text-2xl">{sugg.icon}</span>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-semibold text-white leading-tight">{sugg.title}</h4>
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{sugg.subtitle}</p>
                          </div>
                          <span className={`
                            text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0
                            ${getPriorityBadge(sugg.priority)}
                          `}>
                            {sugg.priority}
                          </span>
                        </div>
                      </div>
                      
                      {/* Expand Icon */}
                      <div className={`
                        h-6 w-6 rounded-full border border-gray-600 flex items-center justify-center shrink-0 transition-all duration-300 mt-1
                        ${isExpanded ? 'bg-white/10 rotate-180' : 'group-hover:border-gray-500'}
                      `}>
                        <span className="material-symbols-outlined text-sm text-gray-400">expand_more</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Content */}
                  <div className={`
                    grid transition-all duration-300 ease-out
                    ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}
                  `}>
                    <div className="overflow-hidden">
                      <div className="px-4 pb-4 pt-0">
                        <div className="border-t border-white/5 pt-4 space-y-4">
                          {/* Detailed Analysis */}
                          <div>
                            <h5 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">Analysis</h5>
                            <p className="text-sm text-gray-400 leading-relaxed">{sugg.detail}</p>
                          </div>
                          
                          {/* Action Steps */}
                          <div>
                            <h5 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">Recommended Actions</h5>
                            <ul className="space-y-2">
                              {sugg.actionSteps.map((step, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                                  <span className="material-symbols-outlined text-primary text-sm mt-0.5">check_circle_outline</span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          
                          {/* Impact Prediction */}
                          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="material-symbols-outlined text-emerald-400 text-sm">trending_up</span>
                              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Projected Impact</span>
                            </div>
                            <p className="text-sm text-gray-300">{sugg.impact}</p>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex gap-3 pt-2">
                            <button 
                              onClick={(e) => handleAcceptChallenge(e, sugg.title)}
                              className="flex-1 bg-primary hover:bg-blue-500 text-white text-sm font-semibold py-3 rounded-xl transition-all shadow-lg shadow-primary/20 active:scale-95"
                            >
                              Accept Challenge
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSuggestion(sugg.id);
                              }}
                              className="px-4 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-medium text-gray-400 transition-colors"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default Insights;