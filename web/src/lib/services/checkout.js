/**
 * services/checkout.js — The checkout transaction (HI-13).
 *
 * Moves the hold → waiver → initiate-payment orchestration OFF the client
 * (previously ~70 lines inside BookingClient) and onto the server, where it can
 * be validated, authorized, and tested. The `BookingClient` now only navigates
 * based on the discriminated result this returns.
 *
 * Pure and dependency-injected: it receives the three backend calls as functions
 * so `node:test` can exercise the branching without a network or Next runtime.
 * `lib/actions/booking.js` wires the real implementations.
 *
 * Returns a discriminated result:
 *   { kind: "confirmed", bookingId }                     → wallet-only / already paid
 *   { kind: "redirect", bookingId, merchantOrderId, redirectUrl } → gateway checkout
 */

/**
 * @param {object} deps
 * @param {(selection: object) => Promise<object>} deps.createHold        - resolves normalized hold
 * @param {(bookingId: string) => Promise<void>}   deps.acceptWaiver
 * @param {(bookingId: string, opts: object) => Promise<object>} deps.initiatePayment - resolves normalized initiation
 * @param {object} params
 * @param {object} params.selection - The validated booking-selection payload.
 * @param {boolean} [params.useWalletCredits=true]
 * @returns {Promise<{kind: "confirmed"|"redirect", bookingId: string, merchantOrderId?: string, redirectUrl?: string}>}
 */
export async function runCheckout({ createHold, acceptWaiver, initiatePayment }, { selection, useWalletCredits = true }) {
  const hold = await createHold(selection);
  const bookingId = hold.bookingId;
  if (!bookingId) {
    const err = new Error("Could not create booking hold.");
    err.code = "hold_failed";
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
