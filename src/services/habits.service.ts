/**
 * Habit API service.
 */
import { API_CONFIG } from "../constants/api";
import { Habit } from "../types";
import { getAuthHeaders } from "./auth.service";

const buildUrl = (path: string) => `${API_CONFIG.BASE_URL}${path}`;

export const habitService = {
  async fetchHabits(): Promise<Habit[]> {
    const response = await fetch(buildUrl("/habits"), {
      method: "GET",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to load habits");
    }
    return response.json();
  },

  async toggleHabit(
    id: string,
  ): Promise<{ status: string; history: boolean[] }> {
    const response = await fetch(buildUrl(`/habits/${id}/toggle`), {
      method: "POST",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to update habit status");
    }
    return response.json();
  },
};
