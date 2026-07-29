import assert from 'node:assert/strict';
import test from 'node:test';

import { createNotificationPlannerService } from '../../src/modules/notifications/notifications.planner.js';
import { NotificationType } from '../../src/modules/notifications/notifications.constants.js';
import { getBookingEndUtc, getBookingStartUtc } from '../../src/modules/bookings/booking-time.js';

// A booking on 2026-08-10, session 09:00–11:00 Asia/Kolkata (UTC+5:30).
// slotDate is a Date-only; session times are Time-of-day values (UTC epoch date).
const BOOKING = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  venueId: '11111111-1111-4111-8111-111111111111',
  userId: '33333333-3333-4333-8333-333333333333',
  slotDate: new Date('2026-08-10T00:00:00.000Z'),
  sessionStartTime: new Date('1970-01-01T09:00:00.000Z'),
  sessionEndTime: new Date('1970-01-01T11:00:00.000Z'),
};

const TIMEZONE = 'Asia/Kolkata';

const makeRepository = ({ settings, created = [], failUnique = false } = {}) => ({
  async getPlannerContext() {
    return {
      venue: settings ? { id: BOOKING.venueId, timezone: TIMEZONE } : null,
      settings,
    };
  },
  async createScheduled({ data }) {
    if (failUnique) {
      const err = new Error('unique'); err.code = 'P2002'; throw err;
    }
    created.push(data);
    return true;
  },
});

test('schedules T-24h + T-2h reminders and the review request when all toggles on', async () => {
  const created = [];
  const planner = createNotificationPlannerService({
    repository: makeRepository({ settings: { remindersEnabled: true, reviewRequestsEnabled: true }, created }),
    clock: () => new Date('2026-08-01T00:00:00.000Z'), // well before the session
  });

  const result = await planner.scheduleForBooking({ tx: {}, booking: BOOKING });

  assert.equal(created.length, 3);
  assert.deepEqual(
    result.scheduled.sort(),
    [NotificationType.REMINDER_T24, NotificationType.REMINDER_T2H, NotificationType.REVIEW_REQUEST].sort(),
  );

  const byType = Object.fromEntries(created.map((row) => [row.type, row]));
  const startUtc = getBookingStartUtc(BOOKING, TIMEZONE);
  const endUtc = getBookingEndUtc(BOOKING, TIMEZONE);

  assert.equal(byType.reminder_t24.scheduledFor.getTime(), startUtc.getTime() - 24 * 3600e3);
  assert.equal(byType.reminder_t2h.scheduledFor.getTime(), startUtc.getTime() - 2 * 3600e3);
  assert.equal(byType.review_request.scheduledFor.getTime(), endUtc.getTime());

  for (const row of created) {
    assert.equal(row.bookingId, BOOKING.id);
    assert.equal(row.venueId, BOOKING.venueId);
    assert.equal(row.userId, BOOKING.userId);
    assert.equal(row.status, 'scheduled');
  }
});

test('skips reminder targets that are already in the past but still schedules the review request', async () => {
  const created = [];
  const planner = createNotificationPlannerService({
    repository: makeRepository({ settings: { remindersEnabled: true, reviewRequestsEnabled: true }, created }),
    // 1 hour before the session: T-24h and T-2h have both passed, review has not.
    clock: () => new Date(getBookingStartUtc(BOOKING, TIMEZONE).getTime() - 1 * 3600e3),
  });

  await planner.scheduleForBooking({ tx: {}, booking: BOOKING });

  assert.equal(created.length, 1);
  assert.equal(created[0].type, NotificationType.REVIEW_REQUEST);
});

test('schedules only reminders when reviewRequestsEnabled is off', async () => {
  const created = [];
  const planner = createNotificationPlannerService({
    repository: makeRepository({ settings: { remindersEnabled: true, reviewRequestsEnabled: false }, created }),
    clock: () => new Date('2026-08-01T00:00:00.000Z'),
  });

  await planner.scheduleForBooking({ tx: {}, booking: BOOKING });

  assert.deepEqual(
    created.map((r) => r.type).sort(),
    [NotificationType.REMINDER_T24, NotificationType.REMINDER_T2H].sort(),
  );
});

test('schedules nothing when both toggles are off', async () => {
  const created = [];
  const planner = createNotificationPlannerService({
    repository: makeRepository({ settings: { remindersEnabled: false, reviewRequestsEnabled: false }, created }),
    clock: () => new Date('2026-08-01T00:00:00.000Z'),
  });

  const result = await planner.scheduleForBooking({ tx: {}, booking: BOOKING });

  assert.equal(created.length, 0);
  assert.deepEqual(result.scheduled, []);
});

test('schedules nothing when no notification settings row exists', async () => {
  const created = [];
  const planner = createNotificationPlannerService({
    repository: makeRepository({ settings: null, created }),
    clock: () => new Date('2026-08-01T00:00:00.000Z'),
  });

  const result = await planner.scheduleForBooking({ tx: {}, booking: BOOKING });

  assert.equal(created.length, 0);
  assert.deepEqual(result.scheduled, []);
});

test('is idempotent on a duplicate confirm signal (P2002 → skip, no error)', async () => {
  const planner = createNotificationPlannerService({
    repository: makeRepository({
      settings: { remindersEnabled: true, reviewRequestsEnabled: true },
      failUnique: true,
    }),
    clock: () => new Date('2026-08-01T00:00:00.000Z'),
  });

  // Every insert collides with the UNIQUE(booking_id, type) constraint — the
  // planner must swallow P2002 and report nothing newly scheduled, not throw.
  const result = await planner.scheduleForBooking({ tx: {}, booking: BOOKING });
  assert.deepEqual(result.scheduled, []);
});

test('handles the overnight session (end on/before start) for the review request', async () => {
  const overnight = {
    ...BOOKING,
    sessionStartTime: new Date('1970-01-01T22:00:00.000Z'),
    sessionEndTime: new Date('1970-01-01T01:00:00.000Z'), // 01:00 next day
  };
  const created = [];
  const planner = createNotificationPlannerService({
    repository: makeRepository({ settings: { remindersEnabled: false, reviewRequestsEnabled: true }, created }),
    clock: () => new Date('2026-08-01T00:00:00.000Z'),
  });

  await planner.scheduleForBooking({ tx: {}, booking: overnight });

  assert.equal(created.length, 1);
  // The end must be rolled forward a day relative to a naive same-day read.
  const endUtc = getBookingEndUtc(overnight, TIMEZONE);
  const startUtc = getBookingStartUtc(overnight, TIMEZONE);
  assert.ok(endUtc.getTime() > startUtc.getTime(), 'overnight end must be after start');
  assert.equal(created[0].scheduledFor.getTime(), endUtc.getTime());
});
