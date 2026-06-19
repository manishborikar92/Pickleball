import assert from 'node:assert/strict';
import test from 'node:test';

import { createBookingsService } from '../../src/modules/bookings/bookings.service.js';
import { createPaymentsService } from '../../src/modules/payments/payments.service.js';
import { createReconciliationService } from '../../src/modules/payments/reconciliation.service.js';
import { PermissionDeniedError } from '../../src/utils/api-error.js';
import { Permissions } from '../../src/shared/auth-constants.js';

const userId = '33333333-3333-4333-8333-333333333333';
const bookingId = '44444444-4444-4444-8444-444444444444';
const paymentId = '55555555-5555-5555-8555-555555555555';

function createMockRepository(overrides = {}) {
  return {
    async getBookingForPayment() {
      return {
        id: bookingId,
        userId,
        status: 'pending_payment',
        totalAmount: 590,
        creditsApplied: 0,
        waiverAccepted: true,
        expiresAt: new Date('2026-06-18T12:10:00.000Z'),
        user: { id: userId, walletCredits: 100 },
      };
    },
    async findReusableInitiatedPayment() {
      return null;
    },
    async initiateProviderPayment() {
      return {
        payment: { id: paymentId, status: 'initiated', merchantOrderId: 'ORDER-1', amount: 490 },
      };
    },
    async getPaymentWithBooking() {
      return {
        id: paymentId,
        status: 'initiated',
        amount: 490,
        merchantOrderId: 'ORDER-1',
        booking: {
          id: bookingId,
          userId,
          status: 'pending_payment',
          creditsApplied: 100,
          expiresAt: new Date('2026-06-18T12:10:00.000Z'),
        },
      };
    },
    ...overrides,
  };
}

function createTestBookingsService({ repository, paymentProvider, clock }) {
  return createBookingsService({
    repository,
    paymentProvider,
    availabilityService: { async getAvailability() { return {}; } },
    selectionService: { validateSelection() { return {}; } },
    pricingService: { buildQuote() { return {}; } },
    clock: clock || (() => new Date('2026-06-18T12:00:00.000Z')),
  });
}

test('Duplicate payment prevention: handles concurrent P2002 database exception gracefully', async () => {
  let findCalled = 0;
  const repository = createMockRepository({
    async initiateProviderPayment() {
      const err = new Error('Unique constraint failed');
      err.code = 'P2002';
      throw err;
    },
    async findReusableInitiatedPayment({ _bookingId }) {
      findCalled++;
      return {
        id: paymentId,
        gateway: 'sandbox',
        merchantOrderId: 'ORDER-CONCURRENT-1',
        amount: 490,
        status: 'initiated',
        rawWebhookPayload: { redirect_url: 'http://localhost/pay-concurrent' },
      };
    },
  });

  const service = createTestBookingsService({
    repository,
    paymentProvider: {
      async createPaymentOrder() {
        return { gateway: 'sandbox', merchant_order_id: 'ORDER-CONCURRENT-1', redirect_url: 'http://localhost/pay-concurrent' };
      },
    },
    clock: () => new Date('2026-06-18T12:00:00.000Z'),
  });

  const result = await service.initiatePayment({
    userId,
    bookingId,
    input: { use_wallet_credits: true },
  });

  assert.equal(findCalled, 1);
  assert.equal(result.type, 'sandbox');
  assert.equal(result.merchant_order_id, 'ORDER-CONCURRENT-1');
  assert.equal(result.redirect_url, 'http://localhost/pay-concurrent');
  assert.equal(result.payment_id, paymentId);
});

test('Webhook ordering guards: completed webhook after completion is idempotent', async () => {
  const repository = createMockRepository({
    async getPaymentWithBooking() {
      return {
        id: paymentId,
        status: 'success',
        merchantOrderId: 'ORDER-1',
        booking: { id: bookingId, status: 'confirmed' },
      };
    },
  });

  const service = createTestBookingsService({
    repository,
    clock: () => new Date('2026-06-18T12:00:00.000Z'),
  });

  const result = await service.handleProviderPaymentEvent({
    merchantOrderId: 'ORDER-1',
    state: 'COMPLETED',
  });

  assert.equal(result.booking_status, 'confirmed');
  assert.equal(result.payment_status, 'success');
  assert.equal(result.idempotent, true);
});

test('Webhook ordering guards: FAILED webhook after COMPLETED success is blocked (idempotent no-op)', async () => {
  const repository = createMockRepository({
    async getPaymentWithBooking() {
      return {
        id: paymentId,
        status: 'success',
        merchantOrderId: 'ORDER-1',
        booking: { id: bookingId, status: 'confirmed', creditsApplied: 100 },
      };
    },
  });

  const service = createTestBookingsService({
    repository,
    clock: () => new Date('2026-06-18T12:00:00.000Z'),
  });

  const result = await service.handleProviderPaymentEvent({
    merchantOrderId: 'ORDER-1',
    state: 'FAILED',
  });

  assert.equal(result.payment_status, 'success');
  assert.equal(result.booking_status, 'confirmed');
  assert.equal(result.idempotent, true);
});

test('Webhook ordering guards: COMPLETED webhook after FAILED payment is blocked (idempotent no-op)', async () => {
  const repository = createMockRepository({
    async getPaymentWithBooking() {
      return {
        id: paymentId,
        status: 'failed',
        merchantOrderId: 'ORDER-1',
        booking: { id: bookingId, status: 'pending_payment' },
      };
    },
  });

  const service = createTestBookingsService({
    repository,
    clock: () => new Date('2026-06-18T12:00:00.000Z'),
  });

  const result = await service.handleProviderPaymentEvent({
    merchantOrderId: 'ORDER-1',
    state: 'COMPLETED',
  });

  assert.equal(result.payment_status, 'failed');
  assert.equal(result.booking_status, 'pending_payment');
  assert.equal(result.idempotent, true);
});

test('Late payment resolution: completes payment to success, leaves booking as expired, and triggers async late reconciliation', async () => {
  let onLatePaymentCalled = false;
  let confirmArgs = null;

  const repository = createMockRepository({
    async getPaymentWithBooking() {
      return {
        id: paymentId,
        status: 'initiated',
        amount: 490,
        merchantOrderId: 'ORDER-LATE-1',
        booking: {
          id: bookingId,
          status: 'expired', // Late payment scenario
          creditsApplied: 100,
          expiresAt: new Date('2026-06-18T11:50:00.000Z'), // expired 10 mins ago
        },
      };
    },
    async confirmProviderPayment(args) {
      confirmArgs = args;
      return {
        booking: { id: bookingId, status: 'expired' }, // Booking is expired and stays expired
        payment: { id: paymentId, status: 'success' },
      };
    },
  });

  const service = createTestBookingsService({
    repository,
    clock: () => new Date('2026-06-18T12:00:00.000Z'),
  });

  service.onLatePayment = async ({ paymentId: pId, bookingId: bId, amount }) => {
    onLatePaymentCalled = true;
    assert.equal(pId, paymentId);
    assert.equal(bId, bookingId);
    assert.equal(amount, 490);
  };

  const result = await service.handleProviderPaymentEvent({
    merchantOrderId: 'ORDER-LATE-1',
    state: 'COMPLETED',
  });

  assert.equal(result.booking_status, 'expired');
  assert.equal(result.payment_status, 'success');
  assert.equal(confirmArgs.paymentId, paymentId);
  assert.equal(confirmArgs.bookingId, bookingId);
  
  // Wait a small tick to ensure async catch block has finished
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(onLatePaymentCalled);
});

test('Double-wallet-crediting prevention: Reconciliation restoreWalletCredits zero-out applied credits', async () => {
  let updateBookingCreditsCalled = false;
  let userWalletIncrement = 0;

  const txMock = {
    booking: {
      async findUnique() {
        return {
          id: bookingId,
          userId,
          creditsApplied: 100,
          user: { id: userId, walletCredits: 250 },
        };
      },
      async update({ where, data }) {
        if (where.id === bookingId && data.creditsApplied === 0) {
          updateBookingCreditsCalled = true;
        }
      },
    },
    user: {
      async update({ where, data }) {
        if (where.id === userId) {
          userWalletIncrement = data.walletCredits.increment;
          return { id: userId, walletCredits: 350 };
        }
      },
    },
    walletTransaction: {
      async create() {},
    },
  };

  const bookingsRepository = {
    async restoreWalletCredits({ bookingId }) {
      const runTransaction = async (fn) => fn(txMock);
      return runTransaction(async (tx) => {
        const booking = await tx.booking.findUnique({ where: { id: bookingId } });
        const creditsToRestore = Number(booking.creditsApplied);

        if (creditsToRestore > 0) {
          await tx.booking.update({
            where: { id: bookingId },
            data: { creditsApplied: 0 },
          });

          const updatedUser = await tx.user.update({
            where: { id: booking.userId },
            data: { walletCredits: { increment: creditsToRestore } },
          });

          await tx.walletTransaction.create({
            data: {
              userId: booking.userId,
              bookingId,
              type: 'credit_issued',
              amount: creditsToRestore,
              balanceAfter: updatedUser.walletCredits,
              reason: 'Reconciliation refund',
            },
          });

          return { restoredAmount: creditsToRestore, balanceAfter: updatedUser.walletCredits };
        }
        return { restoredAmount: 0, balanceAfter: 250 };
      });
    },
  };

  const bookingsService = {
    async restoreWalletCredits({ bookingId }) {
      return bookingsRepository.restoreWalletCredits({ bookingId });
    },
  };

  const paymentsRepository = {
    async getPayment() {
      return { id: paymentId, status: 'success', amount: 500 };
    },
    async getPaymentByRefundId() {
      return { id: paymentId, status: 'refund_pending' };
    },
    async updatePaymentRefundInitiated() {},
    async updatePaymentRefundSuccess() {},
  };

  const paymentProvider = {
    async refundPayment() {
      return { status: 'SUCCESS' };
    },
  };

  const reconService = createReconciliationService({
    paymentsRepository,
    bookingsService,
    paymentProvider,
    clock: () => new Date(),
  });

  await reconService.reconcileLatePayment({ paymentId, bookingId, amount: 500 });

  assert.ok(updateBookingCreditsCalled);
  assert.equal(userWalletIncrement, 100);
});

test('PaymentsService.refundPayment enforces issue_credits permission check', async () => {
  const mockPayment = {
    id: paymentId,
    status: 'success',
    amount: 500,
    booking: {
      id: bookingId,
      venueId: 'venue-123',
    },
  };

  const mockPaymentsRepo = {
    async getPayment(id) {
      return id === paymentId ? mockPayment : null;
    },
  };

  const mockReconService = {
    async initiateRefund({ paymentId, amount }) {
      return { status: 'refund_pending', paymentId, amount };
    },
  };

  const mockAuthorizationService = {
    async hasPermission({ userId, venueId, permission }) {
      return userId === 'admin-user' && venueId === 'venue-123' && permission === Permissions.ISSUE_CREDITS;
    },
  };

  const service = createPaymentsService({
    repository: mockPaymentsRepo,
    bookingsService: {},
    reconciliationService: mockReconService,
    authorizationService: mockAuthorizationService,
  });

  // 1. Success case: admin-user has permission
  const successResult = await service.refundPayment({
    paymentId,
    amount: 500,
    userId: 'admin-user',
  });
  assert.equal(successResult.status, 'refund_pending');

  // 2. Failure case: other-user lacks permission
  await assert.rejects(
    () => service.refundPayment({
      paymentId,
      amount: 500,
      userId: 'other-user',
    }),
    PermissionDeniedError
  );
});

test('PaymentsService.retryRefund enforces issue_credits permission check', async () => {
  const mockPayment = {
    id: paymentId,
    status: 'success',
    amount: 500,
    booking: {
      id: bookingId,
      venueId: 'venue-123',
    },
  };

  const mockPaymentsRepo = {
    async getPayment(id) {
      return id === paymentId ? mockPayment : null;
    },
  };

  const mockReconService = {
    async retryRefund({ paymentId }) {
      return { status: 'refund_pending', paymentId };
    },
  };

  const mockAuthorizationService = {
    async hasPermission({ userId, venueId, permission }) {
      return userId === 'admin-user' && venueId === 'venue-123' && permission === Permissions.ISSUE_CREDITS;
    },
  };

  const service = createPaymentsService({
    repository: mockPaymentsRepo,
    bookingsService: {},
    reconciliationService: mockReconService,
    authorizationService: mockAuthorizationService,
  });

  // 1. Success case: admin-user has permission
  const successResult = await service.retryRefund({
    paymentId,
    userId: 'admin-user',
  });
  assert.equal(successResult.status, 'refund_pending');

  // 2. Failure case: other-user lacks permission
  await assert.rejects(
    () => service.retryRefund({
      paymentId,
      userId: 'other-user',
    }),
    PermissionDeniedError
  );
});
