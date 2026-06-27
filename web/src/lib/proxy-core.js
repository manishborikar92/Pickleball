import { NextResponse } from "next/server";
import { canAccessRoute } from "@/lib/rbac";
import { COOKIES } from "@/constants/cookies";

export const SESSION_COOKIE_NAME = COOKIES.AUTH_ROLE;
export const STAFF_SESSION_COOKIE_NAME = COOKIES.STAFF_ROLE;
const ACCESS_COOKIE_NAME = COOKIES.ACCESS_TOKEN;
const REFRESH_COOKIE_NAME = COOKIES.REFRESH_TOKEN;
const AUTH_ROLE_COOKIE_NAME = COOKIES.AUTH_ROLE;
const AUTH_ONBOARDED_COOKIE_NAME = COOKIES.USER_ONBOARDED;

const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

function extractCookieValue(setCookie, name) {
  if (!setCookie) return "";
  const match = setCookie.match(new RegExp(`${name}=([^;]*)`));
  return match?.[1] || "";
}

async function refreshTokens(refreshToken) {
  try {
    const response = await fetch(`${NEXT_PUBLIC_API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `${REFRESH_COOKIE_NAME}=${refreshToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const setCookieHeader = response.headers.get("set-cookie");
    const newRefreshToken = extractCookieValue(setCookieHeader, REFRESH_COOKIE_NAME) || refreshToken;

    return {
      accessToken: payload.data.access_token,
      refreshToken: newRefreshToken,
      user: payload.data.user,
    };
  } catch (err) {
    console.error("Middleware refresh failed:", err);
    return null;
  }
}

export async function handleRouteAccess(request) {
  const { pathname } = request.nextUrl;

  let accessToken = request.cookies.get(ACCESS_COOKIE_NAME)?.value || "";
  let refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value || "";
  let customerRole = request.cookies.get(AUTH_ROLE_COOKIE_NAME)?.value || "";
  let staffRole = request.cookies.get(STAFF_SESSION_COOKIE_NAME)?.value || "";
  let userOnboarded = request.cookies.get(AUTH_ONBOARDED_COOKIE_NAME)?.value || "";

  let sessionRefreshed = false;
  let newTokens = null;

  // If access token is missing but refresh token exists, perform silent refresh in middleware
  if (!accessToken && refreshToken) {
    newTokens = await refreshTokens(refreshToken);
    if (newTokens) {
      accessToken = newTokens.accessToken;
      refreshToken = newTokens.refreshToken;
      sessionRefreshed = true;

      // Extract new user info and roles
      const user = newTokens.user;
      const rolesList = Array.isArray(user?.roles) ? user.roles : [];

      if (rolesList.includes("customer")) {
        customerRole = "customer";
      }
      const resolvedStaffRole = rolesList.find((role) => role !== "customer") || rolesList[0] || "";
      if (resolvedStaffRole && resolvedStaffRole !== "customer") {
        staffRole = resolvedStaffRole;
      }
      userOnboarded = String(Boolean(user?.onboarding_complete));
    } else {
      // Clear values if refresh failed
      accessToken = "";
      refreshToken = "";
      customerRole = "";
      staffRole = "";
      userOnboarded = "";
    }
  }

  const isCustomerAuthenticated = (!!accessToken || !!refreshToken) && customerRole === "customer";
  const isCustomerFullyOnboarded = isCustomerAuthenticated && userOnboarded === "true";
  const isStaffAuthenticated = (!!accessToken || !!refreshToken) && !!staffRole && staffRole !== "customer";

  function withCookies(res) {
    const secure = process.env.NODE_ENV === "production";

    if (sessionRefreshed && newTokens) {
      res.cookies.set(ACCESS_COOKIE_NAME, newTokens.accessToken, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: 15 * 60,
      });
      res.cookies.set(REFRESH_COOKIE_NAME, newTokens.refreshToken, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      res.cookies.set(AUTH_ROLE_COOKIE_NAME, customerRole || staffRole, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      if (staffRole) {
        res.cookies.set(STAFF_SESSION_COOKIE_NAME, staffRole, {
          httpOnly: true,
          secure,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });
      }
      res.cookies.set(AUTH_ONBOARDED_COOKIE_NAME, userOnboarded, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    } else if (!accessToken && !refreshToken) {
      res.cookies.delete({ name: ACCESS_COOKIE_NAME, path: "/" });
      res.cookies.delete({ name: REFRESH_COOKIE_NAME, path: "/" });
      res.cookies.delete({ name: AUTH_ROLE_COOKIE_NAME, path: "/" });
      res.cookies.delete({ name: STAFF_SESSION_COOKIE_NAME, path: "/" });
      res.cookies.delete({ name: AUTH_ONBOARDED_COOKIE_NAME, path: "/" });
    }

    return res;
  }

  // Construct updated request headers if refresh succeeded
  let nextResponseInit = undefined;
  if (sessionRefreshed && newTokens) {
    const cookieHeader = [
      `${ACCESS_COOKIE_NAME}=${accessToken}`,
      `${REFRESH_COOKIE_NAME}=${refreshToken}`,
      customerRole ? `${AUTH_ROLE_COOKIE_NAME}=${customerRole}` : "",
      staffRole ? `${STAFF_SESSION_COOKIE_NAME}=${staffRole}` : "",
      `${AUTH_ONBOARDED_COOKIE_NAME}=${userOnboarded}`
    ].filter(Boolean).join("; ");

    const headers = new Headers(request.headers);
    headers.set("cookie", cookieHeader);
    nextResponseInit = {
      request: {
        headers,
      },
    };
  }

  // Helper for NextResponse.next with updated headers
  function getNextResponse() {
    return NextResponse.next(nextResponseInit);
  }

  // 1. Customer Login Page Guard
  if (pathname === "/login") {
    if (isCustomerAuthenticated) {
      if (isCustomerFullyOnboarded) {
        return withCookies(NextResponse.redirect(new URL("/dashboard/overview", request.url)));
      } else {
        const onboardingUrl = new URL("/onboarding", request.url);
        const nextParam = request.nextUrl.searchParams.get("next");
        if (nextParam) onboardingUrl.searchParams.set("next", nextParam);
        return withCookies(NextResponse.redirect(onboardingUrl));
      }
    }
    return withCookies(getNextResponse());
  }

  // 2. Customer Onboarding Page Guard
  if (pathname === "/onboarding") {
    if (isCustomerFullyOnboarded) {
      return withCookies(NextResponse.redirect(new URL("/dashboard/overview", request.url)));
    }
    if (isCustomerAuthenticated && !isCustomerFullyOnboarded) {
      return withCookies(getNextResponse());
    }
    const loginUrl = new URL("/login", request.url);
    const nextParam = request.nextUrl.searchParams.get("next");
    if (nextParam) loginUrl.searchParams.set("next", nextParam);
    return withCookies(NextResponse.redirect(loginUrl));
  }

  // 3. Staff Login Page Guard
  if (pathname === "/staff-login") {
    if (isStaffAuthenticated) {
      const nextParam = request.nextUrl.searchParams.get("next") || "/admin/overview";
      const safeNext = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/admin/overview";
      return withCookies(NextResponse.redirect(new URL(safeNext, request.url)));
    }
    return withCookies(getNextResponse());
  }

  // 4. Protected Customer Dashboard Route Guard
  if (pathname.startsWith("/dashboard")) {
    if (!isCustomerAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return withCookies(NextResponse.redirect(loginUrl));
    }

    if (!isCustomerFullyOnboarded) {
      const onboardingUrl = new URL("/onboarding", request.url);
      onboardingUrl.searchParams.set("next", pathname);
      return withCookies(NextResponse.redirect(onboardingUrl));
    }

    if (!canAccessRoute(pathname, customerRole)) {
      return withCookies(NextResponse.redirect(new URL("/dashboard/overview", request.url)));
    }
  }

  // 5. Protected Staff Admin Route Guard
  if (pathname.startsWith("/admin")) {
    if (!isStaffAuthenticated) {
      const staffLoginUrl = new URL("/staff-login", request.url);
      staffLoginUrl.searchParams.set("next", pathname);
      return withCookies(NextResponse.redirect(staffLoginUrl));
    }

    if (!canAccessRoute(pathname, staffRole)) {
      return withCookies(NextResponse.redirect(new URL("/admin/overview", request.url)));
    }
  }

  return withCookies(getNextResponse());
}
