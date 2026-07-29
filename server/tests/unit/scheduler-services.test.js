import assert from 'node:assert/strict';
import { describe, test, mock } from 'node:test';

import { createAuthService } from '../../src/modules/auth/auth.service.js';
import { createReconciliationService } from '../../src/modules/payments/reconciliation.service.js';
import { createNotificationsService } from '../../src/modules/notifications/notifications.service.js';

// ─── Auth purgeExpiredRecords ────────────────────────────────────────────────

describe('authService.purgeExpiredRecords', () => {
  const fixedDate = new Date('2026-07-01T12:00:00.000Z');

  const createMockAuthService = (mockPurge) => {
    const mockRepo = {
      purgeExpiredRecords: mockPurge,
    };

    return createAuthService({
      repository: mockRepo,
      otpProvider: {},
      config: {
        auth: {
          accessTokenSecret: 'test-secret-32-chars-minimum-length',
          accessTokenTtlSeconds: 900,
          refreshTokenTtlSeconds: 86400,
          issuer: 'test',
          audience: 'test',
        },
        otp: {
          mode: 'sandbox',
          testCode: '123456',
          ttlSeconds: 300,
        },
        isProduction: false,
      },
      clock: () => fixedDate,
    });
  };

  test('calls repository with correct date boundaries', async () => {
    const mockPurge = mock.fn(async () => ({
      deletedOtps: 5,
      deletedSessions: 3,
      deletedTokens: 2,
    }));
    const service = createMockAuthService(mockPurge);

    const result = await service.purgeExpiredRecords();

    assert.equal(mockPurge.mock.calls.length, 1);
    const { oneDayAgo, thirtyDaysAgo } = mockPurge.mock.calls[0].arguments[0];

    const expectedOneDayAgo = new Date(fixedDate.getTime() - 24 * 60 * 60 * 1000);
    const expectedThirtyDaysAgo = new Date(fixedDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    assert.equal(oneDayAgo.getTime(), expectedOneDayAgo.getTime());
    assert.equal(thirtyDaysAgo.getTime(), expectedThirtyDaysAgo.getTime());

    assert.deepEqual(result, {
      deletedOtps: 5,
      deletedSessions: 3,
      deletedTokens: 2,
    });
  });

  test('dates are calculated from clock(), not new Date()', async () => {
    const customDate = new Date('2025-01-15T06:30:00.000Z');
    const mockPurge = mock.fn(async () => ({
      deletedOtps: 0,
      deletedSessions: 0,
      deletedTokens: 0,
    }));

    const service = createAuthService({
      repository: { purgeExpiredRecords: mockPurge },
      otpProvider: {},
      config: {
        auth: {
          accessTokenSecret: 'test-secret-32-chars-minimum-length',
          accessTokenTtlSeconds: 900,
          refreshTokenTtlSeconds: 86400,
          issuer: 'test',
          audience: 'test',
        },
        otp: {
          mode: 'sandbox',
          testCode: '123456',
          ttlSeconds: 300,
        },
        isProduction: false,
      },
      clock: () => customDate,
    });

    await service.purgeExpiredRecords();

    const { oneDayAgo, thirtyDaysAgo } = mockPurge.mock.calls[0].arguments[0];

    // These should be relative to customDate, not the real current time
    assert.equal(oneDayAgo.getTime(), customDate.getTime() - 24 * 60 * 60 * 1000);
    assert.equal(thirtyDaysAgo.getTime(), customDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  });
});

// ─── Reconciliation reconcileStalePayments ──────────────────────────────────

describe('reconciliationService.reconcileStalePayments', () => {
  const fixedDate = new Date('2026-07-01T12:00:00.000Z');

  const makePayment = (id, merchantOrderId, gateway = 'phonepe') => ({
    id,
    merchantOrderId,
    gateway,
    status: 'initiated',
    createdAt: new Date('2026-07-01T11:30:00.000Z'),
  });

  test('handles mixed COMPLETED/FAILED/PENDING states correctly', async () => {
    const payments = [
      makePayment('p1', 'MO-1'),
      makePayment('p2', 'MO-2'),
      makePayment('p3', 'MO-3'),
    ];

    const stateMap = { 'MO-1': 'COMPLETED', 'MO-2': 'FAILED', 'MO-3': 'PENDING' };

    const findStalePayments = mock.fn(async () => payments);
    const handleProviderPaymentEvent = mock.fn(async () => {});
    const getPaymentStatus = mock.fn(async ({ payment }) => stateMap[payment.merchantOrderId]);

    const service = createReconciliationService({
      paymentsRepository: { findStalePayments },
      bookingsService: { handleProviderPaymentEvent },
      paymentProvider: { getPaymentStatus },
      clock: () => fixedDate,
    });

    const result = await service.reconcileStalePayments({ staleThresholdMinutes: 15 });

    assert.equal(result.total, 3);
    assert.equal(result.completed, 1);
    assert.equal(result.failed, 1);
    assert.equal(result.pending, 1);
    assert.equal(result.errors, 0);

    // handleProviderPaymentEvent called for COMPLETED and FAILED, not PENDING
    assert.equal(handleProviderPaymentEvent.mock.calls.length, 2);

    const completedCall = handleProviderPaymentEvent.mock.calls[0].arguments[0];
    assert.equal(completedCall.merchantOrderId, 'MO-1');
    assert.equal(completedCall.state, 'COMPLETED');
    assert.equal(completedCall.payload.source, 'reconciliation_job');

    const failedCall = handleProviderPaymentEvent.mock.calls[1].arguments[0];
    assert.equal(failedCall.merchantOrderId, 'MO-2');
    assert.equal(failedCall.state, 'FAILED');
  });

  test('returns skipped result when paymentProvider is null', async () => {
    const service = createReconciliationService({
      paymentsRepository: {},
      bookingsService: {},
      paymentProvider: null,
      clock: () => fixedDate,
    });

    const result = await service.reconcileStalePayments();

    assert.equal(result.total, 0);
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'no_payment_provider');
  });

  test('stops batch after 3 consecutive provider errors', async () => {
    const payments = [
      makePayment('p1', 'MO-1'),
      makePayment('p2', 'MO-2'),
      makePayment('p3', 'MO-3'),
      makePayment('p4', 'MO-4'),
      makePayment('p5', 'MO-5'),
    ];

    const findStalePayments = mock.fn(async () => payments);
    const handleProviderPaymentEvent = mock.fn(async () => {});
    const getPaymentStatus = mock.fn(async () => {
      throw new Error('Provider timeout');
    });

    const service = createReconciliationService({
      paymentsRepository: { findStalePayments },
      bookingsService: { handleProviderPaymentEvent },
      paymentProvider: { getPaymentStatus },
      clock: () => fixedDate,
    });

    const result = await service.reconcileStalePayments();

    // Should have attempted 3, then stopped at the 4th due to circuit breaker
    assert.equal(result.total, 5);
    assert.equal(result.errors, 3);
    assert.equal(result.completed, 0);
    assert.equal(result.failed, 0);
    assert.equal(result.pending, 0);

    // getPaymentStatus called exactly 3 times (4th and 5th skipped by early exit)
    assert.equal(getPaymentStatus.mock.calls.length, 3);
    assert.equal(handleProviderPaymentEvent.mock.calls.length, 0);
  });

  test('returns correct aggregate counts', async () => {
    const payments = [
      makePayment('p1', 'MO-1'),
      makePayment('p2', 'MO-2'),
    ];

    const findStalePayments = mock.fn(async () => payments);
    const handleProviderPaymentEvent = mock.fn(async () => {});
    const getPaymentStatus = mock.fn(async () => 'COMPLETED');

    const service = createReconciliationService({
      paymentsRepository: { findStalePayments },
      bookingsService: { handleProviderPaymentEvent },
      paymentProvider: { getPaymentStatus },
      clock: () => fixedDate,
    });

    const result = await service.reconcileStalePayments({ batchSize: 10 });

    assert.equal(result.total, 2);
    assert.equal(result.completed, 2);
    assert.equal(result.failed, 0);
    assert.equal(result.pending, 0);
    assert.equal(result.errors, 0);
  });

  test('passes correct cutoff and limit to repository', async () => {
    const findStalePayments = mock.fn(async () => []);

    const service = createReconciliationService({
      paymentsRepository: { findStalePayments },
      bookingsService: {},
      paymentProvider: { getPaymentStatus: mock.fn() },
      clock: () => fixedDate,
    });

    await service.reconcileStalePayments({ staleThresholdMinutes: 20, batchSize: 25 });

    assert.equal(findStalePayments.mock.calls.length, 1);
    const args = findStalePayments.mock.calls[0].arguments[0];
    assert.equal(args.limit, 25);

    const expectedCutoff = new Date(fixedDate.getTime() - 20 * 60 * 1000);
    assert.equal(args.cutoff.getTime(), expectedCutoff.getTime());
  });

  test('resets consecutiveErrors counter after a successful check', async () => {
    const payments = [
      makePayment('p1', 'MO-1'),
      makePayment('p2', 'MO-2'),
      makePayment('p3', 'MO-3'),
      makePayment('p4', 'MO-4'),
      makePayment('p5', 'MO-5'),
    ];

    let callCount = 0;
    const getPaymentStatus = mock.fn(async () => {
      callCount++;
      // Fail on 1st and 2nd, succeed on 3rd, fail on 4th and 5th
      if (callCount <= 2 || callCount >= 4) {
        throw new Error('Provider timeout');
      }
      return 'COMPLETED';
    });

    const findStalePayments = mock.fn(async () => payments);
    const handleProviderPaymentEvent = mock.fn(async () => {});

    const service = createReconciliationService({
      paymentsRepository: { findStalePayments },
      bookingsService: { handleProviderPaymentEvent },
      paymentProvider: { getPaymentStatus },
      clock: () => fixedDate,
    });

    const result = await service.reconcileStalePayments();

    // All 5 should be attempted because the 3rd success resets the counter
    assert.equal(getPaymentStatus.mock.calls.length, 5);
    assert.equal(result.completed, 1);
    assert.equal(result.errors, 4);
  });
});

// ─── Notifications dispatchDueNotifications (dispatch-due-notifications job) ──

describe('notificationsService.dispatchDueNotifications', () => {
  const fixedDate = new Date('2026-08-09T03:30:00.000Z');

  test('exposes a callable dispatchDueNotifications entry point for the scheduler job', async () => {
    const claimDue = mock.fn(async () => []);
    const service = createNotificationsService({
      repository: { claimDue },
      transport: { send: mock.fn() },
      config: { frontendBaseUrl: 'https://app.example.test' },
      clock: () => fixedDate,
    });

    // The scheduler job calls service.dispatchDueNotifications() with no args —
    // it must default to the injected clock and return outcome counts.
    const result = await service.dispatchDueNotifications();

    assert.equal(claimDue.mock.calls.length, 1);
    const { now } = claimDue.mock.calls[0].arguments[0];
    assert.equal(now.getTime(), fixedDate.getTime());
    assert.equal(result.claimed, 0);
    assert.equal(result.sent, 0);
  });
});
