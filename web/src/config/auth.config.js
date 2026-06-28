/**
 * auth.config.js — Auth configuration constants.
 *
 * Pure static values only. NO functions, NO framework imports.
 * Safe to import from ANY context: proxy, server components, server actions, tests.
 */

export const COOKIE_NAMES = {
  ACCESS_TOKEN: "pb_access_token",
  REFRESH_TOKEN: "pb_refresh_token",
  AUTH_ROLE: "pb_auth_role",
  STAFF_ROLE: "pb_staff_role",
  USER_ONBOARDED: "pb_user_onboarded",
};

export const COOKIE_MAX_AGE = {
  ACCESS_TOKEN: 15 * 60,             // 15 minutes
  REFRESH_TOKEN: 60 * 60 * 24 * 30,  // 30 days
  SESSION: 60 * 60 * 24 * 30,        // 30 days (role, onboarded flags)
};

export const REFRESH_BUFFER_SECONDS = 30;
