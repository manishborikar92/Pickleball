import { NextResponse } from "next/server";
import { COOKIE_NAMES, COOKIE_MAX_AGE } from "@/config/auth.config";
import {
  secureCookieOptions,
  extractCookieValue,
  getApiBaseUrl,
  isTokenExpired,
  resolveRole,
} from "@/lib/auth";

// ── Cookie helpers (NextResponse context) ──

function setTokenCookies(response, { accessToken, refreshToken, role, staffRole, onboarded }) {
  if (accessToken) {
    response.cookies.set(COOKIE_NAMES.ACCESS_TOKEN, accessToken, secureCookieOptions(COOKIE_MAX_AGE.ACCESS_TOKEN));
  }
  if (refreshToken) {
    response.cookies.set(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, secureCookieOptions(COOKIE_MAX_AGE.REFRESH_TOKEN));
  }
  if (role) {
    response.cookies.set(COOKIE_NAMES.AUTH_ROLE, role, secureCookieOptions(COOKIE_MAX_AGE.SESSION));
  }
  if (staffRole) {
    response.cookies.set(COOKIE_NAMES.STAFF_ROLE, staffRole, secureCookieOptions(COOKIE_MAX_AGE.SESSION));
  }
  if (onboarded !== undefined) {
    response.cookies.set(COOKIE_NAMES.USER_ONBOARDED, String(onboarded), secureCookieOptions(COOKIE_MAX_AGE.SESSION));
  }
}

function clearAllAuthCookies(response) {
  for (const name of Object.values(COOKIE_NAMES)) {
    response.cookies.delete({ name, path: "/" });
  }
}

// ── Token refresh ──

async function refreshTokens(refreshToken) {
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
    const setCookieHeader = response.headers.get("set-cookie");
    const newRefreshToken = extractCookieValue(setCookieHeader, COOKIE_NAMES.REFRESH_TOKEN) || refreshToken;
    const user = payload.data?.user;
    const role = resolveRole(user);
    const staffRole = role !== "customer" ? role : "";

    return {
      accessToken: payload.data.access_token,
      refreshToken: newRefreshToken,
      role,
      staffRole,
      onboarded: Boolean(user?.onboarding_complete),
    };
  } catch (err) {
    console.error("Proxy token refresh failed:", err.message);
    return null;
  }
}

// ── Main proxy function ──

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  let accessToken = request.cookies.get(COOKIE_NAMES.ACCESS_TOKEN)?.value || "";
  let refreshToken = request.cookies.get(COOKIE_NAMES.REFRESH_TOKEN)?.value || "";
  let customerRole = request.cookies.get(COOKIE_NAMES.AUTH_ROLE)?.value || "";
  let staffRole = request.cookies.get(COOKIE_NAMES.STAFF_ROLE)?.value || "";
  let onboarded = request.cookies.get(COOKIE_NAMES.USER_ONBOARDED)?.value === "true";

  let tokensRefreshed = false;
  let newTokens = null;

  // ── Proactive token refresh ──
  // If the access token is expired/missing but a refresh token exists, refresh now.
  // This is the ONLY place token refresh happens during SSR page loads.
  // NextResponse can set cookies on both the browser response AND the
  // forwarded request headers, so Server Components see fresh tokens immediately.

  if (isTokenExpired(accessToken) && refreshToken) {
    newTokens = await refreshTokens(refreshToken);

    if (newTokens) {
      accessToken = newTokens.accessToken;
      refreshToken = newTokens.refreshToken;
      customerRole = newTokens.role === "customer" ? "customer" : customerRole;
      staffRole = newTokens.staffRole || staffRole;
      onboarded = newTokens.onboarded;
      tokensRefreshed = true;
    } else {
      // Refresh failed — tokens are invalid
      accessToken = "";
      refreshToken = "";
      customerRole = "";
      staffRole = "";
      onboarded = false;
    }
  }

  const hasToken = !!(accessToken || refreshToken);
  const hasStaffRole = !!staffRole;
  const hasCustomerRole = customerRole === "customer";

  // ── Helper to create a redirect with refreshed cookies ──

  function redirectWithCookies(url) {
    const response = NextResponse.redirect(url);
    if (tokensRefreshed && newTokens) setTokenCookies(response, newTokens);
    return response;
  }

  // ── Route guards ──

  // Unauthenticated → protected routes
  if (pathname.startsWith("/dashboard") && !hasToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (pathname.startsWith("/admin") && (!hasToken || !hasStaffRole)) {
    const staffLoginUrl = new URL("/staff-login", request.url);
    staffLoginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(staffLoginUrl);
  }

  // Unboarded customers → onboarding
  if (pathname.startsWith("/dashboard") && hasToken && hasCustomerRole && !onboarded) {
    const onboardingUrl = new URL("/onboarding", request.url);
    onboardingUrl.searchParams.set("next", pathname);
    return redirectWithCookies(onboardingUrl);
  }

  // Authenticated → away from login pages
  if (pathname === "/login" && hasToken && onboarded) {
    return redirectWithCookies(new URL("/dashboard/overview", request.url));
  }
  if (pathname === "/login" && hasToken && !onboarded) {
    const onboardingUrl = new URL("/onboarding", request.url);
    const nextParam = request.nextUrl.searchParams.get("next");
    if (nextParam) onboardingUrl.searchParams.set("next", nextParam);
    return redirectWithCookies(onboardingUrl);
  }
  if (pathname === "/onboarding" && hasToken && onboarded) {
    return redirectWithCookies(new URL("/dashboard/overview", request.url));
  }
  if (pathname === "/onboarding" && !hasToken) {
    const loginUrl = new URL("/login", request.url);
    const nextParam = request.nextUrl.searchParams.get("next");
    if (nextParam) loginUrl.searchParams.set("next", nextParam);
    return NextResponse.redirect(loginUrl);
  }
  if (pathname === "/staff-login" && hasToken && hasStaffRole) {
    const nextParam = request.nextUrl.searchParams.get("next") || "/admin/overview";
    const safeNext = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/admin/overview";
    return redirectWithCookies(new URL(safeNext, request.url));
  }

  // ── Pass through with updated cookies ──

  if (tokensRefreshed && newTokens) {
    // Forward the refreshed cookies to the Server Component render context.
    // NextResponse.next({ request: { headers } }) merges headers into
    // the forwarded request, so cookies() in Server Components see fresh tokens.
    const requestHeaders = new Headers(request.headers);
    const cookieParts = [
      `${COOKIE_NAMES.ACCESS_TOKEN}=${newTokens.accessToken}`,
      `${COOKIE_NAMES.REFRESH_TOKEN}=${newTokens.refreshToken}`,
      newTokens.role ? `${COOKIE_NAMES.AUTH_ROLE}=${newTokens.role}` : "",
      newTokens.staffRole ? `${COOKIE_NAMES.STAFF_ROLE}=${newTokens.staffRole}` : "",
      `${COOKIE_NAMES.USER_ONBOARDED}=${newTokens.onboarded}`,
    ].filter(Boolean).join("; ");
    requestHeaders.set("cookie", cookieParts);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    setTokenCookies(response, newTokens);
    return response;
  }

  // Refresh failed — clear stale cookies from browser
  if (!hasToken && (request.cookies.has(COOKIE_NAMES.ACCESS_TOKEN) || request.cookies.has(COOKIE_NAMES.REFRESH_TOKEN))) {
    const response = NextResponse.next();
    clearAllAuthCookies(response);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/onboarding", "/staff-login", "/dashboard/:path*", "/admin/:path*"],
};
