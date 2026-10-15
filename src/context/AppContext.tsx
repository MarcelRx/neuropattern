import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  clearAuthToken,
  fetchMyProfile,
  isAuthenticated,
} from "../services/auth.service";
import { habitService } from "../services/habits.service";
import { logService } from "../services/logs.service";
import { userService } from "../services/user.service";
import { Habit, LogEntry as Log } from "../types";

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
  hasSeenOnboarding: boolean;
  isAuthenticated: boolean;
  addLog: (log: Log) => void;
  toggleHabitToday: (id: string) => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshData: () => Promise<void>;
  resetData: () => Promise<void>;
  deleteAccount: (onSuccess: () => void) => Promise<void>;
  getCoachingInsight: () => Promise<any>;
  saveCoachingPlan: (plan: any) => void;
  activePlan: any | null;
  finishOnboarding: () => void;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticatedState, setIsAuthenticatedState] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: "User",
    email: "",
    avatar: "https://picsum.photos/100/100",
  });
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("hasSeenOnboarding") === "true";
  });

  const finishOnboarding = () => {
    localStorage.setItem("hasSeenOnboarding", "true");
    setHasSeenOnboarding(true);
  };

  const refreshData = useCallback(async () => {
    if (!isAuthenticated()) {
      setIsAuthenticatedState(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const [logsResponse, habitsResponse, profileResponse] = await Promise.all(
        [logService.fetchLogs(), habitService.fetchHabits(), fetchMyProfile()],
      );

      setLogs(
        logsResponse.map((log) => ({
          ...log,
          timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
        })),
      );
      setHabits(habitsResponse);

      const profile = profileResponse as any;
      setUserProfile({
        name: profile.full_name || profile.fullName || "User",
        email: profile.email || "",
        avatar:
          profile.avatar_url ||
          profile.avatarUrl ||
          "https://picsum.photos/100/100",
      });
      setIsAuthenticatedState(true);
    } catch (error) {
      clearAuthToken();
      setIsAuthenticatedState(false);
      setLogs([]);
      setHabits([]);
      setUserProfile({
        name: "User",
        email: "",
        avatar: "https://picsum.photos/100/100",
      });
      console.error("[AppContext] refreshData failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const dailyScore = logs.length > 0 ? (logs[0].score ?? 0) : 0;

  const addLog = (newLog: Log) => {
    setLogs((prev) => [newLog, ...prev]);
  };

  const toggleHabitToday = async (id: string) => {
    try {
      await habitService.toggleHabit(id);
      setHabits((prev) =>
        prev.map((habit) => {
          if (habit.id !== id) return habit;
          const history = [...habit.history];
          history[history.length - 1] = !history[history.length - 1];
          return { ...habit, history };
        }),
      );
    } catch (error) {
      console.error("[AppContext] toggleHabitToday failed:", error);
    }
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    setUserProfile((previous) => ({ ...previous, ...data }));

    try {
      await userService.updateProfile(data);
      await refreshData();
    } catch (error) {
      console.error("[AppContext] updateUserProfile failed:", error);
    }
  };

  const resetData = async () => {
    try {
      await logService.clearLogs();
      setLogs([]);
    } catch (error) {
      console.error("[AppContext] resetData failed:", error);
    }
  };

  const deleteAccount = async (onSuccess: () => void) => {
    try {
      await userService.deleteAccount();
      clearAuthToken();
      setLogs([]);
      setHabits([]);
      setIsAuthenticatedState(false);
      onSuccess();
    } catch (error) {
      console.error("[AppContext] deleteAccount failed:", error);
    }
  };

  const logout = () => {
    clearAuthToken();
    setLogs([]);
    setHabits([]);
    setUserProfile({
      name: "User",
      email: "",
      avatar: "https://picsum.photos/100/100",
    });
    setIsAuthenticatedState(false);
  };

  const getCoachingInsight = async () => ({});
  const saveCoachingPlan = (_plan: any) => {};
  const activePlan = null;

  return (
    <AppContext.Provider
      value={{
        dailyScore,
        logs,
        habits,
        userProfile,
        isLoading,
        hasSeenOnboarding,
        isAuthenticated: isAuthenticatedState,
        finishOnboarding,
        addLog,
        toggleHabitToday,
        updateUserProfile,
        refreshData,
        resetData,
        deleteAccount,
        getCoachingInsight,
        saveCoachingPlan,
        activePlan,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
