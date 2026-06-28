"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { apiRequest } from "@/lib/apiClient";
import { COOKIE_NAMES, extractCookieValue, setSessionCookies, clearSessionCookies } from "@/lib/cookies";
import { resolveRole } from "@/config/auth.config";

export async function getSessionAction() {
  return await getSession();
}

export async function sendCustomerOtpAction(phone) {
  try {
    const { payload } = await apiRequest("/api/v1/auth/otp/send", {
      method: "POST",
      body: { phone },
    });
    return { success: true, data: payload.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function verifyCustomerOtpAction(phone, otp) {
  try {
    const { payload, setCookie } = await apiRequest("/api/v1/auth/otp/verify", {
      method: "POST",
      body: { phone, otp },
    });

    await setSessionCookies({
      accessToken: payload.data.access_token,
      refreshToken: extractCookieValue(setCookie, COOKIE_NAMES.REFRESH_TOKEN),
      user: payload.data.user,
    });

    return { success: true, data: payload.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function completeOnboardingAction(name) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value || "";
    const { payload } = await apiRequest("/api/v1/auth/onboarding", {
      method: "POST",
      body: { name },
      accessToken,
    });

    await setSessionCookies({
      accessToken,
      user: payload.data.user,
    });

    return { success: true, data: payload.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function signOutCustomerAction() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN)?.value || "";

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
  const refreshToken = cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN)?.value || "";

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
  const next = String(formData?.get("next") || "/admin/overview");

  const { payload, setCookie } = await apiRequest("/api/v1/auth/staff/login", {
    method: "POST",
    body: { email, password },
  });

  const role = resolveRole(payload.data.user, "staff");
  await setSessionCookies({
    accessToken: payload.data.access_token,
    refreshToken: extractCookieValue(setCookie, COOKIE_NAMES.REFRESH_TOKEN),
    user: payload.data.user,
    role,
  });

  redirect(next.startsWith("/") ? next : "/admin/overview");
}
