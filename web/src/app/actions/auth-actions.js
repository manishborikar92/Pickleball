"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { apiRequest } from "@/services/apiClient";

const ACCESS_COOKIE = "pb_access_token";
const REFRESH_COOKIE = "pb_refresh_token";
const AUTH_ROLE_COOKIE = "pb_auth_role";
const STAFF_ROLE_COOKIE = "pb_staff_role";
const AUTH_ONBOARDED_COOKIE = "pb_user_onboarded";

function extractCookieValue(setCookie, name) {
  if (!setCookie) return "";
  const match = setCookie.match(new RegExp(`${name}=([^;]*)`));
  return match?.[1] || "";
}

function resolveRole(user, fallback = "customer") {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return roles.find((role) => role !== "customer") || roles[0] || fallback;
}

async function setSessionCookies({ accessToken, refreshToken, user, role = "customer" }) {
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";

  if (accessToken) {
    cookieStore.set(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60,
    });
  }

  if (refreshToken) {
    cookieStore.set(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/api",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  if (user) {
    cookieStore.set(AUTH_ROLE_COOKIE, role, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    if (role !== "customer") {
      cookieStore.set(STAFF_ROLE_COOKIE, role, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    cookieStore.set(AUTH_ONBOARDED_COOKIE, String(Boolean(user.onboarding_complete)), {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

async function clearSessionCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
  cookieStore.delete(AUTH_ROLE_COOKIE);
  cookieStore.delete(STAFF_ROLE_COOKIE);
  cookieStore.delete(AUTH_ONBOARDED_COOKIE);
}

export async function getSessionAction(preferredType = null) {
  return await getSession(preferredType);
}

export async function sendCustomerOtpAction(phone) {
  const { payload } = await apiRequest("/api/v1/auth/otp/send", {
    method: "POST",
    body: { phone },
  });
  return payload.data;
}

export async function verifyCustomerOtpAction(phone, otp) {
  const { payload, setCookie } = await apiRequest("/api/v1/auth/otp/verify", {
    method: "POST",
    body: { phone, otp },
  });

  await setSessionCookies({
    accessToken: payload.data.access_token,
    refreshToken: extractCookieValue(setCookie, REFRESH_COOKIE),
    user: payload.data.user,
  });

  return payload.data;
}

export async function completeOnboardingAction(name) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value || "";
  const { payload } = await apiRequest("/api/v1/auth/onboarding", {
    method: "POST",
    body: { name },
    accessToken,
  });

  await setSessionCookies({
    accessToken,
    user: payload.data.user,
  });

  return payload.data;
}

export async function signOutCustomerAction() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value || "";

  if (refreshToken) {
    await apiRequest("/api/v1/auth/logout", {
      method: "POST",
      refreshToken,
    }).catch(() => null);
  }

  await clearSessionCookies();
  redirect("/");
}

export async function signOutStaffAction() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value || "";

  if (refreshToken) {
    await apiRequest("/api/v1/auth/logout", {
      method: "POST",
      refreshToken,
    }).catch(() => null);
  }

  await clearSessionCookies();
  redirect("/staff-login");
}

export async function signInStaffAction(formData) {
  const email = String(formData?.get("email") || "");
  const password = String(formData?.get("password") || "");
  const next = String(formData?.get("next") || "/admin");

  const { payload, setCookie } = await apiRequest("/api/v1/auth/staff/login", {
    method: "POST",
    body: { email, password },
  });

  const role = resolveRole(payload.data.user, "staff");
  await setSessionCookies({
    accessToken: payload.data.access_token,
    refreshToken: extractCookieValue(setCookie, REFRESH_COOKIE),
    user: payload.data.user,
    role,
  });

  redirect(next.startsWith("/") ? next : "/admin");
}
