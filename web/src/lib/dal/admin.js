/**
 * dal/admin.js — Admin overview read (ME-3).
 *
 * Replaces the former hardcoded mock in `lib/api.js`. The backend does not yet
 * expose an admin-analytics endpoint (revenue/utilization/pending aggregates),
 * so this DAL sources the data that genuinely exists — the venue's real courts,
 * from the cached venue read — and derives `activeCourts` from them. Aggregate
 * KPIs that require a backend endpoint are surfaced as `null` (rendered as "—")
 * rather than fabricated numbers, so the admin console never shows fiction.
 *
 * When a `GET /admin/overview` (or equivalent) endpoint lands, swap the body of
 * `getAdminOverview` to call it; the return shape is already the contract the
 * admin components consume.
 */

import "server-only";

import { verifySession } from "@/lib/dal/session";
import { getVenue } from "@/lib/dal/venues";
import { hasPermission } from "@/lib/rbac";
import { VENUE } from "@/config/venue.config";

/**
 * @typedef {Object} AdminOverview
 * @property {{ revenueToday: number|null, utilization: string|null, pendingBookings: number|null, activeCourts: number }} stats
 * @property {object[]} bookings
 * @property {object[]} courts
 */

/**
 * Admin operational overview. Requires the `manage_bookings` permission.
 * @returns {Promise<AdminOverview>}
 */
export async function getAdminOverview() {
  const session = await verifySession();
  if (!session || !hasPermission(session.role, "manage_bookings")) {
    const err = new Error("Not authorized to view admin overview");
    err.code = "forbidden";
    throw err;
  }

  const venue = await getVenue(VENUE.slug);
  const courts = (venue.courts || []).map((court) => ({
    id: court.id,
    name: court.name,
    status: court.status || "active",
    environment: court.environment,
    surfaceType: court.surfaceType,
  }));

  return {
    stats: {
      // Real, derivable-now metric.
      activeCourts: courts.filter((court) => court.status === "active").length,
      // Require a backend analytics endpoint — null → rendered as "—".
      revenueToday: null,
      utilization: null,
      pendingBookings: null,
    },
    bookings: [],
    courts,
  };
}
