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
} from "../src/lib/validation.js";
import {
  buildDateWindow,
  calculateQuote,
  createBookingHold,
} from "../src/lib/booking-engine.js";

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
  assert.equal(validateOtp("482913").ok, true);
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

test("quote calculation centralizes totals and coupon waterfall", () => {
  const quote = calculateQuote({
    courtFee: 500,
    equipmentFee: 100,
    serviceFee: 20,
    taxRate: 0.18,
    coupon: { code: "FIRST50", discountType: "flat", value: 50 },
    creditsApplied: 75,
  });

  assert.equal(quote.discountAmount, 50);
  assert.equal(quote.creditsApplied, 75);
  assert.equal(quote.taxAmount, 89.1);
  assert.equal(quote.totalAmount, 584.1);
});

test("booking hold creates a pending payment lock with expiry metadata", () => {
  const hold = createBookingHold({
    now: new Date("2026-05-13T10:00:00.000Z"),
    venueId: "venue-besa",
    courtId: "court-1",
    slotDate: "2026-05-14",
    startTime: "18:00",
    endTime: "19:00",
    totalAmount: 590,
  });

  assert.equal(hold.status, "pending_payment");
  assert.equal(hold.expiresAt, "2026-05-13T10:10:00.000Z");
  assert.equal(hold.slot.label, "18:00 - 19:00");
});

test("review validation requires a rating but keeps text and photo optional", () => {
  assert.equal(validateReview({ rating: 0 }).ok, false);
  assert.deepEqual(validateReview({ rating: 5, comment: " Great court " }), {
    ok: true,
    value: { rating: 5, comment: "Great court", photoName: "" },
  });
});
