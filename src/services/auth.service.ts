/**
 * Authentication service for storing tokens and calling auth endpoints.
 */
import { API_CONFIG } from "../constants/api";
import { httpRequest } from "./http.service";

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  full_name?: string;
  fullName?: string;
}

export interface ResetPasswordPayload {
  token: string | null;
  new_password: string;
  email: string;
}

export interface VerifyResetTokenResponse {
  valid: boolean;
  email: string;
}

export const getAuthToken = (): string | null => {
  const token = localStorage.getItem(API_CONFIG.TOKEN_KEY);
  if (!token || token === "undefined" || token === "null") return null;
  const expiry = localStorage.getItem(API_CONFIG.TOKEN_EXPIRY_KEY);
  if (expiry && Date.now() > Number(expiry)) {
    clearAuthToken();
    return null;
  }
  return token;
};

export const setAuthToken = (token: string, expiresInMinutes = 60): void => {
  if (!token) return;
  localStorage.setItem(API_CONFIG.TOKEN_KEY, token);
  localStorage.setItem(
    API_CONFIG.TOKEN_EXPIRY_KEY,
    String(Date.now() + expiresInMinutes * 60 * 1000),
  );
};

export const clearAuthToken = (): void => {
  localStorage.removeItem(API_CONFIG.TOKEN_KEY);
  localStorage.removeItem(API_CONFIG.TOKEN_EXPIRY_KEY);
};

export const isAuthenticated = (): boolean => {
  return getAuthToken() !== null;
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  return token
    ? {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      }
    : {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
};

export const getMultipartAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const login = async (payload: LoginPayload): Promise<TokenResponse> => {
  return httpRequest<TokenResponse>("/auth/login", {
    method: "POST",
    body: payload,
  });
};

export const register = async (
  payload: RegisterPayload,
): Promise<{ message: string }> => {
  return httpRequest<{ message: string }>("/auth/register", {
    method: "POST",
    body: payload,
  });
};

export const forgotPassword = async (payload: {
  email: string;
}): Promise<unknown> => {
  return httpRequest("/auth/forgot-password", {
    method: "POST",
    body: payload,
  });
};

export const resetPassword = async (
  payload: ResetPasswordPayload,
): Promise<unknown> => {
  return httpRequest("/auth/reset-password", {
    method: "POST",
    body: payload,
  });
};

export const verifyResetToken = async (
  token: string,
): Promise<VerifyResetTokenResponse> => {
  return httpRequest<VerifyResetTokenResponse>("/auth/verify-reset-token", {
    method: "POST",
    body: { token },
  });
};

export interface UserProfileResponse {
  full_name?: string;
  fullName?: string;
  email: string;
  avatar_url?: string;
  avatarUrl?: string;
}

export const fetchMyProfile = async (): Promise<UserProfileResponse> => {
  return httpRequest<UserProfileResponse>("/auth/me", {
    method: "GET",
    headers: getAuthHeaders(),
  });
};
