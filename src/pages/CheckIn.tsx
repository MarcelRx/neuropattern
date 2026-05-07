import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { AppRoute, Log } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type: 'text' | 'voice';
  audioUrl?: string;
  actions?: ActionButton[];
  isLoading?: boolean;
}

interface ActionButton {
  label: string;
  action: string;
  type: 'checkin' | 'analyze' | 'plan' | 'tips' | 'navigate';
  route?: string;
}

const AI_COACH_AVATAR = 'https://api.dicebear.com/7.x/bottts/svg?seed=Nova&backgroundColor=b6e3f4';

// Navigation items matching your screenshot
const NAV_ITEMS = [
  { route: AppRoute.HOME, icon: 'home', label: 'Home' },
  { route: AppRoute.ANALYSIS, icon: 'donut_large', label: 'Analytics' },
  { route: AppRoute.COACH, icon: 'psychology', label: 'Coach', hasIndicator: true },
  { route: AppRoute.INSIGHTS, icon: 'auto_graph', label: 'Insights' },
  { route: AppRoute.PROFILE, icon: 'settings', label: 'Settings' },
];

const CheckIn: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logs, habits, userProfile, dailyScore, addLog, refreshData } = useApp();
  
  // Chat state - initialize with empty array, greeting will be set immediately
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Menu state
  const [showMenu, setShowMenu] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Generate greeting message immediately on mount
  useEffect(() => {
    if (!isInitialized) {
      const greeting = generateInitialGreeting();
      setMessages([greeting]);
      setIsInitialized(true);
    }
  }, [isInitialized, logs, userProfile, dailyScore]);

  // Auto-scroll when messages change
  useEffect(() => {
    if (messagesEndRef.current && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const generateInitialGreeting = (): Message => {
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    const firstName = userProfile.name?.split(' ')[0] || 'there';
    
    const hasData = logs.length > 0;
    const recentScore = logs[0]?.score || dailyScore;
    
    let greeting = '';
    let actions: ActionButton[] = [];
    
    if (!hasData) {
      greeting = `Good ${timeOfDay}, ${firstName}! 👋\n\nI'm **Nova**, your AI Life Coach. I'm here to help you understand your patterns, improve your wellbeing, and create personalized plans for a better life.\n\nTo get started, I'd love to learn about you. How are you feeling right now? What's been on your mind today?`;
      
      actions = [
        { label: "📝 Start Daily Check-in", action: "start_checkin", type: "checkin" },
        { label: "📊 View My Dashboard", action: "go_dashboard", type: "navigate", route: AppRoute.HOME },
        { label: "💡 How Does This Work?", action: "explain_app", type: "tips" }
      ];
    } else {
      const trend = recentScore >= 70 ? 'doing great' : recentScore >= 50 ? 'making progress' : 'facing some challenges';
      
      greeting = `Welcome back, ${firstName}! 🌟\n\nI see you're ${trend} today (Score: ${recentScore}). ${logs.length > 5 ? `I've analyzed your ${logs.length} check-ins and have some insights.` : 'Keep checking in to unlock deeper insights.'}\n\nWhat would you like to focus on today?`;
      
      actions = [
        { label: "📝 New Check-in", action: "start_checkin", type: "checkin" },
        { label: "📈 Analyze My Patterns", action: "analyze_patterns", type: "analyze" },
        { label: "🎯 Create Weekly Plan", action: "create_plan", type: "plan" },
        { label: "🏠 Go to Dashboard", action: "go_dashboard", type: "navigate", route: AppRoute.HOME }
      ];
    }

    return {
      id: 'greeting-' + Date.now(),
      role: 'assistant',
      content: greeting,
      timestamp: new Date(),
      type: 'text',
      actions
    };
  };

  // Menu action handlers
  const handleClearChat = () => {
    setMessages([]);
    setTimeout(() => {
      const greeting = generateInitialGreeting();
      setMessages([greeting]);
    }, 100);
    setShowMenu(false);
  };

  const handleExportChat = () => {
    const chatText = messages.map(m => 
      `${m.role === 'assistant' ? 'Nova' : 'You'} (${new Date(m.timestamp).toLocaleTimeString()}):\n${m.content}`
    ).join('\n\n');
    
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nova-chat-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  const handleViewHistory = () => {
    navigate(AppRoute.ANALYSIS);
    setShowMenu(false);
  };

  const sendMessage = async (content: string, type: 'text' | 'voice' = 'text') => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
      type
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsProcessing(true);

    try {
      const quickResponse = handleQuickAction(content);
      if (quickResponse) {
        setTimeout(() => {
          setMessages(prev => [...prev, quickResponse]);
          setIsProcessing(false);
        }, 800);
        return;
      }

      const response = await fetch('http://localhost:8000/coach/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          message: content,
          context: {
            recentLogs: logs.slice(0, 10),
            habits,
            dailyScore,
            userName: userProfile.name,
            hasCompletedOnboarding
          },
          type,
          generateVoice: false
        })
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        type: 'text',
        actions: data.suggestedActions || []
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.checkInData) {
        await saveCheckIn(data.checkInData);
      }

      if (!hasCompletedOnboarding) {
        setHasCompletedOnboarding(true);
      }

    } catch (error) {
      console.error('Coach error:', error);
      
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting right now. Let me try a simpler approach—can you tell me one thing that went well today and one thing you'd like to improve?",
        timestamp: new Date(),
        type: 'text',
        actions: [
          { label: "🔄 Try Again", action: "retry", type: "tips" }
        ]
      };
      
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickAction = (content: string): Message | null => {
    const lower = content.toLowerCase();
    
    if (lower.includes('go home') || lower.includes('dashboard')) {
      navigate(AppRoute.HOME);
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Taking you to your dashboard now! 📊",
        timestamp: new Date(),
        type: 'text'
      };
    }
    
    if (lower.includes('analyze') && logs.length > 0) {
      const avgScore = Math.round(logs.reduce((sum, l) => sum + l.score, 0) / logs.length);
      const topMood = logs.map(l => l.mood).sort((a, b) => 
        logs.filter(l => l.mood === a).length - logs.filter(l => l.mood === b).length
      ).pop();
      
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: `**Your Pattern Analysis** 📈\n\nBased on your ${logs.length} check-ins:\n\n• **Average Score:** ${avgScore}/100\n• **Most Common Mood:** ${topMood}\n• **Trend:** ${avgScore > 60 ? 'Improving 📈' : 'Needs attention ⚠️'}\n\n**Key Insight:** Your scores tend to be higher on days when you mention social connections or exercise. Consider prioritizing these!`,
        timestamp: new Date(),
        type: 'text',
        actions: [
          { label: "📊 Full Analysis", action: "go_analysis", type: "navigate", route: AppRoute.ANALYSIS },
          { label: "🎯 Create Plan", action: "create_plan", type: "plan" }
        ]
      };
    }
    
    return null;
  };

  const saveCheckIn = async (checkInData: any) => {
    const newLog: Log = {
      id: Date.now().toString(),
      timestamp: new Date(),
      score: checkInData.score,
      mood: checkInData.mood,
      summary: checkInData.summary,
      sentiment: checkInData.sentiment
    };

    addLog(newLog);

    try {
      await fetch('http://localhost:8000/coach/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(checkInData)
      });
      
      refreshData();
    } catch (error) {
      console.error('Failed to sync check-in:', error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await processVoiceMessage(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      alert("Please allow microphone access.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) window.clearInterval(timerRef.current);
      setRecordingTime(0);
    }
  };

  const processVoiceMessage = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    setTimeout(() => {
      sendMessage("🎤 [Voice message - transcription in development]", 'voice');
    }, 1000);
  };

  const handleAction = (action: ActionButton) => {
    switch (action.action) {
      case 'start_checkin':
        sendMessage("I'd like to do my daily check-in. Ask me about my day.");
        break;
      case 'go_dashboard':
      case 'go_analysis':
      case 'go_insights':
        if (action.route) navigate(action.route);
        break;
      case 'explain_app':
        const explanation: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `**How NeuroPattern Works:** 🧠\n\n1. **Daily Check-ins** - Tell me about your day via voice or text\n2. **AI Analysis** - I analyze your mood, stress, and patterns\n3. **Life Score** - Get a 0-100 score based on multiple factors\n4. **Personalized Plans** - I create custom routines to improve your score\n5. **Track Progress** - View trends and insights over time\n\nThe more you check in, the smarter my recommendations become!`,
          timestamp: new Date(),
          type: 'text',
          actions: [
            { label: "📝 Start First Check-in", action: "start_checkin", type: "checkin" }
          ]
        };
        setMessages(prev => [...prev, explanation]);
        break;
      case 'analyze_patterns':
        sendMessage("Can you analyze my recent patterns and trends?");
        break;
      case 'create_plan':
        sendMessage("I'd like you to create a personalized weekly plan for me based on my data.");
        break;
      default:
        sendMessage(action.action);
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    }).format(date);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isActiveRoute = (route: string) => {
    return location.pathname === route || (route === AppRoute.COACH && location.pathname.includes('coach'));
  };

  return (
    <div className="min-h-screen bg-background-dark flex flex-col">
      {/* Main Content Area */}
      <div className="flex-1 pb-24 pt-4 px-5 max-w-md mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-1 sticky top-0 z-30 bg-background-dark/95 backdrop-blur">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/5 text-gray-400">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src={AI_COACH_AVATAR} alt="Nova" className="h-10 w-10 rounded-full bg-primary/20" />
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background-dark animate-pulse"></span>
            </div>
            <div>
              <h1 className="font-bold text-white">Nova</h1>
              <p className="text-xs text-emerald-400">AI Life Coach Online</p>
            </div>
          </div>
          
          {/* Menu button */}
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-full hover:bg-white/5 text-gray-400 transition-colors"
            >
              <span className="material-symbols-outlined">more_vert</span>
            </button>
            
            {showMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-background-card border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <button 
                  onClick={handleClearChat}
                  className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-gray-400">delete_sweep</span>
                  Clear Conversation
                </button>
                <button 
                  onClick={handleExportChat}
                  className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-gray-400">download</span>
                  Export Chat
                </button>
                <button 
                  onClick={handleViewHistory}
                  className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-gray-400">history</span>
                  View History
                </button>
                <div className="h-px bg-white/10 my-1"></div>
                <button 
                  onClick={() => { setShowMenu(false); navigate(AppRoute.PROFILE); }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-gray-400">settings</span>
                  Settings
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Messages - Full height container with proper scrolling */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1"
          style={{ maxHeight: 'calc(100vh - 280px)', minHeight: '300px' }}
        >
          {messages.length === 0 ? (
            // Loading state while greeting is being generated
            <div className="flex justify-center items-center h-full">
              <div className="flex items-center gap-2 text-gray-500">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                </div>
                <span className="text-xs">Nova is waking up...</span>
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div 
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className={`max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-1">
                      <img src={AI_COACH_AVATAR} alt="Nova" className="h-5 w-5 rounded-full" />
                      <span className="text-xs text-gray-500">Nova</span>
                    </div>
                  )}
                  
                  <div className={`
                    px-4 py-3 rounded-2xl text-sm leading-relaxed
                    ${msg.role === 'user' 
                      ? 'bg-primary text-white rounded-br-md' 
                      : 'bg-background-card text-gray-200 border border-white/5 rounded-bl-md'}
                  `}>
                    <div className="whitespace-pre-wrap prose prose-invert prose-sm max-w-none">
                      {msg.content.split('**').map((part, i) => 
                        i % 2 === 1 ? <strong key={i} className="text-white">{part}</strong> : part
                      )}
                    </div>
                  </div>
                  
                  <span className="text-[10px] text-gray-600 mt-1 px-1">
                    {formatTime(msg.timestamp)}
                  </span>
                  
                  {msg.actions && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {msg.actions.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleAction(action)}
                          className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/30 text-xs text-gray-300 hover:text-white transition-all"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-background-card border border-white/5 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                  </div>
                  <span className="text-xs text-gray-500">Nova is thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} className="h-1" />
        </div>

        {/* FIXED: Quick Actions - Static grid, no horizontal scroll */}
        {!isProcessing && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
          <div className="py-3 border-t border-white/5 mb-2">
            <div className="grid grid-cols-2 gap-2">
              {['How was my week?', 'Sleep tips', 'Reduce stress', 'View progress'].map((quick, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(quick)}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-primary/20 text-xs text-gray-400 hover:text-white transition-all text-center truncate"
                >
                  {quick}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-white/5 bg-background-card/30 -mx-5 px-5 py-4 sticky bottom-0">
          {isRecording ? (
            <div className="flex items-center justify-between bg-rose-500/10 border border-rose-500/30 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-rose-500 flex items-center justify-center animate-pulse">
                  <span className="material-symbols-outlined text-white text-sm">mic</span>
                </div>
                <div>
                  <p className="text-sm text-rose-400 font-medium">Recording...</p>
                  <p className="text-xs text-rose-300">{formatDuration(recordingTime)}</p>
                </div>
              </div>
              <button 
                onClick={stopRecording}
                className="h-10 w-10 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-white">stop</span>
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <button 
                onClick={startRecording}
                className="h-11 w-11 rounded-full bg-white/5 hover:bg-primary/20 border border-white/10 flex items-center justify-center text-gray-400 hover:text-primary transition-all shrink-0"
              >
                <span className="material-symbols-outlined">mic</span>
              </button>
              
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(inputText);
                    }
                  }}
                  placeholder="Message Nova..."
                  className="w-full bg-background-card border border-white/10 rounded-2xl px-4 py-3 pr-12 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 resize-none max-h-32"
                  rows={1}
                  style={{ minHeight: '44px' }}
                />
                <button 
                  onClick={() => sendMessage(inputText)}
                  disabled={!inputText.trim() || isProcessing}
                  className="absolute right-2 bottom-2 h-8 w-8 rounded-full bg-primary hover:bg-blue-500 disabled:bg-gray-700 flex items-center justify-center transition-colors"
                >
                  <span className="material-symbols-outlined text-white text-sm">send</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation Panel */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background-dark/95 backdrop-blur-lg border-t border-white/5 px-4 py-2 z-50">
        <div className="max-w-md mx-auto flex items-center justify-between">
          {NAV_ITEMS.map((item) => {
            const isActive = isActiveRoute(item.route);
            return (
              <button
                key={item.route}
                onClick={() => navigate(item.route)}
                className="flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all duration-200 relative group"
              >
                <div className="relative">
                  <span 
                    className={`material-symbols-outlined text-2xl transition-colors duration-200 ${
                      isActive ? 'text-primary' : 'text-gray-500 group-hover:text-gray-300'
                    }`}
                  >
                    {item.icon}
                  </span>
                  {item.hasIndicator && (
                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background-dark"></span>
                  )}
                </div>
                <span 
                  className={`text-[10px] font-medium transition-colors duration-200 ${
                    isActive ? 'text-primary' : 'text-gray-500 group-hover:text-gray-300'
                  }`}
                >
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full"></div>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default CheckIn;