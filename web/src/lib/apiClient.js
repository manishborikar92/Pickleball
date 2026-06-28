/**
 * apiClient.js — Stateless server-side API fetch wrapper.
 *
 * This module NEVER reads or writes cookies and NEVER performs token refresh.
 * It accepts tokens as explicit parameters and returns the response.
 * Token management (reading cookies, refreshing, persisting) is handled
 * by proxy.js (at the network boundary) and Server Actions (for mutations).
 */

import { getApiBaseUrl, COOKIE_NAMES } from "@/config/auth.config";

/**
 * Makes an API request to the backend.
 *
 * @param {string} path - API endpoint path (e.g. "/api/v1/users/me")
 * @param {object} options
 * @param {string} options.method - HTTP method (default: "GET")
 * @param {object} options.body - Request body (will be JSON-stringified)
 * @param {string} options.accessToken - Bearer token for Authorization header
 * @param {string} options.refreshToken - Refresh token sent as Cookie header
 * @returns {{ payload: object, setCookie: string|null }}
 * @throws {Error} with `.status` property on non-2xx responses
 */
export async function apiRequest(path, {
  method = "GET",
  body,
  accessToken = "",
  refreshToken = "",
} = {}) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (refreshToken) {
    headers.Cookie = `${COOKIE_NAMES.REFRESH_TOKEN}=${refreshToken}`;
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  if (response.status === 204) {
    return { payload: null, setCookie: response.headers.get("set-cookie") };
  }

  const payload = await response.json();

  if (!response.ok) {
    const error = new Error(payload?.message || `API request failed with ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return {
    payload,
    setCookie: response.headers.get("set-cookie"),
  };
}
