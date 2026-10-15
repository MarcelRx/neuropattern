/**
 * Log API service.
 */
import { API_CONFIG } from "../constants/api";
import { LogEntry } from "../types";
import { getAuthHeaders } from "./auth.service";

const buildUrl = (path: string) => `${API_CONFIG.BASE_URL}${path}`;

export const logService = {
  async fetchLogs(): Promise<LogEntry[]> {
    const response = await fetch(buildUrl("/logs"), {
      method: "GET",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch logs");
    }
    return response.json();
  },

  async clearLogs(): Promise<unknown> {
    const response = await fetch(buildUrl("/logs/clear"), {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to clear logs");
    }
    return response.json();
  },
};
