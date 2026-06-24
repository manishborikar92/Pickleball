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
} from "../src/lib/booking-engine.js";
import {
  buildBookingSelectionPayload,
  normalizeAvailabilityResponse,
  normalizePricePreviewResponse,
} from "../src/services/bookingService.js";

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
