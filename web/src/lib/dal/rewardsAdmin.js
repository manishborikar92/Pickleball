/**
 * dal/rewardsAdmin.js — Staff/manager reward reads for the admin panel.
 *
 * Per-venue, permission-gated, and moderation-sensitive → uncached,
 * session-verified at the boundary (ADR-W002). The role check here is the
 * frontend gate; the backend independently enforces `edit_pricing` /
 * `manage_bookings` per route, so a stale client role can never over-read.
 */

import "server-only";
import { cookies } from "next/headers";

import { apiRequest } from "@/lib/dal/httpClient";
import { verifySession } from "@/lib/dal/session";
import { getVenue } from "@/lib/dal/venues";
import { hasPermission } from "@/lib/rbac";
import {
  normalizeModerationInstance,
  normalizeRewardMechanism,
} from "@/lib/normalizers";
import { COOKIE_NAMES } from "@/config/auth.config";
import { VENUE } from "@/config/venue.config";

async function readTokens() {
  const store = await cookies();
  return {
    accessToken: store.get(COOKIE_NAMES.ACCESS_TOKEN)?.value || "",
    refreshToken: store.get(COOKIE_NAMES.REFRESH_TOKEN)?.value || "",
  };
}

function requirePanelPermission(session, permission) {
  if (!session || !hasPermission(session.role, permission)) {
    const err = new Error("Not authorized to view reward administration");
    err.code = "forbidden";
    throw err;
  }
}

/** Resolves the single active venue's id from the cached venue read. */
async function resolveVenueId() {
  const venue = await getVenue(VENUE.slug);
  return venue.id;
}

/**
 * The venue's reward mechanisms (active and inactive). `edit_pricing`.
 * @returns {Promise<{ venueId: string, mechanisms: object[] }>}
 */
export async function getRewardMechanisms() {
  const session = await verifySession();
  requirePanelPermission(session, "edit_pricing");

  const venueId = await resolveVenueId();
  const tokens = await readTokens();
  const { payload } = await apiRequest(
    `/api/v1/rewards/mechanisms?venue_id=${venueId}`,
    { ...tokens, retryOnUnauthorized: true },
  );
  return {
    venueId,
    mechanisms: (payload.data || []).map(normalizeRewardMechanism),
  };
}

/**
 * Paginated moderation listing of the venue's reward instances.
 * `manage_bookings`.
 *
 * @param {{ status?: string, voucherCode?: string, redeemed?: boolean, page?: number, limit?: number }} [filters]
 * @returns {Promise<{ venueId: string, instances: object[], pagination: object }>}
 */
export async function getRewardInstancesForModeration(filters = {}) {
  const session = await verifySession();
  requirePanelPermission(session, "manage_bookings");

  const venueId = await resolveVenueId();
  const params = new URLSearchParams({ venue_id: venueId });
  if (filters.status) params.set("status", filters.status);
  if (filters.voucherCode) params.set("voucher_code", filters.voucherCode.trim().toUpperCase());
  if (filters.redeemed !== undefined) params.set("redeemed", String(filters.redeemed));
  params.set("page", String(filters.page || 1));
  params.set("limit", String(filters.limit || 20));

  const tokens = await readTokens();
  const { payload } = await apiRequest(
    `/api/v1/rewards/instances/moderation?${params}`,
    { ...tokens, retryOnUnauthorized: true },
  );
  return {
    venueId,
    instances: (payload.data || []).map(normalizeModerationInstance),
    pagination: payload.meta?.pagination || { page: 1, limit: 20, total: 0, total_pages: 0 },
  };
}
