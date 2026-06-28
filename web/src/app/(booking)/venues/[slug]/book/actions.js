"use server";

import { cookies } from "next/headers";

import { apiRequest } from "@/lib/apiClient";
import {
  normalizeAvailabilityResponse,
  normalizePricePreviewResponse,
  normalizeUserBookingsResponse,
  normalizeVenueResponse,
  normalizeWalletResponse,
  normalizeBookingDetailResponse,
} from "@/lib/normalizers";

import { COOKIE_NAMES } from "@/lib/cookies";

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value || "";
}

export async function getVenueBySlugAction(slug) {
  try {
    const { payload } = await apiRequest(`/api/v1/venues/slug/${slug}`);
    return { success: true, data: normalizeVenueResponse(payload.data) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getVenueAvailabilityAction(venueId, date) {
  try {
    const { payload } = await apiRequest(`/api/v1/venues/${venueId}/availability?date=${date}`);
    return { success: true, data: normalizeAvailabilityResponse(payload.data) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function previewBookingPriceAction(input) {
  try {
    const { payload } = await apiRequest("/api/v1/bookings/price-preview", {
      method: "POST",
      body: input,
    });
    return { success: true, data: normalizePricePreviewResponse(payload.data) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function createBookingHoldAction(input) {
  try {
    const accessToken = await getAccessToken();
    const { payload } = await apiRequest("/api/v1/bookings/hold", {
      method: "POST",
      body: input,
      accessToken,
    });
    return { success: true, data: payload.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function acceptBookingWaiverAction(bookingId) {
  try {
    const accessToken = await getAccessToken();
    const { payload } = await apiRequest(`/api/v1/bookings/${bookingId}/waiver`, {
      method: "POST",
      body: {
        time_acknowledged: true,
        policy_accepted: true,
      },
      accessToken,
    });
    return { success: true, data: payload.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function initiateBookingPaymentAction(bookingId, { useWalletCredits = true } = {}) {
  try {
    const accessToken = await getAccessToken();
    const { payload } = await apiRequest(`/api/v1/bookings/${bookingId}/initiate-payment`, {
      method: "POST",
      body: {
        use_wallet_credits: useWalletCredits,
      },
      accessToken,
    });
    return { success: true, data: payload.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getUserBookingsAction() {
  try {
    const accessToken = await getAccessToken();
    const { payload } = await apiRequest("/api/v1/users/me/bookings", {
      accessToken,
    });
    return { success: true, data: normalizeUserBookingsResponse(payload.data) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getWalletAction() {
  try {
    const accessToken = await getAccessToken();
    const { payload } = await apiRequest("/api/v1/users/me/wallet", {
      accessToken,
    });
    return { success: true, data: normalizeWalletResponse(payload.data) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getPaymentStatusAction(orderId) {
  try {
    const accessToken = await getAccessToken();
    const { payload } = await apiRequest(`/api/v1/payments/status/${orderId}`, {
      accessToken,
    });
    return { success: true, data: payload.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getBookingByIdAction(bookingId) {
  try {
    const accessToken = await getAccessToken();
    const { payload } = await apiRequest(`/api/v1/bookings/${bookingId}`, {
      accessToken,
    });
    return { success: true, data: normalizeBookingDetailResponse(payload.data) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

