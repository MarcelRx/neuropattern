/**
 * HTTP utilities for the NeuroPattern frontend.
 * Contains request helpers, timeout handling, and JSON response normalization.
 */
import { API_CONFIG } from "../constants/api";

export interface HttpRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

const defaultHeaders = {
  Accept: "application/json",
};

const parseJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error("Invalid JSON response from server");
  }
};

/**
 * Performs a fetch request with timeout handling and JSON parsing.
 */
export const httpRequest = async <T>(
  path: string,
  options: HttpRequestOptions = {},
): Promise<T> => {
  const url = path.startsWith("http") ? path : `${API_CONFIG.BASE_URL}${path}`;
  const controller = new AbortController();
  const timeout = options.timeout ?? API_CONFIG.TIMEOUT;

  const timer = window.setTimeout(() => controller.abort(), timeout);

  try {
    const headers: Record<string, string> = {
      ...defaultHeaders,
      ...(options.headers || {}),
    };

    if (options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }

    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body instanceof FormData
          ? options.body
          : options.body
            ? JSON.stringify(options.body)
            : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      const payload = await parseJson<Record<string, unknown>>(response);
      const message =
        typeof payload.detail === "string"
          ? payload.detail
          : typeof payload.message === "string"
            ? payload.message
            : response.statusText;
      const error = new Error(message || "Request failed");
      (error as any).status = response.status;
      throw error;
    }

    return parseJson<T>(response);
  } finally {
    window.clearTimeout(timer);
  }
};
