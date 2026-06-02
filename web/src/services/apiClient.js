const DEFAULT_API_BASE_URL = "http://localhost:5000";

export function getApiBaseUrl() {
  return process.env.API_BASE_URL
    || process.env.NEXT_PUBLIC_API_BASE_URL
    || DEFAULT_API_BASE_URL;
}

export async function apiRequest(path, {
  method = "GET",
  body,
  accessToken,
  refreshToken,
} = {}) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (refreshToken) {
    headers.Cookie = `pb_refresh_token=${refreshToken}`;
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || `API request failed with ${response.status}`);
  }

  return {
    payload,
    setCookie: response.headers.get("set-cookie"),
  };
}
