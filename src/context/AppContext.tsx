import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Habit, AppRoute } from '../types';

export interface Log {
  id: string;
  timestamp: Date;
  score: number;
  mood: string;
  summary: string;
  sentiment?: string;
  voice_url?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
}

interface AppContextType {
  dailyScore: number;
  logs: Log[];
  habits: Habit[];
  userProfile: UserProfile;
  isLoading: boolean;
  addLog: (log: Log) => void;
  toggleHabitToday: (id: string) => void;
  updateUserProfile: (data: Partial<UserProfile>) => void;
  refreshData: () => Promise<void>;
  resetData: () => Promise<void>;
  deleteAccount: (onSuccess: () => void) => Promise<void>;
  getCoachingInsight: () => Promise<any>;
  saveCoachingPlan: (plan: any) => void;
  activePlan: any | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const API_BASE_URL = 'http://localhost:8000'; // Change this if your backend port is different

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'User',
    email: '',
    avatar: 'https://picsum.photos/100/100'
  });

  // 1. Fetch initial data from Backend on Load
  const refreshData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const headers = { 'Authorization': `Bearer ${token}` };

      // Get Logs
      const logsRes = await fetch(`${API_BASE_URL}/logs`, { headers });
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) })));
      }

      // Get Habits
      const habitsRes = await fetch(`${API_BASE_URL}/habits`, { headers });
      if (habitsRes.ok) {
        const data = await habitsRes.json();
        setHabits(data);
      }

      // Get Profile
      const profileRes = await fetch(`${API_BASE_URL}/auth/me`, { headers });
      if (profileRes.ok) {
        const data = await profileRes.json();
        setUserProfile({ name: data.full_name, email: data.email, avatar: data.avatar_url });
      }
    } catch (err) {
      console.error("Failed to sync with database:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const dailyScore = logs.length > 0 ? logs[0].score : 0;

  // 2. Add Log (Used after successful /checkin/voice call)
  const addLog = (newLog: Log) => {
    setLogs(prev => [newLog, ...prev]);
  };

  // 3. Toggle Habit (In a real app, you should add a PUT endpoint to your backend)
  const toggleHabitToday = async (id: string) => {
    setHabits(prev => prev.map(habit => {
      if (habit.id === id) {
        const newHistory = [...habit.history];
        newHistory[newHistory.length - 1] = !newHistory[newHistory.length - 1];
        return { ...habit, history: newHistory };
      }
      return habit;
    }));
    // TODO: Call fetch(`${API_BASE_URL}/habits/${id}/toggle`, { method: 'POST' })
  };

  const updateUserProfile = (data: Partial<UserProfile>) => {
    setUserProfile(prev => ({ ...prev, ...data }));
  };

  // 4. Reset Data (Clear History in Backend)
  const resetData = async () => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`${API_BASE_URL}/logs/clear`, { 
        method: 'DELETE', 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      setLogs([]);
    } catch (err) {
      console.error("Failed to clear logs:", err);
    }
  };

  // 5. Delete Account (Tell Backend to drop user from DB)
  const deleteAccount = async (onSuccess: () => void) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/auth/delete-account`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        localStorage.clear();
        setLogs([]);
        setHabits([]);
        onSuccess();
      }
    } catch (err) {
      console.error("Account deletion failed:", err);
    }
  };

  return (
    <AppContext.Provider value={{ 
      dailyScore, logs, habits, userProfile, isLoading,
      addLog, toggleHabitToday, updateUserProfile, refreshData, resetData, deleteAccount 
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};