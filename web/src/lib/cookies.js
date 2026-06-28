/**
 * cookies.js — Server-side cookie mutation operations.
 *
 * Uses `cookies()` from next/headers, which is ONLY available in:
 *   - Server Actions ("use server" files invoked as actions)
 *   - Route Handlers
 *
 * NOT available in: proxy.js, Server Component rendering, client components.
 * For proxy cookie operations, use NextResponse.cookies directly with
 * constants from auth.config.js.
 */

import { cookies } from "next/headers";
import { COOKIE_NAMES, COOKIE_MAX_AGE, secureCookieOptions } from "@/config/auth.config";

// Re-export constants so existing imports from "@/lib/cookies" still work
export { COOKIE_NAMES, extractCookieValue, secureCookieOptions } from "@/config/auth.config";

export async function setSessionCookies({ accessToken, refreshToken, user, role = "customer" }) {
  const cookieStore = await cookies();

  if (accessToken) {
    cookieStore.set(COOKIE_NAMES.ACCESS_TOKEN, accessToken, secureCookieOptions(COOKIE_MAX_AGE.ACCESS_TOKEN));
  }

  if (refreshToken) {
    cookieStore.set(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, secureCookieOptions(COOKIE_MAX_AGE.REFRESH_TOKEN));
  }

  if (user) {
    cookieStore.set(COOKIE_NAMES.AUTH_ROLE, role, secureCookieOptions(COOKIE_MAX_AGE.SESSION));
    if (role !== "customer") {
      cookieStore.set(COOKIE_NAMES.STAFF_ROLE, role, secureCookieOptions(COOKIE_MAX_AGE.SESSION));
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
