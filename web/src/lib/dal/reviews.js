/**
 * dal/reviews.js — Public venue reviews read.
 *
 * The published-reviews list is public and slow-changing, so it is cached and
 * tagged per venue (ADR-W004); submitting a review revalidates the tag.
 */

import "server-only";
import { cacheLife, cacheTag } from "next/cache";

import { apiRequest } from "@/lib/dal/httpClient";

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
