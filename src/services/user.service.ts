/**
 * User profile and account management services.
 */
import { API_CONFIG } from "../constants/api";
import { getAuthHeaders } from "./auth.service";

const buildUrl = (path: string) => `${API_CONFIG.BASE_URL}${path}`;

export interface UserProfileUpdate {
  name?: string;
  email?: string;
  avatar?: string;
  fullName?: string;
  full_name?: string;
  avatarUrl?: string;
  avatar_url?: string;
}

export const userService = {
  async updateProfile(data: UserProfileUpdate) {
    const payload: Record<string, string> = {};
    if (data.name) {
      payload.full_name = data.name;
      payload.fullName = data.name;
    }
    if (data.email) payload.email = data.email;
    if (data.avatar) {
      payload.avatar_url = data.avatar;
      payload.avatarUrl = data.avatar;
    }

    const response = await fetch(buildUrl("/auth/update-profile"), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Unable to update profile at this time");
    }

    return response.json();
  },

  async deleteAccount() {
    const response = await fetch(buildUrl("/auth/delete-account"), {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error("Unable to delete account");
    }

    return response.json();
  },

  async updatePassword(currentPassword: string, newPassword: string) {
    const response = await fetch(buildUrl("/auth/update-password"), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Unable to update password");
    }

    return response.json();
  },
};
