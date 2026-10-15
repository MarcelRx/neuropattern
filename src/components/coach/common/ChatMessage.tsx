import React from "react";
import ActionButtons, { ActionButton } from "./ActionButtons";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  type: "text" | "voice";
  audioUrl?: string;
  language?: string;
  actions?: ActionButton[];
  isLoading?: boolean;
  // Aura metadata
  energy?: number;
  mood?: string;
  score?: number;
  user_emotion?: string;
}

interface ChatMessageProps {
  message: Message;
  onAction: (action: ActionButton) => void;
  AI_COACH_AVATAR: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onAction,
  AI_COACH_AVATAR,
}) => {
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  const isRTL = (lang?: string) => {
    if (!lang) return false;
    return ["fa", "ar", "he", "ur"].includes(lang.toLowerCase());
  };

  return (
    <div
      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-3 fade-in duration-400`}
    >
      <div
        className={`max-w-[88%] ${message.role === "user" ? "items-end" : "items-start"} flex flex-col`}
      >
        {message.role === "assistant" && (
          <div className="flex items-center gap-2 mb-1.5 ml-1">
            <img
              src={AI_COACH_AVATAR}
              alt="Aura"
              className="h-5 w-5 rounded-full bg-primary/10"
            />
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
              Aura
            </span>
            {message.language && (
              <span className="text-[9px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded-full">
                {message.language.toUpperCase()}
              </span>
            )}
          </div>
        )}

        <div
          className={`
          px-4 py-3.5 rounded-2xl text-sm leading-relaxed
          ${
            message.role === "user"
              ? "bg-gradient-to-br from-primary to-blue-600 shadow-neon-blue text-white rounded-br-none"
              : "bg-white/5 backdrop-blur-xl text-gray-200 border border-white/10 rounded-bl-none shadow-2xl"
          }
        `}
        >
          <div className={`whitespace-pre-wrap prose prose-invert prose-sm max-w-none ${isRTL(message.language) ? "text-right" : "text-left"}`}>
            {message.content.split("**").map((part, i) =>
              i % 2 === 1 ? (
                <strong key={i} className="text-white">
                  {part}
                </strong>
              ) : (
                part
              ),
            )}
          </div>
        </div>

        <span className="text-[10px] text-gray-600 mt-1 px-1">
          {formatTime(message.timestamp)}
        </span>

        {message.actions && (
          <ActionButtons actions={message.actions} onAction={onAction} />
        )}
      </div>
    </div>
  );
};

export default React.memo(ChatMessage);
