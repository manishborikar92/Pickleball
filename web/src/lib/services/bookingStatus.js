/**
 * services/bookingStatus.js — Booking-details state machine (moved from
 * lib/bookingResolver.js). Repointed to the DAL: it calls `getBooking` from
 * `@/lib/dal/bookings` directly instead of the old dynamic `import("./api.js")`
 * hack (CR-4). Still accepts an injected `getBooking` for `node:test`.
 *
 * Consumes typed errors: it branches on `error.code` (unauthorized/forbidden/
 * not_found) instead of string-matching messages (ME-1).
 */

// Relative import with explicit extension (not "@/") so `node:test` — which uses
// raw Node ESM resolution — can load this pure module directly.
import { getPaymentReceiptDetails, getLatestPayment } from "../bookingEngine.js";

/**
 * Resolves the view state for the booking-details page.
 *
 * @param {string} bookingId
 * @param {object|null} session - Active session (or null when unauthenticated).
 * @param {{ getBooking?: (id: string) => Promise<object|null> }} [deps]
 * @returns {Promise<object>} A status wrapper for the page to render.
 */
export async function resolveBookingResult(bookingId, session, { getBooking } = {}) {
  if (!session?.user) {
    return { status: "unauthorized", booking: null };
  }

  try {
    let fetchBooking = getBooking;
    if (!fetchBooking) {
      const dal = await import("@/lib/dal/bookings");
      fetchBooking = dal.getBooking;
    }

    const booking = await fetchBooking(bookingId);
    if (!booking) {
      return { status: "error", errorType: "notFound", booking: null };
    }

    const receipt = getPaymentReceiptDetails(booking);

    if (booking.status === "confirmed" || booking.status === "walk_in" || booking.status === "completed") {
      return { status: "success", booking, receipt };
    }

    if (booking.status === "pending_payment") {
      const isExpired = booking.expiresAt ? new Date(booking.expiresAt) < new Date() : false;
      if (isExpired) {
        return { status: "expired", booking };
      }

      // A pending_payment booking whose most recent payment FAILED is semantically
      // a failed state — the booking record stays pending_payment (slots remain held
      // for retry within the TTL), so booking.status alone cannot distinguish it from
      // a genuinely in-flight payment. Inspect the payment ledger.
      if (getLatestPayment(booking)?.status === "failed") {
        return { status: "failed", booking, receipt };
      }

      return { status: "pending", booking };
    }

    if (booking.status === "expired") {
      return { status: "expired", booking };
    }

    if (booking.status === "cancelled") {
      return { status: "cancelled", booking };
    }

    return { status: "error", errorType: "unknown_status", booking };
  } catch (error) {
    // Branch on the typed code, not the message (ME-1). Fall back to legacy
    // message matching only when a code isn't present (injected test errors).
    const code = error?.code;
    const message = (error?.message || "").toLowerCase();

    if (code === "not_found" || message.includes("not found")) {
      return { status: "error", errorType: "notFound", booking: null };
    }
    if (
      code === "unauthorized" ||
      code === "forbidden" ||
      message.includes("unauthorized") ||
      message.includes("forbidden") ||
      message.includes("permission")
    ) {
      return { status: "forbidden", booking: null };
    }
    return { status: "error", errorType: "api_failure", booking: null, message: error?.message };
  }
}
