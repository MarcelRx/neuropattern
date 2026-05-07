import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useApp } from '../context/AppContext';

// Types for key shifts
interface ShiftMetric {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  currentValue: string;
  previousValue: string;
  change: number;
  trend: 'up' | 'down' | 'stable';
  color: string;
  insight: string;
  recommendation: string;
}

const Analysis: React.FC = () => {
  const navigate = useNavigate();
  const { logs, dailyScore, resetData } = useApp();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [showMenu, setShowMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [chartCurve, setChartCurve] = useState<'monotone' | 'linear' | 'step'>('monotone');
  const [showGrid, setShowGrid] = useState(false);

  // Chart data processing
  const data = useMemo(() => {
    const sliceCount = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    
    const chartData = [...logs]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-sliceCount)
      .map(log => ({
        name: new Intl.DateTimeFormat('en-US', { 
          weekday: timeRange === '7d' ? 'short' : undefined,
          month: timeRange !== '7d' ? 'short' : undefined,
          day: 'numeric'
        }).format(new Date(log.timestamp)),
        score: log.score,
        fullDate: new Date(log.timestamp).toLocaleDateString(),
        mood: log.mood
      }));

    if (chartData.length === 0) {
      return [{ name: 'No Data', score: 0, fullDate: '', mood: '' }];
    }
    return chartData;
  }, [logs, timeRange]);

  // Calculate trend
  const trend = useMemo(() => {
    if (logs.length < 2) return { value: 0, direction: 'stable' as const };
    const recent = logs.slice(0, 7);
    const avgRecent = recent.reduce((sum, l) => sum + l.score, 0) / recent.length;
    const previous = logs.slice(7, 14);
    const avgPrevious = previous.length > 0 
      ? previous.reduce((sum, l) => sum + l.score, 0) / previous.length 
      : avgRecent;
    
    const change = avgRecent - avgPrevious;
    return {
      value: Math.round(change),
      direction: change > 2 ? 'up' : change < -2 ? 'down' : 'stable'
    };
  }, [logs]);

  // Generate professional key shifts based on actual log data
  const keyShifts: ShiftMetric[] = useMemo(() => {
    if (logs.length < 2) return [];

    const shifts: ShiftMetric[] = [];
    const recentLogs = logs.slice(0, 7);
    const previousLogs = logs.slice(7, 14);
    
    // Sleep Quality Analysis
    const sleepMentions = recentLogs.filter(l => 
      l.summary.toLowerCase().includes('sleep') || 
      l.summary.toLowerCase().includes('rest') ||
      l.summary.toLowerCase().includes('tired')
    );
    const prevSleepMentions = previousLogs.filter(l => 
      l.summary.toLowerCase().includes('sleep') || 
      l.summary.toLowerCase().includes('rest') ||
      l.summary.toLowerCase().includes('tired')
    );
    
    if (sleepMentions.length > 0 || prevSleepMentions.length > 0) {
      const recentSleepScore = sleepMentions.reduce((sum, l) => sum + l.score, 0) / (sleepMentions.length || 1);
      const prevSleepScore = prevSleepMentions.reduce((sum, l) => sum + l.score, 0) / (prevSleepMentions.length || 1);
      const sleepChange = recentSleepScore - prevSleepScore;
      
      shifts.push({
        id: 'sleep',
        icon: 'bedtime',
        title: 'Sleep Quality',
        subtitle: sleepChange > 0 ? 'Restorative sleep improving' : 'Sleep optimization needed',
        currentValue: sleepMentions.length > 0 ? `${Math.round(recentSleepScore)}%` : 'N/A',
        previousValue: prevSleepMentions.length > 0 ? `${Math.round(prevSleepScore)}%` : 'N/A',
        change: Math.abs(Math.round(sleepChange)),
        trend: sleepChange > 5 ? 'up' : sleepChange < -5 ? 'down' : 'stable',
        color: 'indigo',
        insight: sleepChange > 0 
          ? 'Your recent check-ins indicate improved sleep satisfaction. Deep sleep phases likely increased.'
          : 'Sleep-related stressors detected. Consider implementing wind-down protocols.',
        recommendation: 'Maintain consistent 10:00 PM bedtime. Avoid blue light 60 minutes before sleep.'
      });
    }

    // Emotional Resilience
    const negativeSentiment = recentLogs.filter(l => l.sentiment === 'negative' || l.score < 50).length;
    const prevNegative = previousLogs.filter(l => l.sentiment === 'negative' || l.score < 50).length;
    const totalRecent = recentLogs.length || 1;
    const totalPrev = previousLogs.length || 1;
    
    const resilienceChange = ((prevNegative / totalPrev) - (negativeSentiment / totalRecent)) * 100;
    
    shifts.push({
      id: 'resilience',
      icon: 'psychology',
      title: 'Emotional Resilience',
      subtitle: resilienceChange > 0 ? 'Stress management improving' : 'Monitor stress indicators',
      currentValue: `${Math.round((1 - negativeSentiment/totalRecent) * 100)}%`,
      previousValue: `${Math.round((1 - prevNegative/totalPrev) * 100)}%`,
      change: Math.abs(Math.round(resilienceChange)),
      trend: resilienceChange > 10 ? 'up' : resilienceChange < -10 ? 'down' : 'stable',
      color: 'emerald',
      insight: resilienceChange > 0
        ? 'Positive sentiment increasing. Your coping mechanisms are strengthening.'
        : 'Elevated stress patterns detected. Consider mindfulness interventions.',
      recommendation: 'Practice 4-7-8 breathing twice daily. Schedule recovery activities.'
    });

    // Social Connection
    const socialMentions = recentLogs.filter(l => 
      l.summary.toLowerCase().includes('friend') || 
      l.summary.toLowerCase().includes('family') ||
      l.summary.toLowerCase().includes('social') ||
      l.summary.toLowerCase().includes('lonely')
    );
    const prevSocial = previousLogs.filter(l => 
      l.summary.toLowerCase().includes('friend') || 
      l.summary.toLowerCase().includes('family') ||
      l.summary.toLowerCase().includes('social') ||
      l.summary.toLowerCase().includes('lonely')
    );

    if (socialMentions.length > 0 || prevSocial.length > 0) {
      const socialChange = socialMentions.length - prevSocial.length;
      shifts.push({
        id: 'social',
        icon: 'diversity_3',
        title: 'Social Connection',
        subtitle: socialChange >= 0 ? 'Social engagement active' : 'Connection opportunities identified',
        currentValue: `${socialMentions.length} mentions`,
        previousValue: `${prevSocial.length} mentions`,
        change: Math.abs(socialChange),
        trend: socialChange > 0 ? 'up' : socialChange < 0 ? 'down' : 'stable',
        color: 'violet',
        insight: socialChange >= 0
          ? 'Social wellness maintained. Strong relationships correlate with longevity.'
          : 'Reduced social references detected. Isolation impacts mental health.',
        recommendation: 'Schedule one meaningful interaction this week. Quality over quantity.'
      });
    }

    // Cognitive Performance (based on score consistency)
    const recentVariance = recentLogs.reduce((sum, l) => sum + Math.pow(l.score - (recentLogs.reduce((s, log) => s + log.score, 0)/recentLogs.length), 2), 0) / recentLogs.length;
    const prevVariance = previousLogs.length > 0 
      ? previousLogs.reduce((sum, l) => sum + Math.pow(l.score - (previousLogs.reduce((s, log) => s + log.score, 0)/previousLogs.length), 2), 0) / previousLogs.length 
      : recentVariance;
    const stabilityChange = ((prevVariance - recentVariance) / (prevVariance || 1)) * 100;

    shifts.push({
      id: 'cognitive',
      icon: 'neurology',
      title: 'Cognitive Stability',
      subtitle: stabilityChange > 0 ? 'Mental state stabilizing' : 'Fluctuations detected',
      currentValue: `${Math.round(100 - (recentVariance/100))}%`,
      previousValue: `${Math.round(100 - (prevVariance/100))}%`,
      change: Math.abs(Math.round(stabilityChange)),
      trend: stabilityChange > 15 ? 'up' : stabilityChange < -15 ? 'down' : 'stable',
      color: 'amber',
      insight: stabilityChange > 0
        ? 'Score variance decreasing. Your routines are creating predictability.'
        : 'Inconsistent patterns suggest external disruptors or routine changes.',
      recommendation: 'Audit recent changes. Protect morning routines. Limit decision fatigue.'
    });

    return shifts.sort((a, b) => {
      const priority = { down: 0, stable: 1, up: 2 };
      return priority[a.trend] - priority[b.trend];
    });
  }, [logs]);

  // Export CSV handler
  const handleExportCSV = () => {
    const headers = ['Date', 'Time', 'Score', 'Mood', 'Sentiment', 'Summary'];
    const rows = logs.map(log => {
      const date = new Date(log.timestamp);
      return [
        date.toLocaleDateString(),
        date.toLocaleTimeString(),
        log.score,
        log.mood,
        log.sentiment || 'neutral',
        `"${log.summary.replace(/"/g, '""')}"`
      ].join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `neuropattern_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowMenu(false);
  };

  const handleClearHistory = () => {
    resetData();
    setShowClearModal(false);
    setShowMenu(false);
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', icon: 'trending_up' };
      case 'down': return { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', icon: 'trending_down' };
      default: return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', icon: 'trending_flat' };
    }
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string; glow: string }> = {
      indigo: { bg: 'bg-indigo-500', text: 'text-indigo-400', border: 'border-indigo-500/30', glow: 'shadow-indigo-500/20' },
      emerald: { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
      violet: { bg: 'bg-violet-500', text: 'text-violet-400', border: 'border-violet-500/30', glow: 'shadow-violet-500/20' },
      amber: { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/30', glow: 'shadow-amber-500/20' }
    };
    return colors[color] || colors.indigo;
  };

  return (
    <div className="pb-24 pt-4 px-5 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 sticky top-0 bg-background-dark/95 backdrop-blur z-20 py-2">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/5 transition-colors">
          <span className="material-symbols-outlined text-gray-400">arrow_back</span>
        </button>
        <h2 className="text-lg font-bold">Progress Analysis</h2>
        
        {/* Menu */}
        <div className="relative">
          <button 
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} 
            className="p-2 rounded-full hover:bg-white/5 transition-colors"
          >
            <span className="material-symbols-outlined text-gray-400">more_horiz</span>
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-background-card border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <button 
                onClick={handleExportCSV}
                className="w-full text-left px-4 py-3 text-xs font-medium text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">download</span> 
                Export Data (CSV)
              </button>
              <button 
                onClick={() => { setShowSettingsModal(true); setShowMenu(false); }}
                className="w-full text-left px-4 py-3 text-xs font-medium text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">tune</span> 
                Chart Settings
              </button>
              <div className="h-px bg-white/5 my-1"></div>
              <button 
                onClick={() => { setShowClearModal(true); setShowMenu(false); }}
                className="w-full text-left px-4 py-3 text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">delete_forever</span> 
                Clear History
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="bg-background-card p-1 rounded-xl flex mb-6 border border-white/5">
        {(['7d', '30d', '90d'] as const).map((range) => (
          <button 
            key={range}
            onClick={() => setTimeRange(range)}
            className={`
              flex-1 py-2 text-sm font-medium rounded-lg transition-all
              ${timeRange === range 
                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'}
            `}
          >
            {range === '7d' ? 'Week' : range === '30d' ? 'Month' : 'Quarter'}
          </button>
        ))}
      </div>

      {/* Main Chart Card */}
      <div className="glass-panel rounded-2xl p-6 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 size-40 rounded-full bg-primary/10 blur-3xl"></div>
        
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div>
            <p className="text-gray-400 text-sm font-medium mb-1">Overall Life Quality</p>
            <div className="flex items-baseline gap-3">
              <h1 className="text-4xl font-bold text-white">{dailyScore}<span className="text-xl text-gray-500 font-normal">/100</span></h1>
              {trend.value !== 0 && (
                <span className={`
                  flex items-center text-xs font-bold px-2.5 py-1 rounded-full border
                  ${getTrendColor(trend.direction).bg} ${getTrendColor(trend.direction).text} ${getTrendColor(trend.direction).border}
                `}>
                  <span className="material-symbols-outlined text-[14px] mr-1">{getTrendColor(trend.direction).icon}</span>
                  {trend.value > 0 ? '+' : ''}{trend.value} pts
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="h-48 w-full relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              {showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />}
              <Tooltip 
                cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  borderRadius: '12px',
                  padding: '12px'
                }} 
                itemStyle={{ color: '#fff', fontSize: '12px' }} 
                labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontSize: '11px' }}
              />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#64748b' }} 
                dy={10} 
              />
              <Area 
                type={chartCurve} 
                dataKey="score" 
                stroke="#10b981" 
                strokeWidth={2.5} 
                fillOpacity={1} 
                fill="url(#colorScore)" 
                animationDuration={1000} 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Professional Key Shifts Section */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <h3 className="text-white text-lg font-bold">Key Behavioral Shifts</h3>
          <p className="text-xs text-gray-400 mt-0.5">Pattern analysis from voice entries</p>
        </div>
        <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
          {keyShifts.length} metrics
        </span>
      </div>

      <div className="space-y-3 mb-8">
        {keyShifts.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center border border-white/5">
            <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-gray-500">analytics</span>
            </div>
            <p className="text-sm text-gray-400 font-medium">Insufficient data for pattern analysis</p>
            <p className="text-xs text-gray-500 mt-1">Complete more voice check-ins to unlock insights</p>
          </div>
        ) : (
          keyShifts.map((shift) => {
            const colors = getColorClasses(shift.color);
            const trendColors = getTrendColor(shift.trend);
            
            return (
              <div 
                key={shift.id}
                className="group glass-panel rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-all duration-300"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-11 w-11 rounded-xl ${colors.bg}/10 flex items-center justify-center ${colors.text}`}>
                      <span className="material-symbols-outlined text-xl">{shift.icon}</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{shift.title}</h4>
                      <p className="text-xs text-gray-400">{shift.subtitle}</p>
                    </div>
                  </div>
                  <div className={`
                    flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold
                    ${trendColors.bg} ${trendColors.text} ${trendColors.border}
                  `}>
                    <span className="material-symbols-outlined text-[14px]">{trendColors.icon}</span>
                    {shift.change > 0 && '+'}{shift.change}%
                  </div>
                </div>

                {/* Comparison Bars */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-12 font-medium">Previous</span>
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gray-600 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, parseInt(shift.previousValue) || 50)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right font-mono">{shift.previousValue}</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white w-12 font-medium">Current</span>
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${colors.bg} rounded-full transition-all duration-500 ${colors.glow}`}
                        style={{ width: `${Math.min(100, parseInt(shift.currentValue) || 50)}%` }}
                      ></div>
                    </div>
                    <span className={`text-xs ${colors.text} w-12 text-right font-mono font-semibold`}>
                      {shift.currentValue}
                    </span>
                  </div>
                </div>

                {/* AI Insight */}
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-primary text-sm mt-0.5">lightbulb</span>
                    <div>
                      <p className="text-xs text-gray-300 leading-relaxed mb-2">{shift.insight}</p>
                      <p className="text-xs text-gray-500">
                        <span className="text-emerald-400 font-medium">Recommendation: </span>
                        {shift.recommendation}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Chart Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background-card border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-4">Chart Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Curve Style</label>
                <div className="flex gap-2">
                  {(['monotone', 'linear', 'step'] as const).map((curve) => (
                    <button 
                      key={curve}
                      onClick={() => setChartCurve(curve)}
                      className={`
                        flex-1 py-2 rounded-lg text-xs font-medium border transition-all capitalize
                        ${chartCurve === curve 
                          ? 'bg-primary/20 border-primary text-primary' 
                          : 'border-white/10 text-gray-400 hover:bg-white/5'}
                      `}
                    >
                      {curve}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                <span className="text-sm text-gray-300">Show Grid Lines</span>
                <button 
                  onClick={() => setShowGrid(!showGrid)}
                  className={`w-11 h-6 rounded-full relative transition-colors ${showGrid ? 'bg-primary' : 'bg-gray-600'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${showGrid ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </button>
              </div>
              
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-primary/20 mt-2"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear History Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background-card border border-rose-500/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center mb-4">
              <div className="h-12 w-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-rose-500 text-2xl">delete_forever</span>
              </div>
              <h3 className="text-lg font-bold text-white">Clear All History?</h3>
              <p className="text-sm text-gray-400 mt-2">
                This permanently deletes all check-in logs and analysis data. This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setShowClearModal(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-300 font-medium hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleClearHistory}
                className="flex-1 py-3 rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/20"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analysis;