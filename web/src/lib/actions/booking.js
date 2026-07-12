"use server";

/**
 * lib/actions/booking.js — Booking mutation actions (route-independent, ADR-W009).
 *
 * The multi-step checkout transaction now lives on the server (HI-13): the client
 * calls `checkoutBookingAction` once and only navigates on the discriminated
 * result. Every action validates its input (HI-2) and, where it touches owned
 * resources, verifies the session (HI-14). All backend responses are normalized
 * to camelCase before crossing back to the client (ME-2).
 */

import { cookies } from "next/headers";

import { apiRequest } from "@/lib/dal/httpClient";
import { getAvailability } from "@/lib/dal/availability";
import { getBooking } from "@/lib/dal/bookings";
import { verifySession } from "@/lib/dal/session";
import { runCheckout } from "@/lib/services/checkout";
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
    return fail(error, { message: "Could not calculate price." });
  }
}

/**
 * Runs the full checkout transaction (hold → waiver → initiate-payment) on the
 * server and returns a discriminated result the client acts on (HI-13).
 *
 * @returns {Promise<{kind:"confirmed"|"redirect"|"error", ...}>}
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
