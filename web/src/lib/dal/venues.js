/**
 * dal/venues.js — Venue reads.
 *
 * Venue + court configuration is public and slow-changing, so `getVenue` is a
 * cached read: `"use cache"` + `cacheTag('venue:'+slug)` + `cacheLife('hours')`
 * (ADR-W004). Mutations that change venue config call `revalidateTag` to bust it.
 * `react.cache()` additionally dedupes calls within a single render (HI-6), so
 * `generateMetadata` + the page body share one fetch.
 */

import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";

import { apiRequest } from "@/lib/dal/httpClient";
import { normalizeVenueResponse } from "@/lib/normalizers";

/** Cache tag for a venue by slug — used by reads and `revalidateTag`. */
export function venueTag(slug) {
  return `venue:${slug}`;
}

/**
 * Fetches and normalizes a venue by slug. Cached (public, slow-changing).
 * @param {string} slug
 * @returns {Promise<object>}
 */
export const getVenue = cache(async function getVenue(slug) {
  "use cache";
  cacheLife("hours");
  cacheTag(venueTag(slug));

  if (!slug) {
    throw new Error("Venue slug is required");
  }
  const { payload } = await apiRequest(`/api/v1/venues/slug/${slug}`, {
    cache: "force-cache",
  });
  return normalizeVenueResponse(payload.data);
});
