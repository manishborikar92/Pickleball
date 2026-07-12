"use server";

/**
 * lib/actions/review.js — Review mutation action (route-independent, ADR-W009).
 *
 * Validates authoritatively with the shared `reviewSchema` (HI-2), gates on a
 * real session (CR-3), forwards only whitelisted fields, and revalidates the
 * venue's cached reviews list on success (ADR-W004).
 */

import { cookies } from "next/headers";
import { revalidateTag } from "next/cache";

import { apiRequest } from "@/lib/dal/httpClient";
import { verifySession } from "@/lib/dal/session";
import { reviewsTag } from "@/lib/dal/reviews";
import { reviewSchema } from "@/lib/schemas";
import { ok, fail } from "@/lib/actions/result";
import { COOKIE_NAMES } from "@/config/auth.config";

export async function submitReview(bookingId, reviewData) {
  const session = await verifySession();
  if (!session?.user) {
    return fail(null, { code: "unauthorized", message: "You must be logged in to submit a review." });
  }

  const parsed = reviewSchema.safeParse(reviewData);
  if (!parsed.success) {
    return fail(null, { code: "bad_request", message: parsed.error.issues[0]?.message });
  }

  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value || "";

    const { payload } = await apiRequest("/api/v1/reviews", {
      method: "POST",
      body: {
        booking_id: bookingId,
        rating: parsed.data.rating,
        ...(parsed.data.comment ? { comment: parsed.data.comment } : {}),
      },
      accessToken,
      retryOnUnauthorized: true,
    });

    const venueId = payload.data?.venue_id;
    if (venueId) {
      revalidateTag(reviewsTag(venueId));
    }

    return ok(payload.data);
  } catch (error) {
    return fail(error, { message: "Failed to submit review." });
  }
}
