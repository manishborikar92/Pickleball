/**
 * dal/reviews.js — Review reads.
 *
 * Two access patterns live here:
 *   1. The published-reviews list is public and slow-changing, so it is cached
 *      and tagged per venue (ADR-W004); submitting a review revalidates the tag.
 *   2. The caller's own review for a booking is per-user and drives the review
 *      page lifecycle → uncached, session-verified at the data boundary
 *      (ADR-W002), mirroring dal/bookings.js.
 */

import "server-only";
import { cookies } from "next/headers";
import { cacheLife, cacheTag } from "next/cache";

import { apiRequest } from "@/lib/dal/httpClient";
import { verifySession } from "@/lib/dal/session";
import { normalizeReviewResponse } from "@/lib/normalizers";
import { COOKIE_NAMES } from "@/config/auth.config";

/** Cache tag for a venue's public reviews — used by reads and `revalidateTag`. */
export function reviewsTag(venueId) {
  return `reviews:${venueId}`;
}

/**
 * Public, published reviews for a venue with a rating summary.
 * @param {string} venueId
 * @param {{ page?: number, limit?: number }} [options]
 * @returns {Promise<{ data: object[], meta: object }>}
 */
export async function getVenueReviews(venueId, { page = 1, limit = 10 } = {}) {
  "use cache";
  cacheLife("hours");
  cacheTag(reviewsTag(venueId));

  const { payload } = await apiRequest(
    `/api/v1/reviews?venue_id=${venueId}&page=${page}&limit=${limit}`,
    { cache: "force-cache" },
  );
  return { data: payload.data, meta: payload.meta };
}

/**
 * The authenticated user's own review for a booking, or `null` when none
 * exists yet — a normal state for the review page, not an error. The backend
 * scopes `/reviews/me` to the caller, so another user's review also resolves
 * to `null` here (surfaced as 404 upstream).
 *
 * @param {string} bookingId
 * @returns {Promise<object|null>} Normalized review or null.
 */
export async function getMyBookingReview(bookingId) {
  const session = await verifySession();
  if (!session) {
    const err = new Error("Authentication required");
    err.code = "unauthorized";
    throw err;
  }

  const store = await cookies();
  const tokens = {
    accessToken: store.get(COOKIE_NAMES.ACCESS_TOKEN)?.value || "",
    refreshToken: store.get(COOKIE_NAMES.REFRESH_TOKEN)?.value || "",
  };

  try {
    const { payload } = await apiRequest(
      `/api/v1/reviews/me?booking_id=${encodeURIComponent(bookingId)}`,
      { ...tokens, retryOnUnauthorized: true },
    );
    return normalizeReviewResponse(payload.data);
  } catch (error) {
    if (error?.code === "not_found") return null;
    throw error;
  }
}
