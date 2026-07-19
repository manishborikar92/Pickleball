/**
 * services/checkout.js — The checkout transaction (HI-13), commit-on-confirm.
 *
 * The slot hold is created only when the user clicks the final "Confirm & Pay"
 * button — never while they are still reviewing checkout. Reviewing (and
 * closing) the confirm modal therefore leaves zero server-side state: no stale
 * holds, and the live price preview never collides with the user's own hold.
 *
 * `runCheckout` is the commit: hold → waiver → initiate-payment in one pass,
 * returning the hold's `expiresAt` so the UI can count down the 10-minute
 * payment window that starts at this moment (03-UI-UX-SPECIFICATION §2.4).
 * `confirmHeldBooking` alone is the resume path for an already-held booking
 * (cancelled gateway popup, reload, back-navigation) — the backend reuses the
 * initiated payment order.
 *
 * All functions are pure and dependency-injected: they receive the backend
 * calls as functions so `node:test` can exercise the branching without a
 * network or Next runtime. `lib/actions/booking.js` wires the real
 * implementations.
 */

/**
 * Creates the slot hold that anchors checkout. The returned `expiresAt` drives
 * the countdown; `bookingId` is what `confirmHeldBooking` operates on.
 *
 * @param {object} deps
 * @param {(selection: object) => Promise<object>} deps.createHold - resolves normalized hold
 * @param {object} params
 * @param {object} params.selection - The validated booking-selection payload.
 * @returns {Promise<{bookingId: string, expiresAt: string, status: string}>}
 */
export async function createBookingHold({ createHold }, { selection }) {
  const hold = await createHold(selection);
  if (!hold.bookingId) {
    const err = new Error("Could not create booking hold.");
    err.code = "hold_failed";
    throw err;
  }
  if (!hold.expiresAt || Number.isNaN(new Date(hold.expiresAt).getTime())) {
    const err = new Error("Booking hold is missing its expiry time.");
    err.code = "hold_failed";
    throw err;
  }
  return hold;
}

/**
 * Completes checkout on a booking already held via `createBookingHold`:
 * accepts the waiver, then initiates payment.
 *
 * Returns a discriminated result:
 *   { kind: "confirmed", bookingId }                              → wallet-only / already paid
 *   { kind: "redirect", bookingId, merchantOrderId, redirectUrl } → gateway checkout
 *
 * @param {object} deps
 * @param {(bookingId: string) => Promise<void>}                 deps.acceptWaiver
 * @param {(bookingId: string, opts: object) => Promise<object>} deps.initiatePayment - resolves normalized initiation
 * @param {object} params
 * @param {string} params.bookingId
 * @param {boolean} [params.useWalletCredits=true]
 * @returns {Promise<{kind: "confirmed"|"redirect", bookingId: string, merchantOrderId?: string, redirectUrl?: string}>}
 */
export async function confirmHeldBooking(
  { acceptWaiver, initiatePayment },
  { bookingId, useWalletCredits = true },
) {
  if (!bookingId) {
    const err = new Error("Missing booking reference.");
    err.code = "bad_request";
    throw err;
  }

  await acceptWaiver(bookingId);

  const payment = await initiatePayment(bookingId, { useWalletCredits });

  if (payment.kind === "confirmed") {
    return { kind: "confirmed", bookingId };
  }

  if (payment.redirectUrl) {
    return {
      kind: "redirect",
      bookingId,
      merchantOrderId: payment.merchantOrderId,
      redirectUrl: payment.redirectUrl,
    };
  }

  const err = new Error("Payment could not be initiated. Please try again.");
  err.code = "payment_init_failed";
  throw err;
}

/**
 * The checkout commit: reserves the slots and immediately completes the held
 * booking (hold → waiver → initiate-payment). Runs only when the user clicks
 * the final Confirm & Pay button — the 10-minute payment window starts here.
 *
 * The hold's `expiresAt` is threaded onto the result so the client can count
 * down the payment window and offer resume if the gateway step is abandoned.
 *
 * @param {object} deps - `createHold`, `acceptWaiver`, `initiatePayment` (see above).
 * @param {object} params
 * @param {object} params.selection - The validated booking-selection payload.
 * @param {boolean} [params.useWalletCredits=true]
 * @returns {Promise<{kind: "confirmed"|"redirect", bookingId: string, expiresAt: string, merchantOrderId?: string, redirectUrl?: string}>}
 */
export async function runCheckout(deps, { selection, useWalletCredits = true }) {
  const hold = await createBookingHold(deps, { selection });
  const result = await confirmHeldBooking(deps, {
    bookingId: hold.bookingId,
    useWalletCredits,
  });
  return { ...result, expiresAt: hold.expiresAt };
}
