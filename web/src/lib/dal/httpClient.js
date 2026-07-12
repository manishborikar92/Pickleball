/**
 * dal/httpClient.js — The single HTTP transport for the Data Access Layer.
 *
 * Server-only. Evolved from the original `lib/apiClient.js`:
 *   1. Typed errors (`ApiError` carries numeric `status` + a string `code`) so
 *      callers branch on codes instead of string-matching messages (ME-1).
 *   2. Per-call cache policy — the blanket `cache: "no-store"` is gone; each DAL
 *      function decides its own `fetch` cache option (ADR-W004 / HI-3).
 *   3. Optional refresh-on-401 (`retryOnUnauthorized`) for authenticated calls
 *      invoked from Server Actions / Route Handlers, closing the mid-checkout
 *      token-expiry gap (HI-9). Cookie persistence is best-effort: it succeeds in
 *      action/route contexts and is silently skipped during RSC render (where
 *      cookies are read-only), while the retry still uses the fresh token.
 *
 * This module never *reads* cookies on its own — tokens are passed explicitly by
 * the DAL (which reads them once). It only *writes* refreshed cookies during a
 * 401 retry, and only when the runtime allows it.
 */

import { cookies } from "next/headers";
import { cache } from "react";

import { COOKIE_NAMES, COOKIE_MAX_AGE } from "@/config/auth.config";
import {
  getApiBaseUrl,
  extractCookieValue,
  resolveRole,
  secureCookieOptions,
} from "@/lib/auth";

/**
 * Typed transport error. `status` is the HTTP status; `code` is a stable machine
 * code the domain layer can branch on without inspecting human-readable text.
 */
export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, code?: string }} [meta]
   */
  constructor(message, { status = 0, code = "api_error" } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** Maps an HTTP status to a stable domain code. */
function codeForStatus(status) {
  switch (status) {
    case 400:
      return "bad_request";
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 422:
      return "unprocessable";
    default:
      return status >= 500 ? "server_error" : "api_error";
  }
}

async function doFetch(path, { method, headers, body, cache: cacheMode }) {
  return fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: cacheMode,
  });
}

function buildHeaders({ accessToken, refreshToken }) {
  const headers = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (refreshToken) headers.Cookie = `${COOKIE_NAMES.REFRESH_TOKEN}=${refreshToken}`;
  return headers;
}

/**
 * Refreshes the session against the backend using a refresh token.
 * Deduped per-request via React `cache()` so parallel 401s in one render share a
 * single refresh call (per-instance single-flight — ME-6).
 *
 * @returns {Promise<{ accessToken: string, refreshToken: string, role: string, adminRole: string, onboarded: boolean } | null>}
 */
const refreshSession = cache(async function refreshSession(refreshToken) {
  if (!refreshToken) return null;
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${COOKIE_NAMES.REFRESH_TOKEN}=${refreshToken}`,
      },
      cache: "no-store",
    });
    if (!response.ok) return null;

    const payload = await response.json();
    const setCookie = response.headers.get("set-cookie");
    const user = payload.data?.user;
    const role = resolveRole(user);

    return {
      accessToken: payload.data.access_token,
      refreshToken: extractCookieValue(setCookie, COOKIE_NAMES.REFRESH_TOKEN) || refreshToken,
      role,
      adminRole: role !== "customer" ? role : "",
      onboarded: Boolean(user?.onboarding_complete),
    };
  } catch {
    return null;
  }
});

/**
 * Best-effort persistence of refreshed tokens to cookies. Works in Server Action
 * / Route Handler contexts; silently no-ops during RSC render (read-only cookies).
 */
async function persistRefreshedTokens(tokens) {
  try {
    const store = await cookies();
    store.set(COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, secureCookieOptions(COOKIE_MAX_AGE.ACCESS_TOKEN));
    store.set(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, secureCookieOptions(COOKIE_MAX_AGE.REFRESH_TOKEN));
    if (tokens.role) {
      store.set(COOKIE_NAMES.AUTH_ROLE, tokens.role, secureCookieOptions(COOKIE_MAX_AGE.SESSION));
    }
    if (tokens.adminRole) {
      store.set(COOKIE_NAMES.ADMIN_ROLE, tokens.adminRole, secureCookieOptions(COOKIE_MAX_AGE.SESSION, { sameSite: "strict" }));
    }
    store.set(COOKIE_NAMES.USER_ONBOARDED, String(tokens.onboarded), secureCookieOptions(COOKIE_MAX_AGE.SESSION));
  } catch {
    // RSC render context — cookies are read-only here. The retry below still
    // uses the fresh token in-memory; the proxy persists on the next request.
  }
}

async function parseResponse(response) {
  if (response.status === 204) {
    return { payload: null, setCookie: response.headers.get("set-cookie") };
  }
  const payload = await response.json();
  if (!response.ok) {
    const status = response.status;
    throw new ApiError(payload?.message || `API request failed with ${status}`, {
      status,
      code: codeForStatus(status),
    });
  }
  return { payload, setCookie: response.headers.get("set-cookie") };
}

/**
 * Performs an API request to the backend.
 *
 * @param {string} path - API endpoint path (e.g. "/api/v1/users/me").
 * @param {object} [options]
 * @param {string} [options.method="GET"]
 * @param {object} [options.body] - JSON-serialized request body.
 * @param {string} [options.accessToken] - Bearer token.
 * @param {string} [options.refreshToken] - Refresh token (sent as Cookie).
 * @param {RequestCache} [options.cache="no-store"] - Per-call fetch cache policy.
 * @param {boolean} [options.retryOnUnauthorized=false] - On 401, refresh + retry once.
 * @returns {Promise<{ payload: object|null, setCookie: string|null }>}
 * @throws {ApiError} on non-2xx (after an optional single refresh-retry).
 */
export async function apiRequest(path, {
  method = "GET",
  body,
  accessToken = "",
  refreshToken = "",
  cache: cacheMode = "no-store",
  retryOnUnauthorized = false,
} = {}) {
  const response = await doFetch(path, {
    method,
    headers: buildHeaders({ accessToken, refreshToken }),
    body,
    cache: cacheMode,
  });

  if (response.status === 401 && retryOnUnauthorized && refreshToken) {
    const refreshed = await refreshSession(refreshToken);
    if (refreshed) {
      await persistRefreshedTokens(refreshed);
      const retry = await doFetch(path, {
        method,
        headers: buildHeaders({
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
        }),
        body,
        cache: cacheMode,
      });
      return parseResponse(retry);
    }
  }

  return parseResponse(response);
}
