/**
 * auth.config.js — Single source of truth for auth-related constants and
 * pure utility functions. NO framework imports (no next/headers, no next/server).
 *
 * Safe to import from ANY context: proxy.js, Server Components, Server Actions,
 * Route Handlers, lib modules, and tests.
 */

// ── Cookie name constants ──

export const COOKIE_NAMES = {
  ACCESS_TOKEN: "pb_access_token",
  REFRESH_TOKEN: "pb_refresh_token",
  AUTH_ROLE: "pb_auth_role",
  STAFF_ROLE: "pb_staff_role",
  USER_ONBOARDED: "pb_user_onboarded",
};

// ── Cookie option defaults ──

export const COOKIE_MAX_AGE = {
  ACCESS_TOKEN: 15 * 60,               // 15 minutes
  REFRESH_TOKEN: 60 * 60 * 24 * 30,    // 30 days
  SESSION: 60 * 60 * 24 * 30,          // 30 days (role, onboarded flags)
};

export function secureCookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

// ── API base URL ──

export function getApiBaseUrl() {
  return process.env.API_BASE_URL
    || process.env.NEXT_PUBLIC_API_BASE_URL
    || "http://localhost:5000";
}

// ── Token refresh buffer (seconds before exp to trigger proactive refresh) ──

export const REFRESH_BUFFER_SECONDS = 30;

// ── Pure utility functions ──

/**
 * Extracts a named value from a Set-Cookie response header string.
 */
export function extractCookieValue(setCookieHeader, name) {
  if (!setCookieHeader) return "";
  const match = setCookieHeader.match(new RegExp(`${name}=([^;]*)`));
  return match?.[1] || "";
}

/**
 * Decodes a JWT payload without signature verification.
 * Used only for reading the `exp` claim — the backend validates the signature.
 */
export function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

/**
 * Checks whether a JWT access token is expired (or will expire within the buffer window).
 */
export function isTokenExpired(token) {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 < Date.now() + REFRESH_BUFFER_SECONDS * 1000;
}

/**
 * Resolves the effective role from a user's roles array.
 * Prefers the first non-customer role (staff/manager/admin), falls back to customer.
 */
export function resolveRole(user, fallback = "customer") {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return roles.find((role) => role !== "customer") || roles[0] || fallback;
}
