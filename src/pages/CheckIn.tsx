import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActionButton } from "../components/coach/common/ActionButtons";
import ChatMessage, { Message } from "../components/coach/common/ChatMessage";
import { AppRoute } from "../constants/routes";
import { useApp } from "../context/AppContext";
import { AuraCoach } from "../core/AuraCoach";
import { LanguageDetector } from "../core/LanguageDetector";
import { ResponseGenerator } from "../core/ResponseGenerator";
import { TTSEngine } from "../core/TTSEngine";
import { VoiceProcessor } from "../core/VoiceProcessor";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useBrowserTTS } from "../hooks/useBrowserTTS";

const AI_COACH_AVATAR =
  "https://api.dicebear.com/7.x/shapes/svg?seed=Aura&backgroundColor=3d99f5";

const VOICE_FEEDBACK_MESSAGES: Record<string, { title: string; message: string; tip: string }> = {
  too_quiet: {
    title: "🔇 I couldn't hear you well",
    message: "Your voice seems too quiet. Please speak a bit louder and closer to the microphone.",
    tip: "Try moving closer to your device and speaking clearly.",
  },
  too_loud: {
    title: "📢 You're a bit too loud",
    message: "Your audio is clipping. Please speak a bit softer for better quality.",
    tip: "Move slightly away from the microphone and speak at a normal volume.",
  },
  too_much_silence: {
    title: "🤫 Too much silence detected",
    message: "I heard mostly silence. Please speak continuously so I can understand you.",
    tip: "Try to speak in complete sentences without long pauses.",
  },
  too_short: {
    title: "⏱️ That was a bit short",
    message: "Your message was too brief for me to analyze properly. Could you tell me more?",
    tip: "Share a bit more detail about how you're feeling today.",
  },
  low_confidence: {
    title: "🤔 I didn't catch that clearly",
    message: "The audio quality made it difficult to understand. Please speak more clearly.",
    tip: "Find a quieter place and speak at a steady pace.",
  },
  possible_gibberish: {
    title: "🌀 That sounded unclear",
    message: "I couldn't make out meaningful words. Please speak clearly into the microphone.",
    tip: "Avoid background noise and speak naturally.",
  },
  clipping_detected: {
    title: "⚡ Audio distortion detected",
    message: "Your voice is distorting. Please speak a bit softer for clearer audio.",
    tip: "Reduce your volume slightly and maintain consistent distance from mic.",
  },
  audio_too_short: {
    title: "📵 Recording too brief",
    message: "The recording seems incomplete. Please hold the microphone button longer.",
    tip: "Hold the record button while you speak, then release when done.",
  },
};

const LOW_LANGUAGE_CLARIFICATION_MESSAGES: Record<string, { title: string; message: string; tip: string }> = {
  en: {
    title: "🤔 I want to make sure I heard you correctly",
    message: "I detected your language, but I'm not confident I got it right. Could you repeat that please in the same language?",
    tip: "Speak at a natural pace and reduce background noise if possible.",
  },
  es: {
    title: "🤔 Quiero asegurarme de entenderte bien",
    message: "Detecté tu idioma, pero no tuve suficiente confianza en la transcripción. ¿Puedes repetir la parte más importante en el mismo idioma?",
    tip: "Habla a un ritmo natural y evita ruido de fondo si puedes.",
  },
  fr: {
    title: "🤔 Je veux m'assurer de bien te comprendre",
    message: "J'ai détecté ta langue, mais je ne suis pas assez sûr de la transcription. Peux-tu répéter la partie la plus importante dans la même langue ?",
    tip: "Parle à un rythme naturel et évite le bruit de fond si possible.",
  },
  de: {
    title: "🤔 Ich möchte sicherstellen, dass ich dich richtig verstehe",
    message: "Ich habe deine Sprache erkannt, bin mir aber bei der Transkription nicht sicher genug. Kannst du den wichtigsten Teil noch einmal in derselben Sprache wiederholen?",
    tip: "Sprich in einem natürlichen Tempo und vermeide Hintergrundgeräusche.",
  },
  it: {
    title: "🤔 Voglio assicurarmi di averti capito bene",
    message: "Ho rilevato la tua lingua, ma non sono abbastanza sicuro della trascrizione. Puoi ripetere la parte più importante nella stessa lingua?",
    tip: "Parla a un ritmo naturale ed evita rumori di fondo se possibile.",
  },
  pt: {
    title: "🤔 Quero ter certeza de que te entendi corretamente",
    message: "Detectei seu idioma, mas não estou confiante o suficiente na transcrição. Você pode repetir a parte mais importante no mesmo idioma?",
    tip: "Fale em um ritmo natural e evite ruído de fundo, se possível.",
  },
  tr: {
    title: "🤔 Seni doğru anladığımdan emin olmak istiyorum",
    message: "Dilinizi tespit ettim, ancak transkripsiyon konusunda yeterince güvenli değilim. En önemli kısmı aynı dilde tekrar edebilir misiniz?",
    tip: "Mümkünse doğal bir hızda konuşun ve arka plan gürültüsünden kaçının.",
  },
  ru: {
    title: "🤔 Я хочу убедиться, что правильно вас понял",
    message: "Я определил ваш язык, но не уверен в точности транскрипции. Можете повторить самую важную часть на том же языке?",
    tip: "Говорите естественно и по возможности избегайте фонового шума.",
  },
  hi: {
    title: "🤔 मैं यह सुनिश्चित करना चाहता हूं कि मैंने आपको सही सुना",
    message: "मैंने आपकी भाषा पहचानी, लेकिन ट्रांसक्रिप्शन में पर्याप्त आत्मविश्वास नहीं है। क्या आप सबसे महत्वपूर्ण हिस्से को उसी भाषा में दोहरा सकते हैं?",
    tip: "कृपया प्राकृतिक गति से बोलें और यदि संभव हो तो पृष्ठभूमि शोर को कम करें।",
  },
  ja: {
    title: "🤔 正しく聞き取れたか確認したいです",
    message: "言語は検出できましたが、文字起こしに十分な自信がありません。重要な部分を同じ言語でもう一度話していただけますか？",
    tip: "自然な速さで話し、可能であれば周囲の雑音を減らしてください。",
  },
  ko: {
    title: "🤔 제가 제대로 이해했는지 확인하고 싶어요",
    message: "언어를 감지했지만 전사에 충분한 확신이 없습니다. 중요한 부분을 동일한 언어로 다시 말씀해 주시겠어요?",
    tip: "자연스러운 속도로 말하고 가능한 한 주변 소음을 줄여보세요.",
  },
  zh: {
    title: "🤔 我想确认我是否听懂了你说的话",
    message: "我检测到了你的语言，但对转录结果并不是很有信心。你可以用相同的语言再重复一次最重要的部分吗？",
    tip: "请以自然的语速说话，并尽量减少背景噪音。",
  },
  ar: {
    title: "🤔 أريد التأكد من أنني فهمتك بشكل صحيح",
    message: "لقد اكتشفت لغتك، لكنني لست واثقًا بما يكفي من عملية النسخ. هل يمكنك تكرار الجزء الأهم بنفس اللغة؟",
    tip: "تحدث بسرعة طبيعية وحاول تقليل الضوضاء في الخلفية.",
  },
  fa: {
    title: "🤔 می‌خواهم مطمئن شوم که درست متوجه شدم",
    message: "زبان شما را تشخیص دادم، اما در ترنسکریپت اعتماد کافی ندارم. آیا می‌توانید مهم‌ترین قسمت را به همان زبان تکرار کنید؟",
    tip: "لطفاً با سرعتی طبیعی صحبت کنید و در صورت امکان نویز پس‌زمینه را کاهش دهید.",
  },
  sv: {
    title: "🤔 Jag vill vara säker på att jag förstod dig rätt",
    message: "Jag upptäckte ditt språk, men jag är inte tillräckligt säker på transkriptionen. Kan du upprepa den viktigaste delen på samma språk?",
    tip: "Prata i ett naturligt tempo och minska bakgrundsljud om möjligt.",
  },
};

const DEFAULT_CLARIFICATION = {
  title: "🤔 I want to make sure I heard you correctly",
  message: "I detected your language, but I'm not confident I got it right. Could you repeat that please?",
  tip: "Speak at a natural pace and reduce background noise if possible.",
};

const InitialGreetingUI = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 animate-in fade-in duration-700">
    <div className="relative">
      <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-2xl animate-pulse" />
      <img
        src={AI_COACH_AVATAR}
        alt="Aura"
        className="relative h-20 w-20 rounded-full ring-2 ring-indigo-500/20 ring-offset-4 ring-offset-[#0a0a0f]"
      />
    </div>
    <div className="text-center space-y-2">
      <h2 className="text-lg font-semibold text-white">Aura is ready</h2>
      <p className="text-sm text-slate-500 max-w-[240px]">
        Your AI Life Coach is here to listen, analyze, and guide you.
      </p>
    </div>
    <div className="flex gap-2">
      <span className="w-2 h-2 bg-slate-600 rounded-full animate-bounce" />
      <span className="w-2 h-2 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
      <span className="w-2 h-2 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
    </div>
  </div>
);

const CheckIn: React.FC = () => {
  const navigate = useNavigate();
  const { logs, habits, userProfile, dailyScore, addLog, refreshData } = useApp();
  const [detectedLanguage, setDetectedLanguage] = useState("en");

  const auraCoachRef = useRef(
    new AuraCoach({
      voiceProcessor: new VoiceProcessor(),
      languageDetector: new LanguageDetector({ defaultLanguage: "en" }),
      coachProvider: new ResponseGenerator(),
      ttsEngine: new TTSEngine({ useBrowserVoice: true }),
    }),
  );

  // Ref to track tone analysis to avoid stale closures in callbacks
  const toneAnalysisRef = useRef<{
    arousal: number;
    valence: number;
    pitchTrend: string;
    speechRate: number;
  } | null>(null);

  const { startRecording, stopRecording } = useAudioRecorder(
    (_blob, report) => {
      const analysis = {
        arousal: report.emotionalTone?.arousal ?? 0.5,
        valence: report.emotionalTone?.valence ?? 0.5,
        pitchTrend: report.pitchTrend ?? "stable",
        speechRate: report.speechRate ?? 4,
      };
      toneAnalysisRef.current = analysis;
      setLastToneAnalysis(analysis);
    },
  );

  const [voiceMode, setVoiceMode] = useState(false);
  const [preferServerVoice, setPreferServerVoice] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("preferServerVoice");
      return stored === null ? true : stored === "true";
    } catch (e) {
      return true;
    }
  });

  const { speak, stop, isSupported } = useBrowserTTS();

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef<any>(null);
  const speechRecognitionSupported =
    typeof window !== "undefined" &&
    (!!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition);

  const getSpeechRecognitionLocale = useCallback((language: string) => {
    const localeMap: Record<string, string> = {
      en: "en-US", sv: "sv-SE", ar: "ar-SA", de: "de-DE", fr: "fr-FR",
      es: "es-ES", it: "it-IT", pt: "pt-BR", ru: "ru-RU", ja: "ja-JP",
      ko: "ko-KR", zh: "zh-CN", hi: "hi-IN", fa: "fa-IR", tr: "tr-TR",
      nl: "nl-NL", he: "he-IL", pl: "pl-PL", uk: "uk-UA", el: "el-GR",
    };
    const normalized = language?.toLowerCase() || "";
    const browserLocale = navigator.language || "en-US";
    if (normalized === "en" && browserLocale && !browserLocale.toLowerCase().startsWith("en")) {
      return browserLocale;
    }
    if (localeMap[normalized]) return localeMap[normalized];
    if (/^[a-z]{2}(-[A-Z]{2})?$/.test(language)) return language;
    return language || browserLocale || "en-US";
  }, []);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [voiceClarityPrompt, setVoiceClarityPrompt] = useState<{
    show: boolean;
    issues: string[];
    suggestedAction?: string;
  }>({ show: false, issues: [] });

  const [lastToneAnalysis, setLastToneAnalysis] = useState<{
    arousal: number;
    valence: number;
    pitchTrend: string;
    speechRate: number;
  } | null>(null);

  const [userEmotion, setUserEmotion] = useState<string>("Neutral");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isInitialized) {
      const greeting = generateInitialGreeting();
      setMessages([greeting]);
      setIsInitialized(true);
    }
  }, [isInitialized, logs, userProfile, dailyScore]);

  useEffect(() => {
    try {
      auraCoachRef.current.setPreferServerVoice(preferServerVoice);
    } catch (e) {
      // ignore if aura coach not ready
    }
  }, [preferServerVoice]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isProcessing, voiceClarityPrompt]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isRTL = useCallback((lang: string) => {
    return ["fa", "ar", "he", "ur"].includes(lang.toLowerCase());
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 128)}px`;
    }
  };

  const generateInitialGreeting = (): Message => {
    const hour = new Date().getHours();
    let timeGreeting = "Good morning";
    if (hour >= 12 && hour < 17) timeGreeting = "Good afternoon";
    else if (hour >= 17) timeGreeting = "Good evening";

    const firstName = userProfile.name?.split(" ")[0] || "there";
    const hasData = logs.length > 0;
    const recentScore = logs[0]?.score || dailyScore;

    const actions: ActionButton[] = [
      { label: "📝 New Check-in", action: "start_checkin", type: "checkin" },
      { label: "📈 Analyze My Patterns", action: "analyze_patterns", type: "analyze" },
      { label: "🎯 Create Weekly Plan", action: "create_plan", type: "plan" },
      { label: "🏠 Go to Dashboard", action: "go_dashboard", type: "navigate", route: AppRoute.HOME },
      { label: "📅 How was my week?", action: "How was my week?", type: "tips" },
      { label: "😴 Sleep tips", action: "Sleep tips", type: "tips" },
      { label: "🧘 Reduce stress", action: "Reduce stress", type: "tips" },
      { label: "📊 View progress", action: "View progress", type: "tips" },
    ];

    let greeting = `${timeGreeting}, ${firstName}! 👋\n\n`;
    if (!hasData) {
      greeting += `I'm **Aura**, your AI Life Coach. I'm so glad you're here! 🌟\n\n`;
      greeting += `How are you feeling right now? Is there anything on your mind you'd like to talk about — maybe something that's been weighing on you, or something you're excited about?\n\n`;
      greeting += `I'm here to listen, support you, and help you make sense of your patterns. What would you like to focus on today?`;
    } else {
      const trend = recentScore >= 70 ? "doing great" : recentScore >= 50 ? "making progress" : "going through a challenging time";
      greeting += `Welcome back! I see you're ${trend} today (wellness score: ${recentScore}). 📊\n\n`;
      greeting += `How have you been feeling since we last spoke? Anything new on your mind — wins, worries, or just random thoughts?\n\n`;
      greeting += `What would you like to focus on today? I'm here to help with whatever you need.`;
    }

    return {
      id: "greeting-" + Date.now(),
      role: "assistant",
      content: greeting,
      timestamp: new Date(),
      type: "text",
      energy: 85,
      mood: "Happy",
      score: recentScore,
      actions,
    };
  };

  const handleClearChat = () => {
    setMessages([]);
    setVoiceClarityPrompt({ show: false, issues: [] });
    setLastToneAnalysis(null);
    setUserEmotion("Neutral");
    auraCoachRef.current.stopAudio();
    setTimeout(() => {
      const greeting = generateInitialGreeting();
      setMessages([greeting]);
    }, 100);
    setShowMenu(false);
  };

  const handleExportChat = () => {
    const chatText = messages
      .map(
        (m) =>
          `${m.role === "assistant" ? "Aura" : "You"} (${new Date(m.timestamp).toLocaleTimeString()}):\n${m.content}`,
      )
      .join("\n\n");

    const blob = new Blob([chatText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aura-chat-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  const handleViewHistory = () => {
    navigate(AppRoute.ANALYSIS);
    setShowMenu(false);
  };

  const sendMessage = async (
    content: string,
    type: "text" | "voice" = "text",
    toneAnalysis?: typeof lastToneAnalysis,
  ) => {
    if (!content.trim()) return;

    // ─── Interrupt any ongoing speech immediately ───
    auraCoachRef.current.stopAudio();
    stop();

  const userMessage: Message & { toneAnalysis?: typeof lastToneAnalysis } = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
      type,
      toneAnalysis: type === "voice" ? toneAnalysis : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    setIsProcessing(true);
    setVoiceClarityPrompt({ show: false, issues: [] });
    setVoiceMode(type === "voice");

    try {
      const quickResponse = handleQuickAction(content);
      if (quickResponse) {
        setTimeout(() => {
          setMessages((prev) => [...prev, quickResponse]);
          setIsProcessing(false);
        }, 800);
        return;
      }

      // Build tone context for backend
      let toneContext = "";
      if (toneAnalysis) {
        toneContext = `Energy variance: ${toneAnalysis.arousal}, Valence: ${toneAnalysis.valence}, Pitch: ${toneAnalysis.pitchTrend}, Speech rate: ${toneAnalysis.speechRate}`;
      }

      // ─── This now automatically plays the voice response when it resolves ───
    const data = await auraCoachRef.current.sendTextMessage(
        content,
        {
          recentLogs: logs.slice(0, 10) as unknown as Record<string, unknown>[],
          habits: habits as unknown as Record<string, unknown>[],
          dailyScore,
          userName: userProfile.name,
          hasCompletedOnboarding,
          preferredLanguage: detectedLanguage,
        },
        true, // Always request voice generation (ElevenLabs or Browser TTS fallback)
      );

      setDetectedLanguage(
        data.language || auraCoachRef.current.getPreferredLanguage(),
      );

      if (data.user_emotion) {
        setUserEmotion(data.user_emotion);
      }

      const validatedActions: ActionButton[] = (data.suggestedActions || []).map((action: any) => ({
        ...action,
        type: ["checkin", "analyze", "plan", "tips", "navigate"].includes(action.type)
          ? action.type
          : "tips",
      }));

    const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        type: "text",
        actions: validatedActions,
        language: data.language,
        energy: data.energy,
        mood: data.mood,
        score: data.score,
        user_emotion: data.user_emotion,
      };

    setMessages((prev) => [...prev, assistantMessage]);

      // ─── Voice Mode: Restart listening AFTER Aura finishes speaking ───
      // (sendTextMessage now waits for audio to complete before resolving)
      if (voiceMode) {
        startSpeechRecognition();
      }

      if (data.checkInData) {
        await saveCheckIn(data.checkInData as any);
      }

      if (!hasCompletedOnboarding) {
        setHasCompletedOnboarding(true);
      }
    } catch (error) {
      console.error("Coach error:", error);

    const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "I'm having trouble connecting right now. Let me try a simpler approach—can you tell me one thing that went well today and one thing you'd like to improve?",
        timestamp: new Date(),
        type: "text",
        energy: 60,
        mood: "Calm",
        actions: [{ label: "🔄 Try Again", action: "retry", type: "tips" }],
      };

      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        stopRecording();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const startSpeechRecognition = useCallback(() => {
    if (isListening || typeof window === "undefined") return;
    startRecording();

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = getSpeechRecognitionLocale(
      detectedLanguage === "en"
        ? navigator.language || "en-US"
        : detectedLanguage || navigator.language || "en-US",
    );

    let finalTranscript = "";
    let interimText = "";

    recognition.onstart = () => {
      setIsListening(true);
      setInterimTranscript("");
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || "";
        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
      interimText = interim || finalTranscript;
      setInterimTranscript(interimText);
    };

    recognition.onerror = () => {
      stopSpeechRecognition();
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
      const analysis = toneAnalysisRef.current;
      let transcript = finalTranscript.trim() || interimText.trim();

      if (transcript) {
        // Capitalize first letter for better UI presentation
        transcript = transcript.charAt(0).toUpperCase() + transcript.slice(1);

        // Interrogative starters for multiple languages
        const questionStarters = [
          "who", "what", "where", "when", "why", "how", "is", "are", "do", "does",
          "can", "could", "should", "will", "would", "am", "was", "were", "did",
          "have", "has", "آیا", "چرا", "چطور", "چگونه", "کجا", "کی", "چند", "چه",
          "هل", "لماذا", "كيف", "متى", "أين", "من", "ما", "var", "vad", "vem",
          "hur", "är", "varför", "när", "qui", "que", "quoi", "comment", "où",
          "quand", "pourquoi", "wer", "was", "wie", "wo", "wann", "warum",
          "chi", "che", "cosa", "come", "dove", "quando", "perché", "quem",
          "o", "que", "como", "onde", "quando", "por", "que", "kim", "ne",
          "nasıl", "nerede", "ne zaman", "neden", "кто", "что", "как", "где",
          "когда", "почему", "कौन", "क्या", "कैसे", "कहाँ", "कब", "क्यों",
          "誰", "何", "どう", "どこ", "いつ", "なぜ", "누구", "무엇", "어떻게",
          "어디", "언제", "왜", "谁", "什么", "怎么", "哪里", "何时", "为什么",
        ];

        const firstWord = transcript.split(/\s+/)[0].toLowerCase();
        const hasPunctuation = /[?.!؟]$/.test(transcript);
        const isQuestionTone = lastToneAnalysis?.pitchTrend === "rising";

        if (!hasPunctuation) {
          if (questionStarters.includes(firstWord) || isQuestionTone) {
            const isRTL = /[\u0600-\u06FF]/.test(transcript);
            transcript += isRTL ? "؟" : "?";
          } else {
            transcript += ".";
          }
        }

        sendMessage(transcript, "voice", analysis || undefined);
      }
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [detectedLanguage, isListening, sendMessage, stopSpeechRecognition]);

  const handleSpeakButtonClick = useCallback(() => {
    if (isListening) {
      stopSpeechRecognition();
      return;
    }
    startSpeechRecognition();
  }, [isListening, startSpeechRecognition, stopSpeechRecognition]);

  const handleQuickAction = (content: string): Message | null => {
    const lower = content.toLowerCase();

    if (lower.includes("go home") || lower.includes("dashboard")) {
      navigate(AppRoute.HOME);
      return {
        id: Date.now().toString(),
        role: "assistant",
        content: "Taking you to your dashboard now! 📊",
        timestamp: new Date(),
        type: "text",
        energy: 90,
        mood: "Excited",
      };
    }

    if (lower.includes("analyze") && logs.length > 0) {
      const avgScore = Math.round(
        logs.reduce((sum, l) => sum + (l.score ?? 0), 0) / logs.length,
      );
      const moodCounts: Record<string, number> = {};
      logs.forEach((l) => {
        moodCounts[l.mood ?? "unknown"] = (moodCounts[l.mood ?? "unknown"] || 0) + 1;
      });
      const topMood =
        Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown";

      return {
        id: Date.now().toString(),
        role: "assistant",
        content: `**Your Pattern Analysis** 📈\n\nBased on your ${logs.length} check-ins:\n\n• **Average Score:** ${avgScore}/100\n• **Most Common Mood:** ${topMood}\n• **Trend:** ${avgScore > 60 ? "Improving 📈" : "Needs attention ⚠️"}\n\n**Key Insight:** Your scores tend to be higher on days when you mention social connections or exercise. Consider prioritizing these!`,
        timestamp: new Date(),
        type: "text",
        energy: 80,
        mood: "Focused",
        actions: [
          { label: "📊 Full Analysis", action: "go_analysis", type: "navigate", route: AppRoute.ANALYSIS },
          { label: "🎯 Create Plan", action: "create_plan", type: "plan" },
        ],
      };
    }

    return null;
  };

  const saveCheckIn = async (checkInData: {
    score: number;
    mood: string;
    summary: string;
    sentiment?: string;
    emotional_indicators?: string[];
    tone_analysis?: string;
  }) => {
    const newLog = {
      id: Date.now().toString(),
      timestamp: new Date(),
      score: checkInData.score,
      mood: checkInData.mood,
      summary: checkInData.summary,
      sentiment: (checkInData.sentiment as any) || "neutral",
    };

    addLog(newLog);

    try {
      await auraCoachRef.current.saveCheckIn(checkInData);
      refreshData();
    } catch (error) {
      console.error("Failed to sync check-in:", error);
    }
  };

  const handleAction = (action: ActionButton) => {
    switch (action.action) {
      case "start_checkin":
        sendMessage("I'd like to do my daily check-in. Ask me about my day.");
        break;
      case "go_dashboard":
      case "go_analysis":
      case "go_insights":
        if (action.route) navigate(action.route);
        break;
      case "analyze_patterns":
        sendMessage("Can you analyze my recent patterns and trends?");
        break;
      case "create_plan":
        sendMessage("I'd like you to create a personalized weekly plan for me based on my data.");
        break;
      case "view_analysis":
        navigate(AppRoute.ANALYSIS);
        break;
      case "retry":
        if (messages.length > 0 && messages[messages.length - 1].role === "user") {
          sendMessage(
            messages[messages.length - 1].content,
            messages[messages.length - 1].type,
          );
        }
        break;
      case "retry_voice":
        startSpeechRecognition();
        break;
      case "switch_to_text":
        inputRef.current?.focus();
        break;
      default:
        sendMessage(action.action);
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col relative overflow-hidden">
      {/* Animated Mesh Gradient Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-20%] w-[70%] h-[60%] bg-indigo-600/40 rounded-full blur-[80px] animate-pulse duration-[10000ms]" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[70%] h-[60%] bg-violet-600/30 rounded-full blur-[80px] animate-pulse duration-[12000ms] delay-2000" />
        <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] bg-cyan-500/20 rounded-full blur-[80px] animate-pulse duration-[15000ms] delay-1000" />
      </div>

      {/* Glass Header */}
      <header className="shrink-0 z-40 bg-[#0a0a0f]/60 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-lg mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500/30 rounded-full blur-lg animate-pulse" />
              <img
                src={AI_COACH_AVATAR}
                alt="Aura"
                className="relative h-9 w-9 rounded-full ring-2 ring-indigo-500/30 ring-offset-2 ring-offset-[#0a0a0f]"
              />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0a0a0f] animate-pulse" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-sm font-semibold text-white tracking-tight">Aura</span>
              <span className="text-[10px] text-emerald-400/80 font-medium flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                Online
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {voiceMode && (
              <button
                onClick={() => setVoiceMode(false)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all animate-in fade-in zoom-in duration-300 group"
                title="Voice Mode Active - Tap to exit"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Voice Mode</span>
                <span className="material-symbols-outlined text-[14px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5">close</span>
              </button>
            )}

            <span className="text-[10px] uppercase tracking-wider text-white/40 bg-white/[0.04] border border-white/[0.06] rounded-full px-2.5 py-1">
              {detectedLanguage === "fa" || detectedLanguage === "ar" ? "RTL" : detectedLanguage.toUpperCase()}
            </span>

            <button
              onClick={() => {
                const next = !preferServerVoice;
                setPreferServerVoice(next);
                try {
                  localStorage.setItem("preferServerVoice", String(next));
                } catch (e) {}
              }}
              title={preferServerVoice ? "Using Server Voice" : "Use Server Voice"}
              className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">
                {preferServerVoice ? "cloud_done" : "cloud"}
              </span>
            </button>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-lg">more_vert</span>
              </button>

              {showMenu && (
                <div className="absolute right-0 top-11 w-52 bg-[#13131f]/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/40 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  {[
                    { icon: "delete_sweep", label: "Clear Conversation", onClick: handleClearChat },
                    { icon: "download", label: "Export Chat", onClick: handleExportChat },
                    { icon: "history", label: "View History", onClick: handleViewHistory },
                    { icon: "settings", label: "Settings", onClick: () => { setShowMenu(false); navigate(AppRoute.PROFILE); } },
                  ].map((item, i) => (
                    <button
                      key={i}
                      onClick={item.onClick}
                      className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-white/[0.04] transition-colors flex items-center gap-3 border-b border-white/[0.04] last:border-0"
                    >
                      <span className="material-symbols-outlined text-slate-500 text-lg">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* User Emotion Indicator */}
      {userEmotion !== "Neutral" && (
        <div className="shrink-0 z-30 bg-[#0a0a0f]/40 backdrop-blur border-b border-white/[0.04]">
          <div className="max-w-lg mx-auto px-4 py-2 flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Detected:</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              ["Happy", "Excited"].includes(userEmotion) ? "bg-emerald-500/10 text-emerald-400" :
              ["Frustrated", "Stressed"].includes(userEmotion) ? "bg-rose-500/10 text-rose-400" :
              ["Confused"].includes(userEmotion) ? "bg-amber-500/10 text-amber-400" :
              ["Sad"].includes(userEmotion) ? "bg-sky-500/10 text-sky-400" :
              "bg-white/5 text-slate-400"
            }`}>
              {userEmotion}
            </span>
            <span className="text-[10px] text-slate-600">Aura is adapting her response style</span>
          </div>
        </div>
      )}

      {/* Listening Overlay */}
      {isListening && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center px-4">
          <div className="relative w-full max-w-xl rounded-[32px] border border-white/10 bg-slate-950/95 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur-2xl">
            <div className="absolute inset-0 rounded-[32px] bg-gradient-to-br from-slate-800/40 via-slate-900/40 to-indigo-950/20 opacity-90" />
            <div className="relative z-10 text-center">
              <div className="text-[11px] tracking-[0.24em] uppercase text-slate-400 mb-3">
                {voiceMode ? "Voice Mode Active" : "Listening"}
              </div>
              <div className="text-white text-base sm:text-lg font-semibold leading-snug">
                {interimTranscript || "Speak now..."}
              </div>
              <div className="mt-3 text-sm text-slate-400">
                Tap the voice button again when you're done.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className={`flex-1 overflow-y-auto z-10 scroll-smooth pb-32 ${isRTL(detectedLanguage) ? "text-right" : "text-left"}`}
        dir={isRTL(detectedLanguage) ? "rtl" : "ltr"}
      >
        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {messages.length === 0 ? (
            <InitialGreetingUI />
          ) : (
            messages.map((msg: any, idx) => (
              <div key={msg.id} className="space-y-2">
                <ChatMessage
                  message={msg}
                  onAction={handleAction}
                  AI_COACH_AVATAR={AI_COACH_AVATAR}
                />
                {/* Aura's Professional Status Bars - Enhanced */}
                {msg.role === "assistant" && (
                  <div className={`flex flex-col gap-1.5 ${isRTL(msg.language || detectedLanguage) ? "items-end" : "items-start"} px-12`}>
                    <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-500">
                      <span>Energy:</span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <span
                            key={i}
                            className={i < (msg.energy ?? 80) / 10 ? "text-indigo-400" : "text-slate-800"}
                          >
                            █
                          </span>
                        ))}
                      </div>
                      <span className="text-slate-400">{msg.energy ?? 80}%</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-500">
                      <span>Mood:</span>
                      <span className="text-emerald-400 uppercase tracking-tighter">{msg.mood ?? "Focused"}</span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <span
                            key={i}
                            className={i < (msg.score ?? 90) / 10 ? "text-emerald-500" : "text-slate-800"}
                          >
                            █
                          </span>
                        ))}
                      </div>
                      <span className="text-slate-400">{msg.score ?? 90}%</span>
                    </div>
                    {msg.user_emotion && (
                      <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-600">
                        <span>User State:</span>
                        <span className={`uppercase tracking-tighter ${
                          ["Happy", "Excited"].includes(msg.user_emotion) ? "text-emerald-400" :
                          ["Frustrated", "Stressed"].includes(msg.user_emotion) ? "text-rose-400" :
                          ["Confused"].includes(msg.user_emotion) ? "text-amber-400" :
                          ["Sad"].includes(msg.user_emotion) ? "text-sky-400" :
                          "text-slate-500"
                        }`}>
                          {msg.user_emotion}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Voice Clarity Prompt */}
          {voiceClarityPrompt.show && (
            <div className="flex justify-start animate-in slide-in-from-bottom-4 fade-in duration-500">
              <div className="max-w-[85%] bg-amber-500/5 border border-amber-500/15 rounded-2xl p-4 rounded-bl-none backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-amber-400 text-sm">info</span>
                  <span className="text-sm font-medium text-amber-400">Voice Quality</span>
                </div>
                <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                  {voiceClarityPrompt.issues.join(", ")}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => startSpeechRecognition()}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors"
                  >
                    🎙️ Retry
                  </button>
                  <button
                    onClick={() => inputRef.current?.focus()}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.04] text-slate-400 text-xs font-medium hover:bg-white/[0.08] transition-colors"
                  >
                    ⌨️ Type
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tone Analysis Chips */}
          {lastToneAnalysis && !isProcessing && (
            <div className="flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div
                className="inline-flex flex-col items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-[24px] px-5 py-3 backdrop-blur-md"
                title={`Aura analyzed your voice speed (${lastToneAnalysis.speechRate} syl/sec) and pitch pattern (${lastToneAnalysis.pitchTrend})`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 uppercase font-medium">Voice Energy</span>
                    <div className="w-12 h-1 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${lastToneAnalysis.arousal > 0.6 ? "bg-rose-400" : lastToneAnalysis.arousal < 0.3 ? "bg-sky-400" : "bg-emerald-400"}`}
                        style={{ width: `${lastToneAnalysis.arousal * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-px h-3 bg-white/[0.08]" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 uppercase font-medium">Vocal Mood</span>
                    <div className="w-12 h-1 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${lastToneAnalysis.valence > 0.6 ? "bg-emerald-400" : lastToneAnalysis.valence < 0.3 ? "bg-rose-400" : "bg-amber-400"}`}
                        style={{ width: `${lastToneAnalysis.valence * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="text-[9px] text-indigo-400/60 font-medium uppercase tracking-[0.1em] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[10px]">neurology</span>
                  Aura is evaluating pitch & speed
                </div>
              </div>
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="flex justify-start animate-in fade-in duration-300">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl rounded-bl-none px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
                  </div>
                  <span className="text-xs text-slate-500 font-medium">Aura is listening to her heart...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Floating Input Dock */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/95 to-transparent pt-6 pb-8 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-end gap-2 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-1.5 focus-within:border-indigo-500/30 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_30px_rgba(99,102,241,0.08)] transition-all duration-300">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={handleTextChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (inputText.trim()) sendMessage(inputText);
                }
              }}
              placeholder="Message Aura..."
              className="flex-1 bg-transparent border-none py-3 pl-4 pr-2 text-sm text-white placeholder-slate-600 focus:outline-none resize-none max-h-32 min-h-[44px] leading-relaxed"
              rows={1}
            />

            <div className="relative flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={handleSpeakButtonClick}
                disabled={isProcessing || !speechRecognitionSupported}
                className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0 select-none touch-none ${
                  isListening
                    ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                    : "bg-white/[0.06] text-slate-400 hover:text-white hover:bg-slate-700/20 border border-transparent active:scale-90"
                }`}
                title={
                  !speechRecognitionSupported
                    ? "Speech recognition is not supported in this browser"
                    : isListening
                      ? "Stop listening"
                      : "Speak with Aura"
                }
              >
                <span className="material-symbols-outlined text-xl transition-transform duration-200">
                  {isListening ? "stop_circle" : "record_voice_over"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckIn;
