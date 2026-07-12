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
  getPaymentReceiptDetails,
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
} from "../src/lib/normalizers.js";
import { runCheckout } from "../src/lib/services/checkout.js";

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

test("runCheckout returns a confirmed result for a wallet-only payment (HI-13)", async () => {
  const calls = [];
  const result = await runCheckout(
    {
      createHold: async (sel) => { calls.push(["hold", sel]); return { bookingId: "bk-1" }; },
      acceptWaiver: async (id) => { calls.push(["waiver", id]); },
      initiatePayment: async (id, opts) => { calls.push(["pay", id, opts]); return { kind: "confirmed" }; },
    },
    { selection: { venue_id: "v" }, useWalletCredits: true },
  );
  assert.deepEqual(result, { kind: "confirmed", bookingId: "bk-1" });
  // Enforces the ordered sequence hold → waiver → pay.
  assert.deepEqual(calls.map((c) => c[0]), ["hold", "waiver", "pay"]);
});

test("runCheckout returns a redirect result for a gateway payment (HI-13)", async () => {
  const result = await runCheckout(
    {
      createHold: async () => ({ bookingId: "bk-2" }),
      acceptWaiver: async () => {},
      initiatePayment: async () => ({ kind: "redirect", redirectUrl: "https://pay", merchantOrderId: "PP-2" }),
    },
    { selection: {} },
  );
  assert.equal(result.kind, "redirect");
  assert.equal(result.bookingId, "bk-2");
  assert.equal(result.redirectUrl, "https://pay");
  assert.equal(result.merchantOrderId, "PP-2");
});

test("runCheckout throws when the hold cannot be created (HI-13)", async () => {
  await assert.rejects(
    () => runCheckout(
      {
        createHold: async () => ({ bookingId: null }),
        acceptWaiver: async () => {},
        initiatePayment: async () => ({ kind: "confirmed" }),
      },
      { selection: {} },
    ),
    /Could not create booking hold/,
  );
});
