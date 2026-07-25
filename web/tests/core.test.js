import assert from "node:assert/strict";
import test from "node:test";

import {
  getRolePermissions,
  hasPermission,
  canAccessRoute,
  routeAccess,
} from "../src/lib/rbac.js";
import { safeNext } from "../src/lib/safeNext.js";
import {
  nameSchema,
  phoneSchema,
  otpSchema,
  reviewSchema,
  couponSchema,
} from "../src/lib/schemas/index.js";
import {
  buildDateWindow,
  formatCountdown,
  getPaymentReceiptDetails,
  getCheckoutBreakdown,
  getRemainingSeconds,
  getSharedAvailableSlotTimes,
  reduceSlotClick,
  summarizeCourtSlots,
  getLatestPayment,
} from "../src/lib/bookingEngine.js";
import {
  buildBookingSelectionPayload,
  normalizeAvailabilityResponse,
  normalizePricePreviewResponse,
  normalizeBooking,
  normalizeBookingDetailResponse,
  normalizeHoldResponse,
  normalizePaymentInitiationResponse,
  normalizePaymentVerifyResponse,
} from "../src/lib/normalizers.js";
import { createBookingHold, confirmHeldBooking, runCheckout } from "../src/lib/services/checkout.js";
import { isLikelyMerchantOrderId, resolvePaymentRedirectPath } from "../src/lib/services/paymentRedirect.js";

test("role permissions are permission-key based and expandable", () => {
  assert.equal(hasPermission("manager", "edit_pricing"), true);
  assert.equal(hasPermission("staff", "edit_pricing"), false);
  assert.equal(hasPermission("customer", "view_own_bookings"), true);
  assert.deepEqual(getRolePermissions("unknown"), []);
});

test("route access uses centralized permissions rather than hardcoded roles", () => {
  assert.equal(canAccessRoute("/admin/pricing", "manager"), true);
  assert.equal(canAccessRoute("/admin/pricing", "staff"), false);
  assert.equal(canAccessRoute("/dashboard", "customer"), true);
  assert.equal(routeAccess["/admin/pricing"].permission, "edit_pricing");
});

test("canAccessRoute fails closed for unmapped protected paths (CR-1)", () => {
  // Unmapped admin/dashboard sub-routes must DENY, never silently allow.
  assert.equal(canAccessRoute("/admin/settings", "staff"), false);
  assert.equal(canAccessRoute("/admin/unknown", "super_admin"), false);
  assert.equal(canAccessRoute("/admin/unknown", "manager"), false);
  assert.equal(canAccessRoute("/dashboard/secret", "customer"), false);
  // A staff user is denied the fine-grained admin surfaces (the CR-1 regression).
  assert.equal(canAccessRoute("/admin/settings", "manager"), false);
  assert.equal(canAccessRoute("/admin/settings", "super_admin"), true);
  // Public (non-protected) routes remain open.
  assert.equal(canAccessRoute("/about", "customer"), true);
  assert.equal(canAccessRoute("/venues/besa-nagpur/book", null), true);
});

test("safeNext rejects open-redirect payloads (HI-8)", () => {
  assert.equal(safeNext("/dashboard/overview"), "/dashboard/overview");
  assert.equal(safeNext("//evil.com", "/admin/overview"), "/admin/overview");
  assert.equal(safeNext("/\\evil.com", "/admin/overview"), "/admin/overview");
  assert.equal(safeNext("https://evil.com", "/admin/overview"), "/admin/overview");
  assert.equal(safeNext("", "/fallback"), "/fallback");
  assert.equal(safeNext(null, "/fallback"), "/fallback");
  assert.equal(safeNext(undefined), "/");
});

test("shared schemas normalize customer auth inputs (ADR-W003)", () => {
  // Same normalized outputs the former validation.js produced — one source now.
  assert.equal(nameSchema.parse(" Asha  Mehta "), "Asha Mehta");
  assert.equal(phoneSchema.parse("98765 43210"), "+919876543210");
  assert.equal(phoneSchema.parse("919876543210"), "+919876543210");
  assert.equal(otpSchema.safeParse("12345").success, false);
  assert.equal(otpSchema.safeParse("123456").success, true);
  assert.equal(nameSchema.safeParse("A").success, false);
});

test("date window respects configured advance booking days", () => {
  const days = buildDateWindow({
    startDate: "2026-05-13",
    advanceBookingDays: 4,
  });

  assert.equal(days.length, 4);
  assert.equal(days[0].iso, "2026-05-13");
  assert.equal(days[3].iso, "2026-05-16");
});

test("booking API normalization maps server availability and price preview shapes", () => {
  const availability = normalizeAvailabilityResponse({
    date: "2026-06-18",
    slot_duration_mins: 60,
    courts: [{
      court_id: "court-1",
      court_name: "Court 1",
      environment: "outdoor",
      slots: [{ start_time: "09:00", end_time: "10:00", status: "available", unit_price: 500 }],
    }],
  });

  assert.equal(availability[0].courtId, "court-1");
  assert.equal(availability[0].slots[0].startTime, "09:00");
  assert.equal(availability[0].slots[0].price, 500);

  const quote = normalizePricePreviewResponse({
    price_breakdown: {
      units: [
        { court_id: "court-1", court_name: "Court 1", slot_start_time: "09:00", unit_price: 500 },
        { court_id: "court-1", court_name: "Court 1", slot_start_time: "10:00", unit_price: 500 },
      ],
      subtotal: 1000,
      coupon_discount: 50,
      tax: 0,
      total: 950,
    },
  });

  assert.equal(quote.totalAmount, 950);
  assert.equal(quote.discountAmount, 50);
  assert.deepEqual(quote.breakdown, [{ label: "Court 1", amount: 1000, slotCount: 2 }]);
});

test("booking selection payload requires courts to share one slot range", () => {
  const result = buildBookingSelectionPayload({
    venueId: "venue-1",
    selectedDate: "2026-06-18",
    selectedCourtsData: [
      {
        courtId: "court-1",
        slots: [
          { startTime: "09:00" },
          { startTime: "10:00" },
        ],
      },
      {
        courtId: "court-2",
        slots: [
          { startTime: "09:00" },
          { startTime: "10:00" },
        ],
      },
    ],
    couponCode: "first10",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value.slot_start_times, ["09:00", "10:00"]);
  assert.equal(result.value.coupon_code, "FIRST10");

  const mismatch = buildBookingSelectionPayload({
    venueId: "venue-1",
    selectedDate: "2026-06-18",
    selectedCourtsData: [
      { courtId: "court-1", slots: [{ startTime: "09:00" }] },
      { courtId: "court-2", slots: [{ startTime: "10:00" }] },
    ],
  });

  assert.equal(mismatch.ok, false);
});

test("reviewSchema requires a rating but keeps the comment optional", () => {
  assert.equal(reviewSchema.safeParse({ rating: 0 }).success, false);
  assert.deepEqual(reviewSchema.parse({ rating: 5, comment: " Great court " }), {
    rating: 5,
    comment: "Great court",
  });
  // Coerces string ratings from form data and defaults an absent comment to "".
  assert.deepEqual(reviewSchema.parse({ rating: "4" }), { rating: 4, comment: "" });
});

test("couponSchema is format-only before server preview applies it", () => {
  assert.equal(couponSchema.parse(" first50 "), "FIRST50");
  assert.equal(couponSchema.safeParse("bad coupon").success, false);
  assert.equal(couponSchema.safeParse("").success, false);
});

test("getLatestPayment returns the most recent payment by createdAt", () => {
  assert.equal(getLatestPayment(null), null);
  assert.equal(getLatestPayment({ payments: [] }), null);

  const booking = {
    payments: [
      { id: "p1", status: "failed", merchantOrderId: "PP-1", createdAt: "2026-06-29T10:00:00.000Z" },
      { id: "p2", status: "initiated", merchantOrderId: "PP-2", createdAt: "2026-06-29T10:05:00.000Z" },
    ],
  };
  // Latest by createdAt wins regardless of array order.
  assert.equal(getLatestPayment(booking).id, "p2");
  assert.equal(getLatestPayment({ payments: [...booking.payments].reverse() }).id, "p2");
});

test("getPaymentReceiptDetails correctly handles wallet-only checkouts", () => {
  const booking = {
    total_amount: 590,
    credits_applied: 590,
  };
  const result = getPaymentReceiptDetails(booking);
  assert.equal(result.isWalletOnly, true);
  assert.equal(result.isMixed, false);
  assert.equal(result.paymentModeLabel, "Payment Method: Wallet Credits");
  assert.equal(result.displayAmount, 590);
});

test("getPaymentReceiptDetails correctly handles UPI-only checkouts", () => {
  const booking = {
    total_amount: 590,
    credits_applied: 0,
  };
  const result = getPaymentReceiptDetails(booking);
  assert.equal(result.isWalletOnly, false);
  assert.equal(result.isMixed, false);
  assert.equal(result.paymentModeLabel, "Payment Method: UPI");
  assert.equal(result.displayAmount, 590);
});

test("getPaymentReceiptDetails correctly handles mixed Wallet + UPI checkouts", () => {
  const booking = {
    total_amount: 590,
    credits_applied: 100,
  };
  const result = getPaymentReceiptDetails(booking);
  assert.equal(result.isWalletOnly, false);
  assert.equal(result.isMixed, true);
  assert.equal(result.paymentModeLabel, "Payment Method: UPI + Wallet");
  assert.equal(result.upiAmount, 490);
  assert.equal(result.creditsApplied, 100);
});

test("normalizeBooking maps summary list fields and formats display values", () => {
  const rawBooking = {
    id: "booking-123",
    status: "confirmed",
    total_amount: "500.00",
    slot_date: "2026-06-18",
    slot_start_time: "09:00",
    slot_end_time: "10:00",
    court: { name: "Court A" },
    venue: { name: "Venue A" },
  };

  const normalized = normalizeBooking(rawBooking, { isDetail: false });
  assert.equal(normalized.id, "booking-123");
  assert.equal(normalized.status, "confirmed");
  assert.equal(normalized.amount, 500);
  assert.deepEqual(normalized.courtNames, ["Court A"]);
  assert.equal(normalized.venueName, "Venue A");
  assert.equal(normalized.date, "2026-06-18");
  assert.equal(normalized.time, "09:00 - 10:00");
});

test("normalizeBookingDetailResponse enriches venue configuration and parses decimals", () => {
  const rawBooking = {
    id: "booking-123",
    status: "confirmed",
    total_amount: "500.00",
    credits_applied: "100.00",
    slot_date: "2026-06-18",
    session_start_time: "09:00",
    session_end_time: "10:00",
    venue: {
      id: "venue-besa",
      name: "Besa, Nagpur",
      slug: "besa-nagpur",
      address: "Besa Road",
    },
    slots: [
      {
        id: "slot-1",
        slot_date: "2026-06-18",
        slot_start_time: "09:00",
        slot_end_time: "10:00",
        unit_price: "250.00",
      }
    ],
    payments: [
      {
        id: "pay-1",
        amount: "400.00",
        status: "success",
      }
    ]
  };

  const detailed = normalizeBookingDetailResponse(rawBooking);
  assert.equal(detailed.id, "booking-123");
  assert.equal(detailed.totalAmount, 500);
  assert.equal(detailed.creditsApplied, 100);
  
  // Verify configuration enrichment
  assert.equal(detailed.venue.brandName, "Baseline Arena"); // From config
  assert.equal(detailed.venue.address, "Besa Road"); // From DB
  assert.equal(detailed.venue.googleMapsLink, "https://maps.app.goo.gl/18jsuTs2SrhpvGnz8"); // From config
  assert.deepEqual(detailed.venue.location, { lat: 21.085109, lng: 79.085931 }); // From config

  // Verify coordinates are overridden if present in database (for future schema additions)
  const rawBookingWithCoords = {
    ...rawBooking,
    venue: {
      ...rawBooking.venue,
      latitude: 12.3456,
      longitude: 78.9012,
    }
  };
  const detailedWithCoords = normalizeBookingDetailResponse(rawBookingWithCoords);
  assert.deepEqual(detailedWithCoords.venue.location, { lat: 12.3456, lng: 78.9012 });

  // Verify slots mapping
  assert.equal(detailed.slots[0].id, "slot-1");
  assert.equal(detailed.slots[0].unitPrice, 250);

  // Verify payments mapping
  assert.equal(detailed.payments[0].id, "pay-1");
  assert.equal(detailed.payments[0].amount, 400);
});

test("normalizeBooking aggregates multiple courts for summary list payloads using court_names", () => {
  const rawSummaryBooking = {
    id: "booking-123",
    status: "confirmed",
    total_amount: 1500,
    slot_date: "2026-06-25",
    slot_start_time: "09:00",
    slot_end_time: "10:00",
    court_names: ["Court 1", "Court 2"],
    venue: { id: "venue-1", name: "Venue A", slug: "venue-a" },
  };

  const normalized = normalizeBooking(rawSummaryBooking, { isDetail: false });
  assert.deepEqual(normalized.courtNames, ["Court 1", "Court 2"]);
  // Summary rows surface the venue slug so the dashboard "Book Again" CTA can
  // link to /venues/{slug}/book.
  assert.equal(normalized.venueSlug, "venue-a");
});

test("normalizeBookingDetailResponse trusts court_names if present in detailed response", () => {
  const rawDetailBooking = {
    id: "booking-123",
    status: "confirmed",
    total_amount: 1500,
    slot_date: "2026-06-25",
    session_start_time: "09:00",
    session_end_time: "10:00",
    venue: { id: "venue-1", name: "Venue A" },
    court_names: ["Court 1", "Court 2"],
    slots: [
      { id: "s-1", court: { id: "c-2", name: "Court 2" } },
      { id: "s-2", court: { id: "c-1", name: "Court 1" } },
    ],
  };

  const normalized = normalizeBookingDetailResponse(rawDetailBooking);
  assert.deepEqual(normalized.courtNames, ["Court 1", "Court 2"]);
});

test("normalizeBookingDetailResponse falls back to extracting court names from slots without sorting if court_names is missing", () => {
  const rawDetailBooking = {
    id: "booking-123",
    status: "confirmed",
    total_amount: 1500,
    slot_date: "2026-06-25",
    session_start_time: "09:00",
    session_end_time: "10:00",
    venue: { id: "venue-1", name: "Venue A" },
    slots: [
      { id: "s-1", court: { id: "c-2", name: "Court 2" } },
      { id: "s-2", court: { id: "c-1", name: "Court 1" } },
    ],
  };

  const normalized = normalizeBookingDetailResponse(rawDetailBooking);
  assert.deepEqual(normalized.courtNames, ["Court 2", "Court 1"]);
});

test("resolveBookingResult resolves statuses and handles session validation", async () => {
  const { resolveBookingResult } = await import("../src/lib/services/bookingStatus.js");

  // 1. Unauthorized if session is empty
  const res1 = await resolveBookingResult("booking-123", null);
  assert.equal(res1.status, "unauthorized");


  // 2. Success state when status is confirmed
  const mockBooking = {
    id: "booking-123",
    status: "confirmed",
    totalAmount: 500,
    slotDate: "2026-06-29",
    sessionStartTime: "08:00",
    sessionEndTime: "09:00",
    venue: { id: "venue-besa", name: "Besa, Nagpur", slug: "besa-nagpur" },
    slots: [],
    payments: [],
  };
  const mockGetBooking = async () => mockBooking;

  const res3 = await resolveBookingResult("booking-123", { user: { id: "u-1" } }, { getBooking: mockGetBooking });
  assert.equal(res3.status, "success");
  assert.equal(res3.booking.id, "booking-123");
  assert.equal(res3.receipt.upiAmount, 500);

  // 4. Pending state when status is pending_payment and not expired
  const mockPendingBooking = {
    ...mockBooking,
    status: "pending_payment",
    expiresAt: new Date(Date.now() + 600000).toISOString(), // 10 minutes in future
  };
  const mockGetPending = async () => mockPendingBooking;
  const res4 = await resolveBookingResult("booking-123", { user: { id: "u-1" } }, { getBooking: mockGetPending });
  assert.equal(res4.status, "pending");

  // 5. Expired state when status is pending_payment and expired
  const mockExpiredBooking = {
    ...mockBooking,
    status: "pending_payment",
    expiresAt: new Date(Date.now() - 10000).toISOString(), // expired 10s ago
  };
  const mockGetExpired = async () => mockExpiredBooking;
  const res5 = await resolveBookingResult("booking-123", { user: { id: "u-1" } }, { getBooking: mockGetExpired });
  assert.equal(res5.status, "expired");

  // 6. Cancelled state
  const mockCancelledBooking = {
    ...mockBooking,
    status: "cancelled",
  };
  const mockGetCancelled = async () => mockCancelledBooking;
  const res6 = await resolveBookingResult("booking-123", { user: { id: "u-1" } }, { getBooking: mockGetCancelled });
  assert.equal(res6.status, "cancelled");

  // 7. Handles API failure mapping
  const mockGetFail = async () => {
    throw new Error("Booking not found");
  };
  const res7 = await resolveBookingResult("booking-123", { user: { id: "u-1" } }, { getBooking: mockGetFail });
  assert.equal(res7.status, "error");
  assert.equal(res7.errorType, "notFound");

  // 8. Failed state: pending_payment booking whose latest payment failed (hold not expired)
  const mockFailedPaymentBooking = {
    ...mockBooking,
    status: "pending_payment",
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    payments: [
      { id: "pay-1", status: "failed", createdAt: "2026-06-29T10:00:00.000Z" },
    ],
  };
  const mockGetFailedPayment = async () => mockFailedPaymentBooking;
  const res8 = await resolveBookingResult("booking-123", { user: { id: "u-1" } }, { getBooking: mockGetFailedPayment });
  assert.equal(res8.status, "failed");

  // 9. An older failed payment superseded by a newer initiated one → still pending
  const mockRetriedBooking = {
    ...mockBooking,
    status: "pending_payment",
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    payments: [
      { id: "pay-1", status: "failed", createdAt: "2026-06-29T10:00:00.000Z" },
      { id: "pay-2", status: "initiated", createdAt: "2026-06-29T10:05:00.000Z" },
    ],
  };
  const mockGetRetried = async () => mockRetriedBooking;
  const res9 = await resolveBookingResult("booking-123", { user: { id: "u-1" } }, { getBooking: mockGetRetried });
  assert.equal(res9.status, "pending");
});

test("resolveBookingResult branches on typed error.code, not message strings (ME-1)", async () => {
  const { resolveBookingResult } = await import("../src/lib/services/bookingStatus.js");
  const session = { user: { id: "u-1" } };

  // A forbidden ApiError (opaque message) must still map to "forbidden" via code.
  const forbidden = async () => { const e = new Error("Nope"); e.code = "forbidden"; throw e; };
  const rf = await resolveBookingResult("b", session, { getBooking: forbidden });
  assert.equal(rf.status, "forbidden");

  // A not_found code maps to the notFound error type regardless of message text.
  const missing = async () => { const e = new Error("gone"); e.code = "not_found"; throw e; };
  const rn = await resolveBookingResult("b", session, { getBooking: missing });
  assert.equal(rn.status, "error");
  assert.equal(rn.errorType, "notFound");

  // An unauthorized code maps to forbidden (the page shows a sign-in prompt).
  const unauth = async () => { const e = new Error("x"); e.code = "unauthorized"; throw e; };
  const ru = await resolveBookingResult("b", session, { getBooking: unauth });
  assert.equal(ru.status, "forbidden");
});


test("normalizeHoldResponse maps snake_case hold fields to camelCase (ME-2)", () => {
  const hold = normalizeHoldResponse({
    booking_id: "bk-1",
    status: "pending_payment",
    expires_at: "2026-06-29T10:10:00.000Z",
    court_count: 2,
    slot_unit_count: 4,
    session_start_time: "09:00",
    session_end_time: "11:00",
    session_duration_mins: 120,
  });
  assert.equal(hold.bookingId, "bk-1");
  assert.equal(hold.expiresAt, "2026-06-29T10:10:00.000Z");
  assert.equal(hold.courtCount, 2);
  assert.equal(hold.sessionDurationMins, 120);
});

test("normalizePaymentInitiationResponse discriminates confirmed vs redirect (ME-2/HI-13)", () => {
  assert.equal(normalizePaymentInitiationResponse({ type: "wallet_only", booking_id: "b" }).kind, "confirmed");
  assert.equal(normalizePaymentInitiationResponse({ type: "already_confirmed", booking_id: "b" }).kind, "confirmed");

  const redirect = normalizePaymentInitiationResponse({
    type: "phonepe",
    booking_id: "b",
    merchant_order_id: "PP-9",
    redirect_url: "https://mercury.phonepe.com/pay/xyz",
  });
  assert.equal(redirect.kind, "redirect");
  assert.equal(redirect.merchantOrderId, "PP-9");
  assert.equal(redirect.redirectUrl, "https://mercury.phonepe.com/pay/xyz");
});

test("createBookingHold resolves the normalized hold with bookingId and expiresAt (hold-first)", async () => {
  const calls = [];
  const hold = await createBookingHold(
    {
      createHold: async (sel) => {
        calls.push(["hold", sel]);
        return { bookingId: "bk-1", expiresAt: "2026-07-19T10:10:00.000Z", status: "pending_payment" };
      },
    },
    { selection: { venue_id: "v" } },
  );
  assert.equal(hold.bookingId, "bk-1");
  assert.equal(hold.expiresAt, "2026-07-19T10:10:00.000Z");
  assert.deepEqual(calls, [["hold", { venue_id: "v" }]]);
});

test("createBookingHold throws hold_failed when the hold has no bookingId", async () => {
  await assert.rejects(
    () => createBookingHold(
      { createHold: async () => ({ bookingId: null }) },
      { selection: {} },
    ),
    /Could not create booking hold/,
  );
});

test("createBookingHold throws hold_failed when expiresAt is missing or invalid", async () => {
  await assert.rejects(
    () => createBookingHold(
      { createHold: async () => ({ bookingId: "bk-1", expiresAt: "" }) },
      { selection: {} },
    ),
    /missing its expiry time/,
  );
  await assert.rejects(
    () => createBookingHold(
      { createHold: async () => ({ bookingId: "bk-1", expiresAt: "not-a-date" }) },
      { selection: {} },
    ),
    /missing its expiry time/,
  );
});

test("confirmHeldBooking returns a confirmed result for a wallet-only payment (HI-13)", async () => {
  const calls = [];
  const result = await confirmHeldBooking(
    {
      acceptWaiver: async (id) => { calls.push(["waiver", id]); },
      initiatePayment: async (id, opts) => { calls.push(["pay", id, opts]); return { kind: "confirmed" }; },
    },
    { bookingId: "bk-1", useWalletCredits: true },
  );
  assert.deepEqual(result, { kind: "confirmed", bookingId: "bk-1" });
  // Enforces the ordered sequence waiver → pay on the already-held booking.
  assert.deepEqual(calls, [["waiver", "bk-1"], ["pay", "bk-1", { useWalletCredits: true }]]);
});

test("confirmHeldBooking returns a redirect result for a gateway payment (HI-13)", async () => {
  const result = await confirmHeldBooking(
    {
      acceptWaiver: async () => {},
      initiatePayment: async () => ({ kind: "redirect", redirectUrl: "https://pay", merchantOrderId: "PP-2" }),
    },
    { bookingId: "bk-2" },
  );
  assert.equal(result.kind, "redirect");
  assert.equal(result.bookingId, "bk-2");
  assert.equal(result.redirectUrl, "https://pay");
  assert.equal(result.merchantOrderId, "PP-2");
});

test("confirmHeldBooking rejects without a bookingId and never calls the backend", async () => {
  let called = false;
  await assert.rejects(
    () => confirmHeldBooking(
      {
        acceptWaiver: async () => { called = true; },
        initiatePayment: async () => { called = true; },
      },
      { bookingId: "" },
    ),
    /Missing booking reference/,
  );
  assert.equal(called, false);
});

test("confirmHeldBooking throws payment_init_failed when initiation returns neither kind", async () => {
  await assert.rejects(
    () => confirmHeldBooking(
      {
        acceptWaiver: async () => {},
        initiatePayment: async () => ({ kind: "redirect", redirectUrl: "" }),
      },
      { bookingId: "bk-3" },
    ),
    /Payment could not be initiated/,
  );
});

test("runCheckout commits hold → waiver → pay in order and threads expiresAt (commit-on-confirm)", async () => {
  const calls = [];
  const result = await runCheckout(
    {
      createHold: async (sel) => {
        calls.push(["hold", sel]);
        return { bookingId: "bk-9", expiresAt: "2026-07-19T10:10:00.000Z" };
      },
      acceptWaiver: async (id) => { calls.push(["waiver", id]); },
      initiatePayment: async (id, opts) => {
        calls.push(["pay", id, opts]);
        return { kind: "redirect", redirectUrl: "https://pay", merchantOrderId: "PP-9" };
      },
    },
    { selection: { venue_id: "v" }, useWalletCredits: true },
  );
  assert.deepEqual(calls.map((c) => c[0]), ["hold", "waiver", "pay"]);
  assert.equal(result.kind, "redirect");
  assert.equal(result.bookingId, "bk-9");
  assert.equal(result.expiresAt, "2026-07-19T10:10:00.000Z"); // starts the payment-window countdown
  assert.equal(result.redirectUrl, "https://pay");
});

test("runCheckout returns a confirmed result with expiresAt for wallet-only payments", async () => {
  const result = await runCheckout(
    {
      createHold: async () => ({ bookingId: "bk-10", expiresAt: "2026-07-19T10:10:00.000Z" }),
      acceptWaiver: async () => {},
      initiatePayment: async () => ({ kind: "confirmed" }),
    },
    { selection: {} },
  );
  assert.equal(result.kind, "confirmed");
  assert.equal(result.bookingId, "bk-10");
  assert.equal(result.expiresAt, "2026-07-19T10:10:00.000Z");
});

test("runCheckout stops at a failed hold — waiver and payment are never called", async () => {
  const calls = [];
  await assert.rejects(
    () => runCheckout(
      {
        createHold: async () => ({ bookingId: null }),
        acceptWaiver: async () => { calls.push("waiver"); },
        initiatePayment: async () => { calls.push("pay"); },
      },
      { selection: {} },
    ),
    /Could not create booking hold/,
  );
  assert.deepEqual(calls, []);
});

test("getCheckoutBreakdown with no wallet leaves the full total payable via UPI", () => {
  const b = getCheckoutBreakdown({ subtotal: 500, discountAmount: 0, taxAmount: 0, totalAmount: 500 }, 0);
  assert.equal(b.walletApplied, 0);
  assert.equal(b.amountPayable, 500);
  assert.equal(b.hasAdjustments, false);
  assert.equal(b.isWalletOnly, false);
});

test("getCheckoutBreakdown applies a partial wallet credit against the total (UPI + wallet)", () => {
  const b = getCheckoutBreakdown({ subtotal: 500, discountAmount: 50, taxAmount: 0, totalAmount: 450 }, 200);
  assert.equal(b.discountAmount, 50);
  assert.equal(b.walletApplied, 200);
  assert.equal(b.amountPayable, 250);
  assert.equal(b.hasAdjustments, true);
  assert.equal(b.isWalletOnly, false);
});

test("getCheckoutBreakdown caps wallet at the order total and reports wallet-only (no UPI due)", () => {
  const b = getCheckoutBreakdown({ subtotal: 300, totalAmount: 300 }, 1000);
  assert.equal(b.walletApplied, 300);   // capped at total, never credits the surplus
  assert.equal(b.amountPayable, 0);
  assert.equal(b.isWalletOnly, true);
});

test("summarizeCourtSlots derives the session window, duration, and summed price", () => {
  const s = summarizeCourtSlots([
    { startTime: "09:00", endTime: "10:00", price: 250 },
    { startTime: "10:00", endTime: "11:00", price: "250" }, // string price coerced
  ]);
  assert.equal(s.startTime, "09:00");
  assert.equal(s.endTime, "11:00");
  assert.equal(s.slotCount, 2);
  assert.equal(s.durationMins, 120);
  assert.equal(s.courtTotal, 500);
});

test("summarizeCourtSlots is safe for an empty selection", () => {
  const s = summarizeCourtSlots([]);
  assert.equal(s.slotCount, 0);
  assert.equal(s.durationMins, 0);
  assert.equal(s.courtTotal, 0);
  assert.equal(s.startTime, undefined);
});

/* ── Multi-court selection model (02-BUSINESS-LOGIC §5.1) ─────────────── */

const slot = (startTime, endTime, status = "available") => ({ startTime, endTime, status, price: 500 });

const twoCourtAvailability = () => ([
  {
    courtId: "c1",
    courtName: "Court 1",
    slots: [slot("09:00", "10:00"), slot("10:00", "11:00"), slot("11:00", "12:00"), slot("12:00", "13:00")],
  },
  {
    courtId: "c2",
    courtName: "Court 2",
    slots: [slot("09:00", "10:00", "booked"), slot("10:00", "11:00"), slot("11:00", "12:00"), slot("12:00", "13:00", "pending")],
  },
]);

test("getSharedAvailableSlotTimes intersects availability across all courts", () => {
  const shared = getSharedAvailableSlotTimes(twoCourtAvailability(), ["c1", "c2"]);
  // 09:00 booked on c2, 12:00 pending on c2 → only 10:00 and 11:00 are shared.
  assert.deepEqual([...shared].sort(), ["10:00", "11:00"]);
});

test("getSharedAvailableSlotTimes is empty for fewer than two courts", () => {
  assert.equal(getSharedAvailableSlotTimes(twoCourtAvailability(), ["c1"]).size, 0);
  assert.equal(getSharedAvailableSlotTimes([], []).size, 0);
});

test("reduceSlotClick starts a selection on the first available click", () => {
  const { selections, notice } = reduceSlotClick({
    selections: new Map(),
    availabilityData: twoCourtAvailability(),
    courtId: "c1",
    slot: slot("10:00", "11:00"),
  });
  assert.equal(notice, null);
  assert.deepEqual(selections.get("c1"), { startTime: "10:00", endTime: "11:00" });
});

test("reduceSlotClick ignores unavailable slots without touching state", () => {
  const prev = new Map([["c1", { startTime: "10:00", endTime: "11:00" }]]);
  const { selections, notice } = reduceSlotClick({
    selections: prev,
    availabilityData: twoCourtAvailability(),
    courtId: "c2",
    slot: slot("09:00", "10:00", "booked"),
  });
  assert.equal(selections, prev); // same reference — no re-render cascade
  assert.equal(notice, null);
});

test("reduceSlotClick extends the shared range on all selected courts (mirroring)", () => {
  const prev = new Map([
    ["c1", { startTime: "10:00", endTime: "11:00" }],
    ["c2", { startTime: "10:00", endTime: "11:00" }],
  ]);
  const { selections, notice } = reduceSlotClick({
    selections: prev,
    availabilityData: twoCourtAvailability(),
    courtId: "c1",
    slot: slot("11:00", "12:00"),
  });
  assert.equal(notice, null);
  assert.deepEqual(selections.get("c1"), { startTime: "10:00", endTime: "12:00" });
  assert.deepEqual(selections.get("c2"), { startTime: "10:00", endTime: "12:00" });
});

test("reduceSlotClick refuses an extension when another selected court is not free (no asymmetry)", () => {
  const prev = new Map([
    ["c1", { startTime: "10:00", endTime: "12:00" }],
    ["c2", { startTime: "10:00", endTime: "12:00" }],
  ]);
  // 12:00 is pending on Court 2 → extending to 12:00–13:00 must be refused.
  const { selections, notice } = reduceSlotClick({
    selections: prev,
    availabilityData: twoCourtAvailability(),
    courtId: "c1",
    slot: slot("12:00", "13:00"),
  });
  assert.equal(selections, prev);
  assert.equal(notice.courtId, "c1");
  assert.match(notice.message, /Court 2 isn't free for 10:00–13:00/);
});

test("reduceSlotClick joins an unselected court by mirroring the shared range", () => {
  const prev = new Map([["c1", { startTime: "10:00", endTime: "12:00" }]]);
  const { selections, notice } = reduceSlotClick({
    selections: prev,
    availabilityData: twoCourtAvailability(),
    courtId: "c2",
    slot: slot("11:00", "12:00"),
  });
  assert.equal(notice, null);
  // Court 2 mirrors the FULL shared range, not just the clicked slot.
  assert.deepEqual(selections.get("c2"), { startTime: "10:00", endTime: "12:00" });
  assert.deepEqual(selections.get("c1"), { startTime: "10:00", endTime: "12:00" });
});

test("reduceSlotClick refuses joining a court that is not free for the whole shared range", () => {
  const prev = new Map([["c1", { startTime: "09:00", endTime: "11:00" }]]);
  // Court 2's 09:00 slot is booked → it cannot join the 09:00–11:00 session.
  const { selections, notice } = reduceSlotClick({
    selections: prev,
    availabilityData: twoCourtAvailability(),
    courtId: "c2",
    slot: slot("10:00", "11:00"),
  });
  assert.equal(selections, prev);
  assert.match(notice.message, /isn't free for the full 09:00–11:00 range/);
});

test("reduceSlotClick refuses an out-of-range click on an unselected court with guidance", () => {
  const prev = new Map([["c1", { startTime: "10:00", endTime: "11:00" }]]);
  const { selections, notice } = reduceSlotClick({
    selections: prev,
    availabilityData: twoCourtAvailability(),
    courtId: "c2",
    slot: slot("12:00", "13:00"),
  });
  assert.equal(selections, prev);
  assert.match(notice.message, /All courts share the same time range \(10:00–11:00\)/);
});

test("reduceSlotClick removes a court on an in-range click, clearing fully at the last court", () => {
  const both = new Map([
    ["c1", { startTime: "10:00", endTime: "11:00" }],
    ["c2", { startTime: "10:00", endTime: "11:00" }],
  ]);
  const afterFirst = reduceSlotClick({
    selections: both,
    availabilityData: twoCourtAvailability(),
    courtId: "c2",
    slot: slot("10:00", "11:00"),
  });
  assert.equal(afterFirst.selections.has("c2"), false);
  assert.deepEqual(afterFirst.selections.get("c1"), { startTime: "10:00", endTime: "11:00" });

  const afterSecond = reduceSlotClick({
    selections: afterFirst.selections,
    availabilityData: twoCourtAvailability(),
    courtId: "c1",
    slot: slot("10:00", "11:00"),
  });
  assert.equal(afterSecond.selections.size, 0);
});

test("reduceSlotClick jump-fills to a distant slot, selecting the intermediates automatically", () => {
  const prev = new Map([["c1", { startTime: "09:00", endTime: "10:00" }]]);
  // 09:00 selected, tap 12:00 → 09:00 through 13:00 with 10:00/11:00 auto-filled.
  const { selections, notice } = reduceSlotClick({
    selections: prev,
    availabilityData: twoCourtAvailability(),
    courtId: "c1",
    slot: slot("12:00", "13:00"),
  });
  assert.equal(notice, null);
  assert.deepEqual(selections.get("c1"), { startTime: "09:00", endTime: "13:00" });
});

test("reduceSlotClick jump-fills backwards from the range start", () => {
  const prev = new Map([["c1", { startTime: "12:00", endTime: "13:00" }]]);
  const { selections, notice } = reduceSlotClick({
    selections: prev,
    availabilityData: twoCourtAvailability(),
    courtId: "c1",
    slot: slot("09:00", "10:00"),
  });
  assert.equal(notice, null);
  assert.deepEqual(selections.get("c1"), { startTime: "09:00", endTime: "13:00" });
});

test("reduceSlotClick refuses a jump-fill that would span an unavailable slot (no gaps)", () => {
  const availabilityData = [
    {
      courtId: "c1",
      courtName: "Court 1",
      slots: [
        slot("09:00", "10:00"),
        slot("10:00", "11:00", "booked"), // hole in the middle
        slot("11:00", "12:00"),
      ],
    },
  ];
  const prev = new Map([["c1", { startTime: "09:00", endTime: "10:00" }]]);
  const { selections, notice } = reduceSlotClick({
    selections: prev,
    availabilityData,
    courtId: "c1",
    slot: slot("11:00", "12:00"),
  });
  assert.equal(selections, prev);
  assert.match(notice.message, /includes slots that aren't free on this court/);
});

test("reduceSlotClick caps a session at 12 slots with a clear notice", () => {
  const hour = (h) => `${String(h).padStart(2, "0")}:00`;
  const longDay = [{
    courtId: "c1",
    courtName: "Court 1",
    slots: Array.from({ length: 14 }, (_, i) => slot(hour(7 + i), hour(8 + i))),
  }];
  const prev = new Map([["c1", { startTime: "07:00", endTime: "08:00" }]]);
  // 07:00 → tap 19:00 would make 13 slots — one over the backend's cap of 12.
  const { selections, notice } = reduceSlotClick({
    selections: prev,
    availabilityData: longDay,
    courtId: "c1",
    slot: slot("19:00", "20:00"),
  });
  assert.equal(selections, prev);
  assert.match(notice.message, /up to 12 consecutive slots/);

  // Exactly 12 slots (07:00 → tap 18:00) is allowed.
  const ok = reduceSlotClick({
    selections: prev,
    availabilityData: longDay,
    courtId: "c1",
    slot: slot("18:00", "19:00"),
  });
  assert.equal(ok.notice, null);
  assert.deepEqual(ok.selections.get("c1"), { startTime: "07:00", endTime: "19:00" });
});

test("reduceSlotClick caps a session at 8 courts with a clear notice", () => {
  const nineCourts = Array.from({ length: 9 }, (_, i) => ({
    courtId: `c${i + 1}`,
    courtName: `Court ${i + 1}`,
    slots: [slot("09:00", "10:00")],
  }));
  const eightSelected = new Map(
    nineCourts.slice(0, 8).map((c) => [c.courtId, { startTime: "09:00", endTime: "10:00" }]),
  );
  const { selections, notice } = reduceSlotClick({
    selections: eightSelected,
    availabilityData: nineCourts,
    courtId: "c9",
    slot: slot("09:00", "10:00"),
  });
  assert.equal(selections, eightSelected);
  assert.match(notice.message, /up to 8 courts/);
});

test("reducer-produced selections always satisfy the checkout symmetry validation", () => {
  // Walk a full interaction and assert buildBookingSelectionPayload never fails
  // on symmetry — the reducer makes asymmetric states unrepresentable.
  const availabilityData = twoCourtAvailability();
  let selections = new Map();
  const clicks = [
    ["c1", slot("10:00", "11:00")],
    ["c2", slot("10:00", "11:00")],
    ["c1", slot("11:00", "12:00")],
    ["c2", slot("12:00", "13:00", "pending")], // ignored (unavailable)
  ];
  for (const [courtId, s] of clicks) {
    selections = reduceSlotClick({ selections, availabilityData, courtId, slot: s }).selections;
    const selectedCourtsData = [...selections.entries()].map(([id, range]) => {
      const courtSlots = availabilityData.find((c) => c.courtId === id).slots;
      const startIdx = courtSlots.findIndex((sl) => sl.startTime === range.startTime);
      const endIdx = courtSlots.findIndex((sl) => sl.endTime === range.endTime);
      return { courtId: id, courtName: id, slots: courtSlots.slice(startIdx, endIdx + 1) };
    });
    if (selectedCourtsData.length > 0) {
      const payload = buildBookingSelectionPayload({
        venueId: "v1",
        selectedDate: "2026-07-20",
        selectedCourtsData,
      });
      assert.equal(payload.ok, true, `asymmetric state after clicking ${JSON.stringify(s)}`);
    }
  }
});

test("buildBookingSelectionPayload refuses over-limit sessions with actionable messages", () => {
  const hour = (h) => `${String(h).padStart(2, "0")}:00`;
  const thirteenSlots = Array.from({ length: 13 }, (_, i) => ({
    startTime: hour(7 + i),
    endTime: hour(8 + i),
    price: 500,
  }));
  const overSlots = buildBookingSelectionPayload({
    venueId: "v1",
    selectedDate: "2026-07-20",
    selectedCourtsData: [{ courtId: "c1", courtName: "Court 1", slots: thirteenSlots }],
  });
  assert.equal(overSlots.ok, false);
  assert.match(overSlots.message, /up to 12 consecutive slots/);

  const nineCourts = Array.from({ length: 9 }, (_, i) => ({
    courtId: `c${i + 1}`,
    courtName: `Court ${i + 1}`,
    slots: [{ startTime: "09:00", endTime: "10:00", price: 500 }],
  }));
  const overCourts = buildBookingSelectionPayload({
    venueId: "v1",
    selectedDate: "2026-07-20",
    selectedCourtsData: nineCourts,
  });
  assert.equal(overCourts.ok, false);
  assert.match(overCourts.message, /up to 8 courts/);
});

/* ── Hold countdown helpers (03-UI-UX-SPECIFICATION §2.4) ─────────────── */

test("getRemainingSeconds counts down from expiresAt and floors at zero", () => {
  const now = new Date("2026-07-19T10:00:00.000Z").getTime();
  assert.equal(getRemainingSeconds("2026-07-19T10:10:00.000Z", now), 600);
  assert.equal(getRemainingSeconds("2026-07-19T10:00:30.500Z", now), 31); // ceils partial seconds
  assert.equal(getRemainingSeconds("2026-07-19T09:59:59.000Z", now), 0);  // past → 0, never negative
  assert.equal(getRemainingSeconds("garbage", now), 0);                    // invalid → 0 (treated expired)
});

test("formatCountdown renders m:ss with zero-padded seconds", () => {
  assert.equal(formatCountdown(600), "10:00");
  assert.equal(formatCountdown(599), "9:59");
  assert.equal(formatCountdown(61), "1:01");
  assert.equal(formatCountdown(9), "0:09");
  assert.equal(formatCountdown(0), "0:00");
  assert.equal(formatCountdown(-5), "0:00");
  assert.equal(formatCountdown(NaN), "0:00");
});

test("isLikelyMerchantOrderId accepts provider-shaped ids and rejects junk", () => {
  // Real provider shapes: PhonePe (PP-<hex>) and sandbox (SANDBOX-<uuid>).
  assert.equal(isLikelyMerchantOrderId("PP-44444444444444444444"), true);
  assert.equal(isLikelyMerchantOrderId("SANDBOX-44444444-4444-4444-8444-444444444444"), true);
  // Too short, empty, wrong type, or unsafe characters.
  assert.equal(isLikelyMerchantOrderId("PP-1"), false);
  assert.equal(isLikelyMerchantOrderId(""), false);
  assert.equal(isLikelyMerchantOrderId(null), false);
  assert.equal(isLikelyMerchantOrderId(undefined), false);
  assert.equal(isLikelyMerchantOrderId(42), false);
  assert.equal(isLikelyMerchantOrderId("PP-abc?def=ghi"), false);
  assert.equal(isLikelyMerchantOrderId("../../../etc/passwd"), false);
  assert.equal(isLikelyMerchantOrderId(`PP-${"a".repeat(300)}`), false);
});

test("resolvePaymentRedirectPath lands every verified order on the unified booking page", () => {
  // COMPLETED, FAILED, and PENDING all resolve to /booking/[bookingId] — the
  // unified page renders confirmation, failure + retry, or polling itself.
  for (const state of ["COMPLETED", "FAILED", "PENDING", "UNKNOWN"]) {
    const path = resolvePaymentRedirectPath({ ok: true, data: { bookingId: "booking-1", state } });
    assert.equal(path, "/booking/booking-1");
  }
});

test("resolvePaymentRedirectPath maps failures to whitelisted error destinations", () => {
  assert.equal(
    resolvePaymentRedirectPath({ ok: false, error: { code: "bad_request" } }),
    "/booking/error?type=missing_order_id",
  );
  assert.equal(
    resolvePaymentRedirectPath({ ok: false, error: { code: "not_found" } }),
    "/booking/error?type=notFound",
  );
  assert.equal(
    resolvePaymentRedirectPath({ ok: false, error: { code: "server_error" } }),
    "/booking/error?type=api_failure",
  );
  // Defensive: a success without a bookingId can't be routed to a booking.
  assert.equal(
    resolvePaymentRedirectPath({ ok: true, data: { bookingId: "" } }),
    "/booking/error?type=api_failure",
  );
  assert.equal(resolvePaymentRedirectPath(null), "/booking/error?type=api_failure");
});

test("resolvePaymentRedirectPath never reflects unsafe booking ids into the path", () => {
  // The bookingId comes from our own backend, but encode defensively anyway.
  const path = resolvePaymentRedirectPath({ ok: true, data: { bookingId: "a/b?c" } });
  assert.equal(path, "/booking/a%2Fb%3Fc");
});

test("normalizePaymentVerifyResponse maps the verify payload to camelCase", () => {
  const normalized = normalizePaymentVerifyResponse({
    merchant_order_id: "PP-abc123",
    booking_id: "booking-9",
    booking_status: "confirmed",
    payment_status: "success",
    state: "COMPLETED",
  });
  assert.deepEqual(normalized, {
    merchantOrderId: "PP-abc123",
    bookingId: "booking-9",
    bookingStatus: "confirmed",
    paymentStatus: "success",
    state: "COMPLETED",
  });

  // PENDING responses omit statuses; UNKNOWN is the defensive default state.
  assert.deepEqual(normalizePaymentVerifyResponse({}), {
    merchantOrderId: "",
    bookingId: "",
    bookingStatus: "",
    paymentStatus: "",
    state: "UNKNOWN",
  });
});
