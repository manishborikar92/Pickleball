/**
 * dal/notifications.js — Admin notification settings + dispatch-log reads for
 * the settings panel.
 *
 * Per-venue, permission-gated, and moderation-sensitive → uncached,
 * session-verified at the boundary (ADR-W002). The role check here is the
 * frontend gate; the backend independently enforces `manage_venues` (settings)
 * / `manage_bookings` (log) per route, so a stale client role can never over-read.
 */

import "server-only";
import { cookies } from "next/headers";

import { apiRequest } from "@/lib/dal/httpClient";
import { verifySession } from "@/lib/dal/session";
import { getVenue } from "@/lib/dal/venues";
import { hasPermission } from "@/lib/rbac";
import {
  normalizeNotificationLogRow,
  normalizeNotificationSettings,
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
    const err = new Error("Not authorized to view notification settings");
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
 * The venue's notification toggle settings (reminders + review requests).
 * `manage_venues`. Returns both-off defaults when no row exists yet.
 * @returns {Promise<{ venueId: string, settings: object }>}
 */
export async function getNotificationSettings() {
  const session = await verifySession();
  requirePanelPermission(session, "manage_venues");

  const venueId = await resolveVenueId();
  const tokens = await readTokens();
  const { payload } = await apiRequest(
    `/api/v1/notifications/settings?venue_id=${venueId}`,
    { ...tokens, retryOnUnauthorized: true },
  );
  return {
    venueId,
    settings: normalizeNotificationSettings(payload.data),
  };
}

/**
 * Recent notification dispatch activity for the venue, plus per-status counts.
 * `manage_bookings`.
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<{ venueId: string, rows: object[], summary: object }>}
 */
export async function getNotificationLog({ limit = 8 } = {}) {
  const session = await verifySession();
  requirePanelPermission(session, "manage_bookings");

  const venueId = await resolveVenueId();
  const params = new URLSearchParams({ venue_id: venueId, page: "1", limit: String(limit) });
  const tokens = await readTokens();
  const { payload } = await apiRequest(
    `/api/v1/notifications/log?${params}`,
    { ...tokens, retryOnUnauthorized: true },
  );
  return {
    venueId,
    rows: (payload.data || []).map(normalizeNotificationLogRow),
    summary: payload.meta?.summary || {},
  };
}
