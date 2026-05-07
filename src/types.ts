export interface Habit {
  id: string;
  name: string;
  icon: string;
  goal: string;
  progress: number; // 0-100 or specific value
  currentValue: string;
  color: 'primary' | 'secondary' | 'accent-purple' | 'accent-orange';
  history: boolean[]; // last 7 days heatmap
}

export interface LogEntry {
  id: string;
  time: string;
  title: string;
  content: string;
  tags: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  type: 'voice' | 'text';
}

export interface UserStats {
  score: number;
  sleep: string;
  steps: string;
  mood: string;
}

export enum AppRoute {
  ONBOARDING = '/',
  AUTH = '/auth',
  FORGOT_PASSWORD = '/forgot-password',
  HOME = '/home',
  ANALYSIS = '/analysis',
  CHECKIN = '/checkin',
  PROFILE = '/profile',
  INSIGHTS = '/insights',
  HABITS = '/habits'
}