/**
 * dal/availability.js — Court availability reads.
 *
 * Availability is time-sensitive and changes as slots are held/booked, so it is
 * deliberately UNCACHED and meant to stream behind <Suspense> (ADR-W004). The
 * cached venue shell renders first; this fills in the live grid.
 */

import "server-only";

import { apiRequest } from "@/lib/dal/httpClient";
import { normalizeAvailabilityResponse } from "@/lib/normalizers";

/**
 * Fetches normalized availability for a venue on a given date.
 * @param {{ venueId: string, date: string }} params
 * @returns {Promise<object[]>}
 */
export async function getAvailability({ venueId, date }) {
  const { payload } = await apiRequest(
    `/api/v1/venues/${venueId}/availability?date=${date}`,
    { cache: "no-store" },
  );
  return normalizeAvailabilityResponse(payload.data);
}
