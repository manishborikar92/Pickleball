import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeModerationInstance,
  normalizeMyRewardsResponse,
  normalizeRevealResponse,
  normalizeRewardInstance,
  normalizeRewardMechanism,
} from "../src/lib/normalizers.js";
import { rewardMechanismSchema, redemptionNoteSchema } from "../src/lib/schemas/rewardMechanism.js";
import { daysUntil } from "../src/lib/rewardDates.js";

const NOW = new Date("2026-07-16T10:00:00.000Z");

// ── Instance normalizers ──────────────────────────────────────────────────

test("normalizeRewardInstance camelCases and leaves outcome/voucher undefined while pending", () => {
  const normalized = normalizeRewardInstance({
    id: "r-1",
    mechanism_type: "scratch_card",
    mechanism_name: "Post-Booking Scratch Card",
    status: "pending",
    booking_id: "b-1",
    booking_slot_date: "2026-07-13",
    card_theme: "court_green",
    expires_at: "2026-07-20T10:00:00.000Z",
    created_at: "2026-07-13T10:00:00.000Z",
  });

  assert.equal(normalized.id, "r-1");
  assert.equal(normalized.mechanismType, "scratch_card");
  assert.equal(normalized.bookingId, "b-1");
  assert.equal(normalized.cardTheme, "court_green");
  assert.equal(normalized.outcome, undefined);
  assert.equal(normalized.voucher, undefined);
});

test("normalizeRewardInstance carries outcome and voucher for revealed instances", () => {
  const normalized = normalizeRewardInstance({
    id: "r-2",
    mechanism_type: "scratch_card",
    status: "revealed",
    booking_id: "b-1",
    revealed_at: "2026-07-14T10:00:00.000Z",
    outcome: { prize_id: "p2", label: "Free Iced Coffee", type: "voucher", terms: "One per visit." },
    voucher: { code: "RWD-ABCD2345", valid_until: "2026-08-13T10:00:00.000Z", redeemed: true, redeemed_at: "2026-07-15T09:00:00.000Z" },
  });

  assert.deepEqual(normalized.outcome, {
    prizeId: "p2",
    label: "Free Iced Coffee",
    type: "voucher",
    terms: "One per visit.",
  });
  assert.deepEqual(normalized.voucher, {
    code: "RWD-ABCD2345",
    validUntil: "2026-08-13T10:00:00.000Z",
    redeemed: true,
    redeemedAt: "2026-07-15T09:00:00.000Z",
  });
});

test("normalizeMyRewardsResponse accepts both bare arrays and {data} envelopes", () => {
  const rows = [{ id: "r-1", mechanism_type: "scratch_card", status: "pending" }];
  assert.equal(normalizeMyRewardsResponse(rows).length, 1);
  assert.equal(normalizeMyRewardsResponse({ data: rows }).length, 1);
  assert.equal(normalizeMyRewardsResponse({}).length, 0);
});

test("normalizeRevealResponse matches the instance shape so views are interchangeable", () => {
  const revealed = normalizeRevealResponse({
    instance_id: "r-1",
    mechanism_type: "scratch_card",
    status: "revealed",
    revealed_at: "2026-07-16T10:05:00.000Z",
    outcome: { prize_id: "p1", label: "Better luck next time!", type: "no_prize" },
  });

  assert.equal(revealed.id, "r-1");
  assert.equal(revealed.status, "revealed");
  assert.equal(revealed.outcome.type, "no_prize");
  assert.equal(revealed.voucher, undefined);
});

// ── Admin normalizers ─────────────────────────────────────────────────────

test("normalizeRewardMechanism camelCases and defaults an empty prize pool", () => {
  const mechanism = normalizeRewardMechanism({
    id: "m-1",
    venue_id: "v-1",
    name: "Post-Booking Scratch Card",
    type: "scratch_card",
    trigger_event: "booking_confirmed",
    config: { card_theme: "court_green", prizes: [{ id: "p1", label: "x", type: "no_prize", probability: 1 }] },
    instance_expiry_days: 7,
    is_active: true,
    created_at: "2026-07-16T10:00:00.000Z",
  });

  assert.equal(mechanism.venueId, "v-1");
  assert.equal(mechanism.instanceExpiryDays, 7);
  assert.equal(mechanism.isActive, true);
  assert.equal(mechanism.config.prizes.length, 1);
  assert.deepEqual(normalizeRewardMechanism({ id: "m-2" }).config, { prizes: [] });
  assert.equal(normalizeRewardMechanism(null), null);
});

test("normalizeModerationInstance adds user and redemption note on top of the instance shape", () => {
  const instance = normalizeModerationInstance({
    id: "r-1",
    mechanism_type: "scratch_card",
    status: "revealed",
    booking_id: "b-1",
    outcome: { prize_id: "p2", label: "Free Iced Coffee", type: "voucher" },
    voucher: { code: "RWD-ABCD2345", redeemed: true },
    redemption_note: "Café counter",
    user: { id: "u-1", name: "Asha", phone: "+919876543210" },
  });

  assert.equal(instance.outcome.label, "Free Iced Coffee");
  assert.equal(instance.voucher.redeemed, true);
  assert.equal(instance.redemptionNote, "Café counter");
  assert.deepEqual(instance.user, { id: "u-1", name: "Asha", phone: "+919876543210" });
});

// ── Mechanism editor schema ───────────────────────────────────────────────

const validMechanismInput = {
  name: "Post-Booking Scratch Card",
  type: "scratch_card",
  instance_expiry_days: 7,
  is_active: true,
  prizes: [
    { id: "p1", label: "Better luck next time!", type: "no_prize", probability: 0.7, terms: "" },
    { id: "p2", label: "Free Iced Coffee", type: "voucher", probability: 0.3, terms: "One per visit.", validity_days: 14 },
  ],
};

test("rewardMechanismSchema accepts a valid mechanism and coerces numeric strings", () => {
  const parsed = rewardMechanismSchema.safeParse({
    ...validMechanismInput,
    instance_expiry_days: "7",
    prizes: validMechanismInput.prizes.map((prize) => ({
      ...prize,
      probability: String(prize.probability),
    })),
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.instance_expiry_days, 7);
  assert.equal(parsed.data.prizes[0].probability, 0.7);
});

test("rewardMechanismSchema rejects invalid mechanism types", () => {
  // Only scratch_card is supported as a valid mechanism type.
  const parsed = rewardMechanismSchema.safeParse({ ...validMechanismInput, type: "unsupported_type" });
  assert.equal(parsed.success, false);
});

test("rewardMechanismSchema rejects probabilities that do not sum to 1.0", () => {
  const parsed = rewardMechanismSchema.safeParse({
    ...validMechanismInput,
    prizes: [
      { id: "p1", label: "Nothing", type: "no_prize", probability: 0.5, terms: "" },
      { id: "p2", label: "Coffee", type: "voucher", probability: 0.4, terms: "" },
    ],
  });
  assert.equal(parsed.success, false);
  assert.match(parsed.error.issues[0].message, /sum to exactly 1\.0/);
});

test("rewardMechanismSchema rejects duplicate prize ids", () => {
  const parsed = rewardMechanismSchema.safeParse({
    ...validMechanismInput,
    prizes: [
      { id: "p1", label: "Nothing", type: "no_prize", probability: 0.5, terms: "" },
      { id: "p1", label: "Coffee", type: "voucher", probability: 0.5, terms: "" },
    ],
  });
  assert.equal(parsed.success, false);
  assert.match(parsed.error.issues[0].message, /unique/);
});

test("rewardMechanismSchema forbids voucher fields on no_prize entries", () => {
  const withTerms = rewardMechanismSchema.safeParse({
    ...validMechanismInput,
    prizes: [{ id: "p1", label: "Nothing", type: "no_prize", probability: 1, terms: "sneaky" }],
  });
  assert.equal(withTerms.success, false);

  const withValidity = rewardMechanismSchema.safeParse({
    ...validMechanismInput,
    prizes: [{ id: "p1", label: "Nothing", type: "no_prize", probability: 1, terms: "", validity_days: 10 }],
  });
  assert.equal(withValidity.success, false);
});

test("rewardMechanismSchema bounds expiry and validity windows", () => {
  const badExpiry = rewardMechanismSchema.safeParse({ ...validMechanismInput, instance_expiry_days: 0 });
  assert.equal(badExpiry.success, false);

  const badValidity = rewardMechanismSchema.safeParse({
    ...validMechanismInput,
    prizes: [
      { id: "p1", label: "Nothing", type: "no_prize", probability: 0.5, terms: "" },
      { id: "p2", label: "Coffee", type: "voucher", probability: 0.5, terms: "", validity_days: 400 },
    ],
  });
  assert.equal(badValidity.success, false);
});

test("redemptionNoteSchema collapses whitespace and caps at 500 chars", () => {
  assert.equal(redemptionNoteSchema.parse("  café   counter  "), "café counter");
  assert.equal(redemptionNoteSchema.parse("x".repeat(600)).length, 500);
  assert.equal(redemptionNoteSchema.parse(undefined), "");
});

// ── daysUntil (expiry countdown) ──────────────────────────────────────────

test("daysUntil counts whole days remaining, clamped at zero", () => {
  assert.equal(daysUntil("2026-07-20T10:00:00.000Z", NOW), 4);
  assert.equal(daysUntil("2026-07-16T18:00:00.000Z", NOW), 1); // later today → 1
  assert.equal(daysUntil("2026-07-10T10:00:00.000Z", NOW), 0); // past → 0
  assert.equal(daysUntil("", NOW), 0);
  assert.equal(daysUntil("not-a-date", NOW), 0);
});
