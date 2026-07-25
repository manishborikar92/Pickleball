"use server";

/**
 * lib/actions/review.js — Review mutation action (route-independent, ADR-W009).
 *
 * Validates authoritatively with the shared `reviewSchema` (HI-2), gates on a
 * real session (CR-3), forwards only whitelisted fields, and revalidates the
 * venue's cached reviews list on success (ADR-W004). Failures keep their typed
 * `code`/`status` so the form can branch (conflict → already-reviewed state,
 * unauthorized → sign-in prompt) instead of matching message strings (ME-1).
 */

import { cookies } from "next/headers";
import { revalidateTag } from "next/cache";

import { apiRequest } from "@/lib/dal/httpClient";
import { verifySession } from "@/lib/dal/session";
import { reviewsTag } from "@/lib/dal/reviews";
import { normalizeReviewResponse } from "@/lib/normalizers";
import { reviewSchema } from "@/lib/schemas";
import { ok, fail } from "@/lib/actions/result";
import { COOKIE_NAMES } from "@/config/auth.config";

export async function submitReview(bookingId, reviewData) {
  const session = await verifySession();
  if (!session?.user) {
    return fail(null, {
      code: "unauthorized",
      status: 401,
      message: "Your session has expired. Please sign in to submit your review.",
    });
  }

  const parsed = reviewSchema.safeParse(reviewData);
  if (!parsed.success) {
    return fail(null, { code: "bad_request", message: parsed.error.issues[0]?.message });
  }

  try {
    // Both tokens are required: the refresh token is what lets
    // `retryOnUnauthorized` recover from a mid-session access-token expiry (HI-9).
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value || "";
    const refreshToken = cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN)?.value || "";

    const { payload } = await apiRequest("/api/v1/reviews", {
      method: "POST",
      body: {
        booking_id: bookingId,
        rating: parsed.data.rating,
        ...(parsed.data.comment ? { comment: parsed.data.comment } : {}),
      },
      accessToken,
      refreshToken,
      retryOnUnauthorized: true,
    });

    const venueId = payload.data?.venue_id;
    if (venueId) {
      revalidateTag(reviewsTag(venueId), "max");
    }

    return ok(normalizeReviewResponse(payload.data));
  } catch (error) {
    if (error?.code === "conflict") {
      return fail(error, { message: "A review has already been submitted for this booking." });
    }
    if (error?.code === "unauthorized") {
      return fail(error, { message: "Your session has expired. Please sign in to submit your review." });
    }
    // 400s carry an actionable backend message (e.g. booking not completed);
    // anything else gets a generic retry prompt.
    if (error?.code === "bad_request") {
      return fail(error);
    }
    return fail(error, { message: "We couldn't submit your review. Please try again." });
  }
}
