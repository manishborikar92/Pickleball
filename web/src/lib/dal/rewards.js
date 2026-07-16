/**
 * dal/rewards.js — User-scoped reward reads with authorization.
 *
 * Per-user and reveal-sensitive → uncached, session-verified at the boundary
 * (ADR-W002). The backend scopes reads to the caller, so no extra ownership
 * check is needed here.
 */

import "server-only";
import { cookies } from "next/headers";

import { apiRequest } from "@/lib/dal/httpClient";
import { verifySession } from "@/lib/dal/session";
import { normalizeMyRewardsResponse } from "@/lib/normalizers";
import { COOKIE_NAMES } from "@/config/auth.config";

async function readTokens() {
  const store = await cookies();
  return {
    accessToken: store.get(COOKIE_NAMES.ACCESS_TOKEN)?.value || "",
    refreshToken: store.get(COOKIE_NAMES.REFRESH_TOKEN)?.value || "",
  };
}

function requireSession(session) {
  if (!session) {
    const err = new Error("Authentication required");
    err.code = "unauthorized";
    throw err;
  }
}

/**
 * The current user's reward instances (pending, revealed, and expired).
 * @returns {Promise<object[]>}
 */
export async function getMyRewards() {
  const session = await verifySession();
  requireSession(session);

  const tokens = await readTokens();
  const { payload } = await apiRequest("/api/v1/rewards/instances", {
    ...tokens,
    retryOnUnauthorized: true,
  });
  return normalizeMyRewardsResponse(payload.data);
}

/**
 * The caller's reward instances for one booking — powers the inline scratch
 * card on the booking-confirmation page. Non-throwing: rewards are an
 * enhancement there, so any failure (including no session) yields [] and the
 * booking page renders unaffected.
 *
 * @param {string} bookingId
 * @returns {Promise<object[]>}
 */
export async function getRewardsForBooking(bookingId) {
  if (!bookingId) return [];
  try {
    const rewards = await getMyRewards();
    return rewards.filter((reward) => reward.bookingId === bookingId);
  } catch {
    return [];
  }
}
