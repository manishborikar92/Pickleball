import assert from 'node:assert/strict';
import test from 'node:test';

import { createNotificationsService } from '../../src/modules/notifications/notifications.service.js';
import { NotificationType } from '../../src/modules/notifications/notifications.constants.js';

const BOOKING_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const baseConfig = { frontendBaseUrl: 'https://app.example.test' };

// Builds a claimed outbox row for a given booking status + type.
const claimedRow = ({ id, type, bookingStatus, attempts = 0, scheduledFor }) => ({
  id,
  bookingId: BOOKING_ID,
  venueId: 'venue-1',
  userId: 'user-1',
  type,
  scheduledFor: scheduledFor || new Date('2026-08-10T03:30:00.000Z'),
  attempts,
  booking: {
    id: BOOKING_ID,
    status: bookingStatus,
    sessionStartTime: new Date('1970-01-01T09:00:00.000Z'),
    sessionEndTime: new Date('1970-01-01T11:00:00.000Z'),
    venue: { id: 'venue-1', timezone: 'Asia/Kolkata', name: 'Baseline Arena' },
    user: { id: 'user-1', phone: '+919876543210', name: 'Asha' },
  },
});

// In-memory repository recording every mutation the service performs.
const makeRepository = ({ rows = [] } = {}) => {
  const calls = { sent: [], failed: [], skipped: [], cancelled: [], released: [] };
  return {
    calls,
    reviewMaxDelayMs: () => 48 * 3600e3,
    async claimDue() { return rows; },
    async markSent(args) { calls.sent.push(args); },
    async markFailed(args) { calls.failed.push(args); return 'scheduled'; },
    async markSkipped(args) { calls.skipped.push(args); },
    async markCancelled(args) { calls.cancelled.push(args); },
    async releaseToScheduled(args) { calls.released.push(args); },
  };
};

const makeTransport = ({ deliveries = [], throwOn = null } = {}) => ({
  async send(args) {
    deliveries.push(args);
    if (throwOn && throwOn === args.type) {
      throw new Error('gateway down');
    }
    return { provider: 'dry_run', delivered: true };
  },
});

test('sends a reminder for an upcoming (confirmed) booking and marks it sent', async () => {
  const rows = [claimedRow({ id: 'n1', type: NotificationType.REMINDER_T24, bookingStatus: 'confirmed' })];
  const repository = makeRepository({ rows });
  const deliveries = [];
  const service = createNotificationsService({
    repository,
    transport: makeTransport({ deliveries }),
    config: baseConfig,
    clock: () => new Date('2026-08-09T03:30:00.000Z'),
  });

  const result = await service.dispatchDueNotifications();

  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].to, '+919876543210');
  assert.equal(deliveries[0].type, NotificationType.REMINDER_T24);
  assert.equal(repository.calls.sent.length, 1);
  assert.equal(repository.calls.sent[0].provider, 'dry_run');
  assert.equal(result.sent, 1);
});

test('skips a reminder when the session already ended (completed)', async () => {
  const rows = [claimedRow({ id: 'n2', type: NotificationType.REMINDER_T2H, bookingStatus: 'completed' })];
  const repository = makeRepository({ rows });
  const deliveries = [];
  const service = createNotificationsService({ repository, transport: makeTransport({ deliveries }), config: baseConfig });

  const result = await service.dispatchDueNotifications();

  assert.equal(deliveries.length, 0);
  assert.equal(repository.calls.skipped.length, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.sent, 0);
});

test('cancels a reminder when the booking was cancelled', async () => {
  const rows = [claimedRow({ id: 'n3', type: NotificationType.REMINDER_T24, bookingStatus: 'cancelled' })];
  const repository = makeRepository({ rows });
  const deliveries = [];
  const service = createNotificationsService({ repository, transport: makeTransport({ deliveries }), config: baseConfig });

  const result = await service.dispatchDueNotifications();

  assert.equal(deliveries.length, 0);
  assert.equal(repository.calls.cancelled.length, 1);
  assert.equal(result.cancelled, 1);
});

test('review request waits (releases back to scheduled) when the booking is not yet completed', async () => {
  const rows = [claimedRow({ id: 'n4', type: NotificationType.REVIEW_REQUEST, bookingStatus: 'confirmed' })];
  const repository = makeRepository({ rows });
  const deliveries = [];
  const service = createNotificationsService({ repository, transport: makeTransport({ deliveries }), config: baseConfig });

  const result = await service.dispatchDueNotifications();

  // Not yet completed → wait for the completion sweeper; no send, no failure.
  assert.equal(deliveries.length, 0);
  assert.equal(repository.calls.released.length, 1);
  assert.equal(repository.calls.failed.length, 0);
  assert.equal(result.waiting, 1);
});

test('review request sends with the absolute review link once the booking is completed', async () => {
  const rows = [claimedRow({ id: 'n5', type: NotificationType.REVIEW_REQUEST, bookingStatus: 'completed' })];
  const repository = makeRepository({ rows });
  const deliveries = [];
  const service = createNotificationsService({ repository, transport: makeTransport({ deliveries }), config: baseConfig });

  const result = await service.dispatchDueNotifications();

  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].type, NotificationType.REVIEW_REQUEST);
  assert.equal(deliveries[0].params.link, `https://app.example.test/review/${BOOKING_ID}`);
  assert.equal(repository.calls.sent.length, 1);
  assert.equal(result.sent, 1);
});

test('review request gives up (skipped) when the booking never completed past the max delay', async () => {
  // scheduledFor 60 hours ago, still not completed → beyond the 48h review max delay.
  const past = new Date(Date.now() - 60 * 3600e3);
  const rows = [claimedRow({ id: 'n6', type: NotificationType.REVIEW_REQUEST, bookingStatus: 'confirmed', scheduledFor: past })];
  const repository = makeRepository({ rows });
  const deliveries = [];
  const service = createNotificationsService({ repository, transport: makeTransport({ deliveries }), config: baseConfig });

  const result = await service.dispatchDueNotifications();

  assert.equal(deliveries.length, 0);
  assert.equal(repository.calls.skipped.length, 1);
  assert.equal(result.skipped, 1);
});

test('a transport failure retries with backoff and marks failed (not sent)', async () => {
  const rows = [claimedRow({ id: 'n7', type: NotificationType.REMINDER_T24, bookingStatus: 'confirmed', attempts: 0 })];
  const repository = makeRepository({ rows });
  const deliveries = [];
  const service = createNotificationsService({
    repository,
    transport: makeTransport({ deliveries, throwOn: NotificationType.REMINDER_T24 }),
    config: baseConfig,
  });

  const result = await service.dispatchDueNotifications();

  assert.equal(deliveries.length, 1);
  assert.equal(repository.calls.sent.length, 0);
  assert.equal(repository.calls.failed.length, 1);
  assert.equal(repository.calls.failed[0].id, 'n7');
  assert.equal(result.failed, 1);
});

test('dead-letters after maxAttempts (no further retry scheduled)', async () => {
  const rows = [claimedRow({ id: 'n8', type: NotificationType.REMINDER_T24, bookingStatus: 'confirmed', attempts: 4 })];
  const repository = {
    calls: { failed: [] },
    reviewMaxDelayMs: () => 48 * 3600e3,
    async claimDue() { return rows; },
    async markFailed(args) {
      this.calls.failed.push(args);
      // attempts(4) + 1 >= maxAttempts(5) → dead-letter.
      return args.attempts + 1 >= 5 ? 'failed' : 'scheduled';
    },
  };
  const deliveries = [];
  const service = createNotificationsService({
    repository,
    transport: makeTransport({ deliveries, throwOn: NotificationType.REMINDER_T24 }),
    config: baseConfig,
    maxAttempts: 5,
  });

  const result = await service.dispatchDueNotifications();

  assert.equal(repository.calls.failed.length, 1);
  assert.equal(result.failed, 1);
});

test('an empty due set is a no-op', async () => {
  const repository = makeRepository({ rows: [] });
  const deliveries = [];
  const service = createNotificationsService({ repository, transport: makeTransport({ deliveries }), config: baseConfig });

  const result = await service.dispatchDueNotifications();

  assert.equal(result.claimed, 0);
  assert.equal(deliveries.length, 0);
});

test('walk_in bookings receive reminders (eligible status)', async () => {
  const rows = [claimedRow({ id: 'n9', type: NotificationType.REMINDER_T2H, bookingStatus: 'walk_in' })];
  const repository = makeRepository({ rows });
  const deliveries = [];
  const service = createNotificationsService({ repository, transport: makeTransport({ deliveries }), config: baseConfig });

  const result = await service.dispatchDueNotifications();

  assert.equal(deliveries.length, 1);
  assert.equal(result.sent, 1);
});
