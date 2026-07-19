"use server";

/**
 * lib/actions/booking.js — Booking mutation actions (route-independent, ADR-W009).
 *
 * Checkout is commit-on-confirm (HI-13): nothing is reserved while the user
 * reviews checkout. `checkoutBookingAction` runs the whole hold → waiver →
 * initiate-payment transaction when the user clicks the final Confirm & Pay
 * button, returning `expiresAt` so the client can count down the 10-minute
 * payment window; `confirmHeldBookingAction` resumes an already-held booking
 * (cancelled/abandoned gateway step) within that window. Every action validates
 * its input (HI-2) and, where it touches owned resources, verifies the session
 * (HI-14). All backend responses are normalized to camelCase before crossing
 * back to the client (ME-2).
 */

import { cookies } from "next/headers";

import { apiRequest } from "@/lib/dal/httpClient";
import { getAvailability } from "@/lib/dal/availability";
import { getBooking } from "@/lib/dal/bookings";
import { getWallet } from "@/lib/dal/wallet";
import { verifySession } from "@/lib/dal/session";
import { runCheckout, confirmHeldBooking } from "@/lib/services/checkout";
import {
  normalizePricePreviewResponse,
  normalizeHoldResponse,
  normalizePaymentInitiationResponse,
} from "@/lib/normalizers";
import { bookingSelectionSchema } from "@/lib/schemas";
import { ok, fail } from "@/lib/actions/result";
import { COOKIE_NAMES } from "@/config/auth.config";

async function readTokens() {
  const store = await cookies();
  return {
    accessToken: store.get(COOKIE_NAMES.ACCESS_TOKEN)?.value || "",
    refreshToken: store.get(COOKIE_NAMES.REFRESH_TOKEN)?.value || "",
  };
}

/**
 * Availability for a venue/date. A thin, client-callable wrapper over the DAL
 * read so the client date picker can refresh without a full navigation (the
 * initial date is server-rendered; only user-driven date changes call this).
 */
export async function getAvailabilityAction(venueId, date) {
  try {
    const data = await getAvailability({ venueId, date });
    return ok(data);
  } catch (error) {
    return fail(error, { message: "Could not load availability." });
  }
}

/**
 * Client-callable booking status read for the payment poll. Delegates to the
 * ownership-checked DAL read; returns only what the poll needs.
 *
 * @returns {Promise<{ ok: true, data: { status: string, payments: object[] } } | { ok: false, error: object }>}
 */
export async function getBookingStatusAction(bookingId) {
  try {
    const booking = await getBooking(bookingId);
    if (!booking) {
      return fail(null, { code: "not_found", status: 404, message: "Booking not found." });
    }
    return ok({ status: booking.status, payments: booking.payments || [] });
  } catch (error) {
    return fail(error);
  }
}

/**
 * The signed-in user's wallet balance, for the checkout summary's wallet-credit
 * preview. Client-callable so the book page can refresh the balance after an
 * in-modal sign-in (the server-rendered balance is 0 for anonymous page loads).
 * Returns 0 when unauthenticated rather than erroring — the summary just omits
 * the wallet line.
 *
 * @returns {Promise<{ ok: true, data: { balance: number } } | { ok: false, error: object }>}
 */
export async function getWalletBalanceAction() {
  try {
    const session = await verifySession();
    if (!session?.user) return ok({ balance: 0 });
    const wallet = await getWallet();
    return ok({ balance: wallet.balance });
  } catch (error) {
    return fail(error, { message: "Could not load wallet balance." });
  }
}

/** Server-authoritative price preview for a validated selection. */
export async function previewBookingPriceAction(selection) {
  const parsed = bookingSelectionSchema.safeParse(selection);
  if (!parsed.success) {
    return fail(null, { code: "bad_request", message: "Complete a valid court and time selection." });
  }
  try {
    const { payload } = await apiRequest("/api/v1/bookings/price-preview", {
      method: "POST",
      body: parsed.data,
    });
    return ok(normalizePricePreviewResponse(payload.data));
  } catch (error) {
    // Surface the backend's own 4xx explanation (e.g. "Slot 10:00 is not
    // available") — masking it as a generic pricing failure hides the cause.
    const message = error?.status && error.status < 500 && error.message
      ? error.message
      : "Could not calculate price.";
    return fail(error, { message });
  }
}

/**
 * Maps a hold-time ApiError to a user-facing message keyed on its stable code
 * (ME-1) — the backend's holds have three interesting failure modes the checkout
 * UI treats differently from a generic error.
 */
function holdErrorMessage(error) {
  switch (error?.code) {
    case "conflict":
      return "Some of your selected slots were just taken. Please pick a different time.";
    case "rate_limited":
      return "You already have active booking holds. Complete or wait for them to expire before starting another.";
    case "gone":
      return "This booking hold has expired. Please reselect your slots.";
    default:
      return error?.message || "Could not reserve your slots. Please try again.";
  }
}

/**
 * The checkout commit (HI-13, commit-on-confirm): reserves the slots and runs
 * waiver → initiate-payment in one server pass when the user clicks the final
 * Confirm & Pay button. Nothing is reserved before this call, so abandoning the
 * review step leaves no server-side state. Returns a discriminated result the
 * client acts on; `expiresAt` (on success) starts the 10-minute payment window.
 *
 * @returns {Promise<{kind:"confirmed"|"redirect"|"conflict"|"error", ...}>}
 */
export async function checkoutBookingAction(selection, { useWalletCredits = true } = {}) {
  const parsed = bookingSelectionSchema.safeParse(selection);
  if (!parsed.success) {
    return { kind: "error", code: "bad_request", message: "Complete a valid court and time selection." };
  }

  const session = await verifySession();
  if (!session?.user) {
    return { kind: "error", code: "unauthorized", message: "Please sign in to complete your booking." };
  }

  const tokens = await readTokens();
  const request = (path, opts) => apiRequest(path, { ...tokens, retryOnUnauthorized: true, ...opts });

  try {
    return await runCheckout(
      {
        createHold: async (body) => {
          const { payload } = await request("/api/v1/bookings/hold", { method: "POST", body });
          return normalizeHoldResponse(payload.data);
        },
        acceptWaiver: async (bookingId) => {
          await request(`/api/v1/bookings/${bookingId}/waiver`, {
            method: "POST",
            body: { time_acknowledged: true, policy_accepted: true },
          });
        },
        initiatePayment: async (bookingId, { useWalletCredits: useCredits }) => {
          const { payload } = await request(`/api/v1/bookings/${bookingId}/initiate-payment`, {
            method: "POST",
            body: { use_wallet_credits: useCredits },
          });
          return normalizePaymentInitiationResponse(payload.data);
        },
      },
      { selection: parsed.data, useWalletCredits },
    );
  } catch (error) {
    // Slot contention at commit time — the client refreshes the grid so the
    // user reselects against current truth.
    if (error?.code === "conflict") {
      return { kind: "conflict", message: holdErrorMessage(error) };
    }
    if (error?.code === "rate_limited") {
      return { kind: "error", code: "hold_limit", message: holdErrorMessage(error) };
    }
    return { kind: "error", code: error?.code || "api_error", message: error?.message || "Could not complete booking." };
  }
}

/**
 * Step 2 of checkout: completes an already-held booking (waiver → initiate-payment)
 * when the user clicks Pay. Returns a discriminated result the client acts on
 * (HI-13). A 410 means the hold expired before the user paid — the client
 * releases its local state and returns to the grid.
 *
 * @returns {Promise<{kind:"confirmed"|"redirect"|"error", ...}>}
 */
export async function confirmHeldBookingAction(bookingId, { useWalletCredits = true } = {}) {
  if (!bookingId) {
    return { kind: "error", code: "bad_request", message: "Missing booking reference." };
  }

  const session = await verifySession();
  if (!session?.user) {
    return { kind: "error", code: "unauthorized", message: "Please sign in to complete your booking." };
  }

  const tokens = await readTokens();
  const request = (path, opts) => apiRequest(path, { ...tokens, retryOnUnauthorized: true, ...opts });

  try {
    return await confirmHeldBooking(
      {
        acceptWaiver: async (id) => {
          await request(`/api/v1/bookings/${id}/waiver`, {
            method: "POST",
            body: { time_acknowledged: true, policy_accepted: true },
          });
        },
        initiatePayment: async (id, { useWalletCredits: useCredits }) => {
          const { payload } = await request(`/api/v1/bookings/${id}/initiate-payment`, {
            method: "POST",
            body: { use_wallet_credits: useCredits },
          });
          return normalizePaymentInitiationResponse(payload.data);
        },
      },
      { bookingId, useWalletCredits },
    );
  } catch (error) {
    if (error?.code === "gone") {
      return { kind: "error", code: "hold_expired", message: "Your booking hold expired before payment. Please reselect your slots." };
    }
    return { kind: "error", code: error?.code || "api_error", message: error?.message || "Could not complete booking." };
  }
}

/**
 * Re-initiates payment on an EXISTING pending booking (the "Try Again" path after
 * a failed gateway payment). No new hold is created — the slot hold is still valid
 * within its TTL. Returns the same discriminated result as checkout.
 *
 * @returns {Promise<{kind:"confirmed"|"redirect"|"error", ...}>}
 */
export async function retryPaymentAction(bookingId, { useWalletCredits = true } = {}) {
  if (!bookingId) {
    return { kind: "error", code: "bad_request", message: "Missing booking reference." };
  }

  const session = await verifySession();
  if (!session?.user) {
    return { kind: "error", code: "unauthorized", message: "Please sign in to retry payment." };
  }

  const tokens = await readTokens();
  try {
    const { payload } = await apiRequest(`/api/v1/bookings/${bookingId}/initiate-payment`, {
      method: "POST",
      body: { use_wallet_credits: useWalletCredits },
      ...tokens,
      retryOnUnauthorized: true,
    });
    const payment = normalizePaymentInitiationResponse(payload.data);

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
    return { kind: "error", code: "payment_init_failed", message: "Payment could not be initiated. Please try again." };
  } catch (error) {
    return { kind: "error", code: error?.code || "api_error", message: error?.message || "Could not restart the payment." };
  }
}
