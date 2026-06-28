import assert from "node:assert/strict";
import test from "node:test";

import {
  getRolePermissions,
  hasPermission,
  canAccessRoute,
  routeAccess,
} from "../src/lib/rbac.js";
import {
  validateName,
  validatePhone,
  validateOtp,
  validateReview,
  validateCoupon,
} from "../src/lib/validation.js";
import {
  buildDateWindow,
  getPaymentReceiptDetails,
} from "../src/lib/bookingEngine.js";
import {
  buildBookingSelectionPayload,
  normalizeAvailabilityResponse,
  normalizePricePreviewResponse,
  normalizeBooking,
  normalizeBookingDetailResponse,
} from "../src/lib/normalizers.js";

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

test("booking validation normalizes customer auth inputs", () => {
  assert.deepEqual(validateName(" Asha  Mehta "), {
    ok: true,
    value: "Asha Mehta",
  });
  assert.deepEqual(validatePhone("98765 43210"), {
    ok: true,
    value: "+919876543210",
  });
  assert.equal(validateOtp("12345").ok, false);
  assert.equal(validateOtp("123456").ok, true);
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

test("review validation requires a rating but keeps text and photo optional", () => {
  assert.equal(validateReview({ rating: 0 }).ok, false);
  assert.deepEqual(validateReview({ rating: 5, comment: " Great court " }), {
    ok: true,
    value: { rating: 5, comment: "Great court", photoName: "" },
  });
});

test("coupon validation is format-only before server preview applies it", () => {
  assert.deepEqual(validateCoupon(" first50 "), {
    ok: true,
    value: "FIRST50",
  });
  assert.equal(validateCoupon("bad coupon").ok, false);
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
    venue: { id: "venue-1", name: "Venue A" },
  };

  const normalized = normalizeBooking(rawSummaryBooking, { isDetail: false });
  assert.deepEqual(normalized.courtNames, ["Court 1", "Court 2"]);
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

