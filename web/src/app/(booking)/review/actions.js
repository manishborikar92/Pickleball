"use server";

import { apiRequest } from "@/lib/apiClient";
import { getSession } from "@/lib/session";

export async function submitReview(bookingId, reviewData) {
  const session = await getSession();

  if (!session?.accessToken) {
    return {
      success: false,
      error: "You must be logged in to submit a review"
    };
  }

  try {
    const { payload } = await apiRequest("/api/v1/reviews", {
      method: "POST",
      body: { booking_id: bookingId, ...reviewData },
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });

    return { success: true, data: payload.data };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to submit review"
    };
  }
}

export async function getVenueReviews(venueId, { page = 1, limit = 10 } = {}) {
  try {
    const { payload } = await apiRequest(
      `/api/v1/reviews?venue_id=${venueId}&page=${page}&limit=${limit}`,
      { method: "GET" }
    );

    return {
      success: true,
      data: payload.data,
      meta: payload.meta,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to load reviews"
    };
  }
}
