/**
 * services/reviewStatus.js — Review-page state machine (sibling of
 * bookingStatus.js). Resolves which view /review/[bookingId] should render so
 * users are never shown a form they cannot successfully submit: authentication,
 * ownership, booking eligibility, and the one-review-per-booking rule are all
 * settled server-side BEFORE the form appears.
 *
 * Pure module with injectable reads (`getBooking`, `getMyReview`) so `node:test`
 * can exercise every branch; the DAL is only imported dynamically when deps are
 * not supplied. Branches on typed `error.code`, never message strings (ME-1).
 */

/** Booking statuses that can still become completed (session not played yet). */
const UPCOMING_STATUSES = new Set(["pending_payment", "confirmed", "walk_in"]);

/**
 * Resolves the view state for the review page.
 *
 * @param {string} bookingId
 * @param {object|null} session - Active session (or null when unauthenticated).
 * @param {{ getBooking?: Function, getMyReview?: Function }} [deps]
 * @returns {Promise<{status: string, booking: object|null, review: object|null, message?: string}>}
 *   status is one of: "unauthorized" | "form" | "already_reviewed" |
 *   "not_completed" | "not_reviewable" | "forbidden" | "not_found" | "error".
 */
export async function resolveReviewResult(bookingId, session, { getBooking, getMyReview } = {}) {
  if (!session?.user) {
    return { status: "unauthorized", booking: null, review: null };
  }

  try {
    if (!getBooking || !getMyReview) {
      const [bookingsDal, reviewsDal] = await Promise.all([
        import("@/lib/dal/bookings"),
        import("@/lib/dal/reviews"),
      ]);
      getBooking = getBooking || bookingsDal.getBooking;
      getMyReview = getMyReview || reviewsDal.getMyBookingReview;
    }

    const booking = await getBooking(bookingId);
    if (!booking) {
      return { status: "not_found", booking: null, review: null };
    }

    // Only the booking owner may review. Staff with `manage_bookings` can VIEW
    // any booking through the DAL, but must never see someone else's review form
    // (CR-2 — "booking owner also verified").
    if (booking.userId && booking.userId !== session.user.id) {
      return { status: "forbidden", booking: null, review: null };
    }

    // Eligibility: reviews exist iff booking.status === 'completed', so the
    // review lookup is skipped for ineligible bookings.
    if (booking.status !== "completed") {
      return {
        status: UPCOMING_STATUSES.has(booking.status) ? "not_completed" : "not_reviewable",
        booking,
        review: null,
      };
    }

    const review = await getMyReview(bookingId);
    if (review) {
      return { status: "already_reviewed", booking, review };
    }

    return { status: "form", booking, review: null };
  } catch (error) {
    const code = error?.code;
    // A malformed bookingId fails backend param validation (400) — to the user
    // that is simply a booking that doesn't exist.
    if (code === "not_found" || code === "bad_request") {
      return { status: "not_found", booking: null, review: null };
    }
    if (code === "unauthorized") {
      return { status: "unauthorized", booking: null, review: null };
    }
    if (code === "forbidden") {
      return { status: "forbidden", booking: null, review: null };
    }
    return { status: "error", booking: null, review: null, message: error?.message };
  }
}
