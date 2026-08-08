"use server";

/**
 * lib/actions/auth.js — Authentication mutation actions (route-independent).
 *
 * Relocated out of `app/(auth)/actions.js` so that reusable components and route
 * files both import from `@/lib/actions/*` and nothing under components/lib/hooks
 * imports from `@/app/` (ADR-W009). Each action: validate → call backend →
 * persist cookies → return the typed result (or redirect).
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { apiRequest } from "@/lib/dal/httpClient";
import { verifySession } from "@/lib/dal/session";
import { COOKIE_NAMES } from "@/config/auth.config";
import { extractCookieValue, resolveRole } from "@/lib/auth";
import { setSessionCookies, clearSessionCookies } from "@/lib/cookies";
import { safeNext } from "@/lib/safeNext";
import { phoneSchema, otpSchema, nameSchema } from "@/lib/schemas";
import { ok, fail } from "@/lib/actions/result";

export async function sendCustomerOtpAction(phone) {
  const parsed = phoneSchema.safeParse(phone);
  if (!parsed.success) {
    return fail(null, { code: "bad_request", message: parsed.error.issues[0]?.message });
  }
  try {
    const { payload } = await apiRequest("/api/v1/auth/otp/send", {
      method: "POST",
      body: { phone: parsed.data },
    });
    return ok(payload.data);
  } catch (error) {
    return fail(error);
  }
}

export async function verifyCustomerOtpAction(phone, otp) {
  const parsedPhone = phoneSchema.safeParse(phone);
  const parsedOtp = otpSchema.safeParse(otp);
  if (!parsedPhone.success || !parsedOtp.success) {
    return fail(null, {
      code: "bad_request",
      message: parsedOtp.success
        ? "Enter a valid phone number."
        : "Enter the 6-digit verification code.",
    });
  }

  try {
    const { payload, setCookie } = await apiRequest("/api/v1/auth/otp/verify", {
      method: "POST",
      body: { phone: parsedPhone.data, otp: parsedOtp.data },
    });

    await setSessionCookies({
      accessToken: payload.data.access_token,
      refreshToken: extractCookieValue(setCookie, COOKIE_NAMES.REFRESH_TOKEN),
      user: payload.data.user,
    });

    return ok(payload.data);
  } catch (error) {
    return fail(error);
  }
}

export async function completeOnboardingAction(name) {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) {
    return fail(null, { code: "bad_request", message: parsed.error.issues[0]?.message });
  }

  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value || "";
    const { payload } = await apiRequest("/api/v1/auth/onboarding", {
      method: "POST",
      body: { name: parsed.data },
      accessToken,
    });

    await setSessionCookies({ accessToken, user: payload.data.user });
    return ok(payload.data);
  } catch (error) {
    return fail(error);
  }
}

export async function updateProfileAction(name) {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) {
    return fail(null, { code: "bad_request", message: parsed.error.issues[0]?.message });
  }

  const session = await verifySession();
  if (!session?.user) {
    return fail(null, { code: "unauthorized", message: "Authentication required." });
  }

  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value || "";
    const refreshToken = cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN)?.value || "";
    const { payload } = await apiRequest("/api/v1/users/me", {
      method: "PATCH",
      body: { name: parsed.data },
      accessToken,
      refreshToken,
      retryOnUnauthorized: true,
    });

    return ok(payload.data);
  } catch (error) {
    return fail(error);
  }
}

export async function signOutCustomerAction() {
  await revokeAndClear();
  redirect("/");
}

export async function signOutAdminAction() {
  await revokeAndClear();
  redirect("/admin/login");
}

/**
 * Revokes the refresh token server-side and clears local cookies. Surfaces a
 * failure via console (ME-16) while still clearing locally — the short 15-min
 * access TTL bounds any residual validity.
 */
async function revokeAndClear() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN)?.value || "";

  if (refreshToken) {
    try {
      await apiRequest("/api/v1/auth/logout", { method: "POST", refreshToken });
    } catch (error) {
      console.error("Logout revocation failed (clearing local session anyway):", error?.message);
    }
  }
  await clearSessionCookies();
}

export async function signInAdminAction(_prevState, formData) {
  const email = String(formData?.get("email") || "");
  const password = String(formData?.get("password") || "");
  const next = safeNext(String(formData?.get("next") || ""), "/admin/overview");

  try {
    const { payload, setCookie } = await apiRequest("/api/v1/auth/admin/login", {
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
  } catch (error) {
    const message = error?.status === 401
      ? "Invalid email or password."
      : "Unable to sign in right now. Please try again.";
    return { success: false, error: message };
  }

  // redirect() throws NEXT_REDIRECT; keep it OUTSIDE the try so it propagates.
  redirect(next);
}
