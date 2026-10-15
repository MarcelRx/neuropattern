/**
 * Centralized API configuration used across the app.
 * Handles environment-safe defaults and endpoint configuration.
 */
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1",
  TOKEN_KEY: "neuropattern_auth_token",
  TOKEN_EXPIRY_KEY: "neuropattern_token_expiry",
  TIMEOUT: 15000,
} as const;
