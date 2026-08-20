/**
 * cookies.js — Server-side cookie mutation operations.
 *
 * Uses cookies() from next/headers — ONLY available in:
 *   - Server Actions ("use server" files invoked as actions)
 *   - Route Handlers
 *
 * For proxy cookie operations, use NextResponse.cookies with
 * constants from @/config/auth.config and helpers from @/lib/auth.
 */

import { cookies } from "next/headers";
import { COOKIE_NAMES, COOKIE_MAX_AGE, CUSTOMER_ROLE } from "@/config/auth.config";
import { secureCookieOptions } from "@/lib/auth";

export async function setSessionCookies({ accessToken, refreshToken, user, role }) {
  const cookieStore = await cookies();

  if (accessToken) {
    cookieStore.set(COOKIE_NAMES.ACCESS_TOKEN, accessToken, secureCookieOptions(COOKIE_MAX_AGE.ACCESS_TOKEN));
  }

  if (refreshToken) {
    cookieStore.set(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, secureCookieOptions(COOKIE_MAX_AGE.REFRESH_TOKEN));
  }

  if (user) {
    const effectiveRole = role || user.role;
    if (typeof effectiveRole !== "string" || effectiveRole.length === 0) {
      cookieStore.delete({ name: COOKIE_NAMES.AUTH_ROLE, path: "/" });
      cookieStore.delete({ name: COOKIE_NAMES.ADMIN_ROLE, path: "/" });
      cookieStore.delete({ name: COOKIE_NAMES.USER_ONBOARDED, path: "/" });
      return;
    }

    cookieStore.set(COOKIE_NAMES.AUTH_ROLE, effectiveRole, secureCookieOptions(COOKIE_MAX_AGE.SESSION));
    if (effectiveRole !== CUSTOMER_ROLE) {
      // Privileged marker — sameSite "strict" (admin flows are same-site). LO-12.
      cookieStore.set(COOKIE_NAMES.ADMIN_ROLE, effectiveRole, secureCookieOptions(COOKIE_MAX_AGE.SESSION, { sameSite: "strict" }));
    } else {
      // Clear any stale admin marker when a now-customer session is written (LO-13).
      cookieStore.delete({ name: COOKIE_NAMES.ADMIN_ROLE, path: "/" });
    }
    cookieStore.set(COOKIE_NAMES.USER_ONBOARDED, String(Boolean(user.onboarding_complete)), secureCookieOptions(COOKIE_MAX_AGE.SESSION));
  }
}

export async function clearSessionCookies() {
  const cookieStore = await cookies();
  for (const name of Object.values(COOKIE_NAMES)) {
    cookieStore.delete({ name, path: "/" });
  }
}
