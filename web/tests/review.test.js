import assert from "node:assert/strict";
import test from "node:test";

import { resolveReviewResult } from "../src/lib/services/reviewStatus.js";
import { normalizeReviewResponse } from "../src/lib/normalizers.js";

const session = { user: { id: "u-1", name: "Asha", phone: "+919876543210" } };

const completedBooking = {
  id: "b-1",
  userId: "u-1",
  status: "completed",
  courtNames: ["Court 1", "Court 2"],
  venueName: "Besa, Nagpur",
  venue: { brandName: "Baseline Arena", name: "Besa, Nagpur" },
  slotDate: "2026-07-10",
  sessionStartTime: "09:00",
  sessionEndTime: "10:00",
};

const review = {
  id: "r-1",
  bookingId: "b-1",
  venueId: "v-1",
  rating: 5,
  comment: "Great surface",
  createdAt: "2026-07-11T08:00:00.000Z",
};

const deps = ({ booking = completedBooking, myReview = null, bookingError, reviewError } = {}) => ({
  getBooking: async () => {
    if (bookingError) throw bookingError;
    return booking;
  },
  getMyReview: async () => {
    if (reviewError) throw reviewError;
    return myReview;
  },
});

const typedError = (code, message = code) => {
  const err = new Error(message);
  err.code = code;
  return err;
};

test("resolveReviewResult gates unauthenticated visitors before any data access", async () => {
  const res = await resolveReviewResult("b-1", null, deps());
  assert.equal(res.status, "unauthorized");
  assert.equal(res.booking, null);

  const res2 = await resolveReviewResult("b-1", { user: null }, deps());
  assert.equal(res2.status, "unauthorized");
});

test("resolveReviewResult renders the form only for a completed, unreviewed, owned booking", async () => {
  const res = await resolveReviewResult("b-1", session, deps());
  assert.equal(res.status, "form");
  assert.equal(res.booking.id, "b-1");
  assert.equal(res.review, null);
});

test("resolveReviewResult surfaces an existing review as already_reviewed", async () => {
  const res = await resolveReviewResult("b-1", session, deps({ myReview: review }));
  assert.equal(res.status, "already_reviewed");
  assert.equal(res.review.rating, 5);
  assert.equal(res.booking.id, "b-1");
});

test("resolveReviewResult blocks upcoming sessions as not_completed without a review lookup", async () => {
  let reviewLookups = 0;
  for (const status of ["pending_payment", "confirmed", "walk_in"]) {
    const res = await resolveReviewResult("b-1", session, {
      getBooking: async () => ({ ...completedBooking, status }),
      getMyReview: async () => {
        reviewLookups += 1;
        return null;
      },
    });
    assert.equal(res.status, "not_completed");
    assert.equal(res.booking.status, status);
  }
  assert.equal(reviewLookups, 0);
});

test("resolveReviewResult marks cancelled/expired bookings as not_reviewable", async () => {
  for (const status of ["cancelled", "expired"]) {
    const res = await resolveReviewResult("b-1", session, deps({ booking: { ...completedBooking, status } }));
    assert.equal(res.status, "not_reviewable");
  }
});

test("resolveReviewResult denies non-owners even when the booking read succeeds (CR-2)", async () => {
  const res = await resolveReviewResult("b-1", session, deps({ booking: { ...completedBooking, userId: "u-2" } }));
  assert.equal(res.status, "forbidden");
  assert.equal(res.booking, null);
});

test("resolveReviewResult maps typed read errors to view states (ME-1)", async () => {
  const notFound = await resolveReviewResult("b-1", session, deps({ bookingError: typedError("not_found") }));
  assert.equal(notFound.status, "not_found");

  // A malformed bookingId fails backend param validation with 400 — the user
  // just sees "not found", not a raw API failure.
  const badRequest = await resolveReviewResult("junk", session, deps({ bookingError: typedError("bad_request") }));
  assert.equal(badRequest.status, "not_found");

  const forbidden = await resolveReviewResult("b-1", session, deps({ bookingError: typedError("forbidden") }));
  assert.equal(forbidden.status, "forbidden");

  const unauthorized = await resolveReviewResult("b-1", session, deps({ bookingError: typedError("unauthorized") }));
  assert.equal(unauthorized.status, "unauthorized");

  const failure = await resolveReviewResult("b-1", session, deps({ bookingError: new Error("boom") }));
  assert.equal(failure.status, "error");
  assert.equal(failure.message, "boom");
});

test("resolveReviewResult treats a failing review lookup as an error, not an open form", async () => {
  const res = await resolveReviewResult("b-1", session, deps({ reviewError: new Error("reviews api down") }));
  assert.equal(res.status, "error");
});

test("resolveReviewResult resolves a missing booking to not_found", async () => {
  const res = await resolveReviewResult("b-1", session, deps({ booking: null }));
  assert.equal(res.status, "not_found");
});

test("normalizeReviewResponse maps snake_case review fields to camelCase (ME-2)", () => {
  assert.deepEqual(
    normalizeReviewResponse({
      id: "r-1",
      booking_id: "b-1",
      venue_id: "v-1",
      rating: 4,
      comment: "Nice",
      created_at: "2026-07-11T08:00:00.000Z",
    }),
    {
      id: "r-1",
      bookingId: "b-1",
      venueId: "v-1",
      rating: 4,
      comment: "Nice",
      createdAt: "2026-07-11T08:00:00.000Z",
    },
  );

  assert.equal(normalizeReviewResponse(null), null);
  assert.equal(normalizeReviewResponse(undefined), null);
  assert.deepEqual(normalizeReviewResponse({ id: "r-2", rating: "3" }).rating, 3);
});
