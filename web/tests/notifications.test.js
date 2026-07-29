import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeNotificationLogRow,
  normalizeNotificationSettings,
} from "../src/lib/normalizers.js";
import { notificationSettingsSchema, notificationToggleSchema } from "../src/lib/schemas/notificationSettings.js";

// ── Settings normalizer ─────────────────────────────────────────────────────

test("normalizeNotificationSettings camelCases and defaults both toggles off", () => {
  const normalized = normalizeNotificationSettings({
    id: "s-1",
    venue_id: "venue-1",
    reminders_enabled: true,
    review_requests_enabled: false,
    updated_at: "2026-07-28T10:00:00.000Z",
  });

  assert.deepEqual(normalized, {
    id: "s-1",
    venueId: "venue-1",
    remindersEnabled: true,
    reviewRequestsEnabled: false,
    updatedAt: "2026-07-28T10:00:00.000Z",
  });
});

test("normalizeNotificationSettings coerces missing toggles to false and returns null for empty input", () => {
  const normalized = normalizeNotificationSettings({ venue_id: "venue-1" });
  assert.equal(normalized.remindersEnabled, false);
  assert.equal(normalized.reviewRequestsEnabled, false);
  assert.equal(normalized.updatedAt, null);

  assert.equal(normalizeNotificationSettings(null), null);
  assert.equal(normalizeNotificationSettings(undefined), null);
});

// ── Log-row normalizer ──────────────────────────────────────────────────────

test("normalizeNotificationLogRow camelCases and surfaces the customer context", () => {
  const normalized = normalizeNotificationLogRow({
    id: "n-1",
    booking_id: "b-1",
    type: "review_request",
    status: "sent",
    scheduled_for: "2026-07-28T05:30:00.000Z",
    attempts: 0,
    sent_at: "2026-07-28T05:30:05.000Z",
    provider: "dry_run",
    last_error: null,
    created_at: "2026-07-27T03:30:00.000Z",
    booking: { user: { id: "u-1", name: "Asha Mehta", phone: "+919876543210" } },
  });

  assert.equal(normalized.bookingId, "b-1");
  assert.equal(normalized.type, "review_request");
  assert.equal(normalized.status, "sent");
  assert.equal(normalized.provider, "dry_run");
  assert.equal(normalized.customerName, "Asha Mehta");
  assert.equal(normalized.customerPhone, "+919876543210");
});

test("normalizeNotificationLogRow tolerates a missing booking/user", () => {
  const normalized = normalizeNotificationLogRow({ id: "n-2", booking_id: "b-2", type: "reminder_t24", status: "scheduled" });
  assert.equal(normalized.customerName, "");
  assert.equal(normalized.customerPhone, "");
  assert.equal(normalized.attempts, 0);
});

// ── Schemas ─────────────────────────────────────────────────────────────────

test("notificationSettingsSchema accepts a single toggle or both", () => {
  assert.equal(notificationSettingsSchema.safeParse({ reminders_enabled: true }).success, true);
  assert.equal(notificationSettingsSchema.safeParse({ review_requests_enabled: false }).success, true);
  assert.equal(
    notificationSettingsSchema.safeParse({ reminders_enabled: true, review_requests_enabled: true }).success,
    true,
  );
});

test("notificationSettingsSchema rejects an empty toggle set", () => {
  const result = notificationSettingsSchema.safeParse({});
  assert.equal(result.success, false);
  assert.match(result.error.issues[0]?.message || "", /at least one/i);
});

test("notificationToggleSchema validates the single-toggle shape", () => {
  assert.equal(notificationToggleSchema.safeParse({ key: "reminders_enabled", enabled: true }).success, true);
  assert.equal(notificationToggleSchema.safeParse({ key: "bogus_key", enabled: true }).success, false);
  assert.equal(notificationToggleSchema.safeParse({ key: "review_requests_enabled", enabled: "yes" }).success, false);
});
