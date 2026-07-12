/**
 * dal/bookings.js — User-scoped booking reads with authorization.
 *
 * All reads here are per-user and time-sensitive → uncached. Every function
 * verifies the session at the data boundary (ADR-W002) and enforces ownership on
 * single-resource reads (CR-2 / IDOR guard). Tokens are read once from cookies
 * and passed to the transport; `retryOnUnauthorized` closes the mid-session
 * token-expiry gap (HI-9).
 */

import "server-only";
import { cookies } from "next/headers";

import { apiRequest } from "@/lib/dal/httpClient";
import { verifySession, ownsResource } from "@/lib/dal/session";
import {
  normalizeUserBookingsResponse,
  normalizeBookingDetailResponse,
} from "@/lib/normalizers";
import { COOKIE_NAMES } from "@/config/auth.config";

async function readTokens() {
  const store = await cookies();
  return {
    accessToken: store.get(COOKIE_NAMES.ACCESS_TOKEN)?.value || "",
    refreshToken: store.get(COOKIE_NAMES.REFRESH_TOKEN)?.value || "",
  };
}

/**
 * The current user's bookings (list). Requires an authenticated session.
 * @returns {Promise<object[]>}
 */
export async function getUserBookings() {
  const session = await verifySession();
  if (!session) {
    const err = new Error("Authentication required");
    err.code = "unauthorized";
    throw err;
  }
  const tokens = await readTokens();
  const { payload } = await apiRequest("/api/v1/users/me/bookings", {
    ...tokens,
    retryOnUnauthorized: true,
  });
  return normalizeUserBookingsResponse(payload.data);
}

/**
 * A single booking by id. Verifies the session and enforces ownership: the
 * backend already scopes `/bookings/:id` to the caller, but we add a frontend
 * defense-in-depth check so a cross-user id surfaces as `forbidden`, not data.
 *
 * @param {string} bookingId
 * @returns {Promise<object|null>}
 */
export async function getBooking(bookingId) {
  const session = await verifySession();
  if (!session) {
    const err = new Error("Authentication required");
    err.code = "unauthorized";
    throw err;
  }

  const tokens = await readTokens();
  const { payload } = await apiRequest(`/api/v1/bookings/${bookingId}`, {
    ...tokens,
    retryOnUnauthorized: true,
  });
  const booking = normalizeBookingDetailResponse(payload.data);
  if (!booking) return null;

  // Ownership defense-in-depth. `manage_bookings` (staff+) may view any booking.
  const ownerId = booking.userId;
  if (ownerId && !ownsResource(session, ownerId, "manage_bookings")) {
    const err = new Error("You do not have access to this booking");
    err.code = "forbidden";
    throw err;
  }

  return booking;
}
