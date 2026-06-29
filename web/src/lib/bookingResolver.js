import { getPaymentReceiptDetails, getLatestPayment } from "./bookingEngine.js";

/**
 * Server-side resolver for the booking details page.
 * Fetches the booking, validates session authorization, checks for hold expiration,
 * and passes the pre-normalized payload directly.
 *
 * @param {string} bookingId - The booking UUID.
 * @param {Object} session - The active user session.
 * @returns {Promise<Object>} Resolves to a status wrapper containing the normalized booking.
 */
export async function resolveBookingResult(bookingId, session, { getBookingById = null } = {}) {
  // 1. Session Auth Check
  if (!session?.user) {
    return { status: "unauthorized", booking: null };
  }

  try {
    // 2. Fetch booking via Server Action (dynamically imported when not mocked for test-runner compliance)
    let fetchBooking = getBookingById;
    if (!fetchBooking) {
      const api = await import("./api.js");
      fetchBooking = api.getBookingById;
    }

    const booking = await fetchBooking(bookingId);
    if (!booking) {
      return { status: "error", errorType: "notFound", booking: null };
    }

    // 3. Map receipt details directly from the pre-normalized booking object
    const receipt = getPaymentReceiptDetails(booking);

    // 4. Evaluate the Domain State Machine
    if (booking.status === "confirmed" || booking.status === "walk_in" || booking.status === "completed") {
      return { status: "success", booking, receipt };
    }

    if (booking.status === "pending_payment") {
      // Check if hold has expired (10-minute lease window check)
      const isExpired = booking.expiresAt ? new Date(booking.expiresAt) < new Date() : false;
      if (isExpired) {
        return { status: "expired", booking };
      }

      // A pending_payment booking whose most recent payment FAILED is semantically
      // a failed state — the booking record stays pending_payment (slots remain held
      // for retry within the TTL), so booking.status alone cannot distinguish it from
      // a genuinely in-flight payment. Inspect the payment ledger: if the latest
      // payment failed, surface the failed view (with retry) instead of an endless poll.
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

    // Fallback for unknown states
    return { status: "error", errorType: "unknown_status", booking };
  } catch (error) {
    const message = error.message || "";
    if (message.toLowerCase().includes("not found")) {
      return { status: "error", errorType: "notFound", booking: null };
    }
    if (message.toLowerCase().includes("unauthorized") || message.toLowerCase().includes("forbidden") || message.toLowerCase().includes("permission")) {
      return { status: "forbidden", booking: null };
    }
    return { status: "error", errorType: "api_failure", booking: null, message };
  }
}
