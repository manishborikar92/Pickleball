import { cookies } from "next/headers";

export const COOKIE_NAMES = {
  ACCESS_TOKEN: "pb_access_token",
  REFRESH_TOKEN: "pb_refresh_token",
  AUTH_ROLE: "pb_auth_role",
  STAFF_ROLE: "pb_staff_role",
  USER_ONBOARDED: "pb_user_onboarded",
};

export function extractCookieValue(setCookie, name) {
  if (!setCookie) return "";
  const match = setCookie.match(new RegExp(`${name}=([^;]*)`));
  return match?.[1] || "";
}

function secureCookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

export async function setSessionCookies({ accessToken, refreshToken, user, role = "customer" }) {
  const cookieStore = await cookies();

  if (accessToken) {
    cookieStore.set(COOKIE_NAMES.ACCESS_TOKEN, accessToken, secureCookieOptions(15 * 60));
  }

  if (refreshToken) {
    cookieStore.set(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, secureCookieOptions(60 * 60 * 24 * 30));
  }

  if (user) {
    cookieStore.set(COOKIE_NAMES.AUTH_ROLE, role, secureCookieOptions(60 * 60 * 24 * 30));
    if (role !== "customer") {
      cookieStore.set(COOKIE_NAMES.STAFF_ROLE, role, secureCookieOptions(60 * 60 * 24 * 30));
    }
    cookieStore.set(COOKIE_NAMES.USER_ONBOARDED, String(Boolean(user.onboarding_complete)), secureCookieOptions(60 * 60 * 24 * 30));
  }
}

export async function clearSessionCookies() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: COOKIE_NAMES.ACCESS_TOKEN, path: "/" });
  cookieStore.delete({ name: COOKIE_NAMES.REFRESH_TOKEN, path: "/" });
  cookieStore.delete({ name: COOKIE_NAMES.AUTH_ROLE, path: "/" });
  cookieStore.delete({ name: COOKIE_NAMES.STAFF_ROLE, path: "/" });
  cookieStore.delete({ name: COOKIE_NAMES.USER_ONBOARDED, path: "/" });
}
