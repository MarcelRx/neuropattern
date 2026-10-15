export interface SuggestedAction {
  label: string;
  action: string;
  type: string;
  route?: string;
}

export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  type: "text" | "voice";
  actions?: SuggestedAction[];
  language?: string;
}

export interface CoachResponse {
  response: string;
  suggestedActions: SuggestedAction[];
  checkInData?: Record<string, unknown>;
  audioUrl?: string;
  language?: string;
  energy?: number;
  mood?: string;
  score?: number;
  user_emotion?: string;
}

export interface ChatContext {
  recentLogs?: Record<string, unknown>[];
  habits?: Record<string, unknown>[];
  dailyScore?: number;
  userName?: string;
  hasCompletedOnboarding?: boolean;
  preferredLanguage?: string;
  voiceSummary?: string;
}
