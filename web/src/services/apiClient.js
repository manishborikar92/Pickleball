import { cookies } from "next/headers";

const DEFAULT_API_BASE_URL = "http://localhost:5000";

const activeRefreshes = new Map();

export function getApiBaseUrl() {
  return process.env.API_BASE_URL
    || process.env.NEXT_PUBLIC_API_BASE_URL
    || DEFAULT_API_BASE_URL;
}

function extractCookieValue(setCookie, name) {
  if (!setCookie) return "";
  const match = setCookie.match(new RegExp(`${name}=([^;]*)`));
  return match?.[1] || "";
}

export async function apiRequest(path, {
  method = "GET",
  body,
  accessToken,
  refreshToken,
} = {}, _isRetry = false) {
  const headers = {
    "Content-Type": "application/json",
  };

  let token = accessToken;
  // If accessToken is not provided, try to read from cookies
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get("pb_access_token")?.value || "";
    } catch {
      // Ignore if called in a context where cookies() is not available
    }
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Use provided refreshToken or read from cookies
  let rToken = refreshToken;
  if (!rToken) {
    try {
      const cookieStore = await cookies();
      rToken = cookieStore.get("pb_refresh_token")?.value || "";
    } catch {}
  }

  if (rToken) {
    headers.Cookie = `pb_refresh_token=${rToken}`;
  }

  let response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  // Handle 401 or missing token, and try to refresh
  if ((response.status === 401 || !token) && !_isRetry && rToken) {
    try {
      let refreshPromise = activeRefreshes.get(rToken);
      if (!refreshPromise) {
        refreshPromise = (async () => {
          const refreshResponse = await fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Cookie": `pb_refresh_token=${rToken}`,
            },
            cache: "no-store",
          });

          if (!refreshResponse.ok) {
            throw new Error(`Refresh failed with status ${refreshResponse.status}`);
          }

          const refreshPayload = await refreshResponse.json();
          const newAccessToken = refreshPayload.data.access_token;
          const setCookieHeader = refreshResponse.headers.get("set-cookie");
          const newRefreshToken = extractCookieValue(setCookieHeader, "pb_refresh_token") || rToken;

          return { newAccessToken, newRefreshToken };
        })();

        activeRefreshes.set(rToken, refreshPromise);
      }

      try {
        const { newAccessToken, newRefreshToken } = await refreshPromise;

        // Save new tokens to cookies
        try {
          const cookieStore = await cookies();
          const secure = process.env.NODE_ENV === "production";
          cookieStore.set("pb_access_token", newAccessToken, {
            httpOnly: true,
            secure,
            sameSite: "lax",
            path: "/",
            maxAge: 15 * 60,
          });
          cookieStore.set("pb_refresh_token", newRefreshToken, {
            httpOnly: true,
            secure,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 30,
          });
        } catch (err) {
          // If we are rendering and cannot set cookies, we still proceed with the newAccessToken
          console.warn("Could not write refreshed cookies in current context:", err.message);
        }

        // Retry the original request with the new access token
        const retryHeaders = {
          ...headers,
          Authorization: `Bearer ${newAccessToken}`,
        };
        if (newRefreshToken) {
          retryHeaders.Cookie = `pb_refresh_token=${newRefreshToken}`;
        }

        response = await fetch(`${getApiBaseUrl()}${path}`, {
          method,
          headers: retryHeaders,
          body: body === undefined ? undefined : JSON.stringify(body),
          cache: "no-store",
        });
      } finally {
        activeRefreshes.delete(rToken);
      }
    } catch (refreshErr) {
      console.error("Failed to automatically refresh token:", refreshErr);
      try {
        const cookieStore = await cookies();
        cookieStore.delete({ name: "pb_access_token", path: "/" });
        cookieStore.delete({ name: "pb_refresh_token", path: "/" });
        cookieStore.delete({ name: "pb_auth_role", path: "/" });
        cookieStore.delete({ name: "pb_staff_role", path: "/" });
        cookieStore.delete({ name: "pb_user_onboarded", path: "/" });
      } catch (cookieErr) {
        console.warn("Failed to clear session cookies on refresh failure:", cookieErr.message);
      }
    }
  }

  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || `API request failed with ${response.status}`);
  }

  return {
    payload,
    setCookie: response.headers.get("set-cookie"),
  };
}
