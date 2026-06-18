import assert from 'node:assert/strict';
import test from 'node:test';

import { createBookingsService } from '../../src/modules/bookings/bookings.service.js';
import { AppError } from '../../src/utils/api-error.js';

const userId = '33333333-3333-4333-8333-333333333333';
const bookingId = '44444444-4444-4444-8444-444444444444';

function pendingBooking(overrides = {}) {
  return {
    id: bookingId,
    venueId: '11111111-1111-4111-8111-111111111111',
    userId,
    status: 'pending_payment',
    totalAmount: 590,
    creditsApplied: 0,
    waiverAccepted: true,
    expiresAt: new Date('2026-06-17T04:10:00.000Z'),
    user: { id: userId, walletCredits: 0 },
    payments: [],
    ...overrides,
  };
}

function createService(repositoryOverrides = {}, providerOverrides = {}) {
  return createBookingsService({
    repository: {
      async getBookingForPayment() {
        return pendingBooking();
      },
      async findReusableInitiatedPayment() {
        return null;
      },
      async confirmWalletOnlyPayment() {
        return {
          booking: { id: bookingId, status: 'confirmed', totalAmount: 590, creditsApplied: 590 },
          payment: { id: 'payment-1', gateway: 'wallet', status: 'success' },
        };
      },
      async initiateProviderPayment() {
        return {
          payment: {
            id: 'payment-1',
            merchantOrderId: 'SANDBOX-order-1',
            amount: 390,
            status: 'initiated',
          },
        };
      },
      async getPaymentWithBooking() {
        return {
          id: 'payment-1',
          status: 'initiated',
          amount: 590,
          merchantOrderId: 'SANDBOX-order-1',
          booking: pendingBooking(),
        };
      },
      async confirmProviderPayment() {
        return {
          booking: { id: bookingId, status: 'confirmed' },
          payment: { id: 'payment-1', status: 'success' },
        };
      },
      async failProviderPayment() {
        return {
          booking: { id: bookingId, status: 'pending_payment', creditsApplied: 0 },
          payment: { id: 'payment-1', status: 'failed' },
        };
      },
      ...repositoryOverrides,
    },
    paymentProvider: {
      async createPaymentOrder() {
        return {
          gateway: 'sandbox',
          merchant_order_id: 'SANDBOX-order-1',
          redirect_url: 'http://localhost/pay',
          amount: 390,
        };
      },
      ...providerOverrides,
    },
    availabilityService: { async getAvailability() { return {}; } },
    selectionService: { validateSelection() { return {}; } },
    pricingService: { buildQuote() { return {}; } },
    clock: () => new Date('2026-06-17T04:00:00.000Z'),
  });
}

test('payment initiation requires an accepted waiver', async () => {
  const service = createService({
    async getBookingForPayment() {
      return pendingBooking({ waiverAccepted: false });
    },
  });

  await assert.rejects(() => service.initiatePayment({
    userId,
    bookingId,
    input: { use_wallet_credits: false },
  }), (err) => {
    assert.ok(err instanceof AppError);
    assert.equal(err.statusCode, 422);
    assert.equal(err.details.code, 'WAIVER_REQUIRED');
    return true;
  });
});

test('wallet-only payment confirms booking without provider leakage', async () => {
  const service = createService({
    async getBookingForPayment() {
      return pendingBooking({ user: { id: userId, walletCredits: 1000 } });
    },
  });

  const result = await service.initiatePayment({
    userId,
    bookingId,
    input: { use_wallet_credits: true },
  });

  assert.equal(result.type, 'wallet_only');
  assert.equal(result.booking_id, bookingId);
  assert.equal(result.credits_applied, 590);
  assert.equal(result.phonepe_amount, 0);
});

test('partial wallet payment creates sandbox provider order', async () => {
  const service = createService({
    async getBookingForPayment() {
      return pendingBooking({ user: { id: userId, walletCredits: 200 } });
    },
  });

  const result = await service.initiatePayment({
    userId,
    bookingId,
    input: { use_wallet_credits: true },
  });

  assert.equal(result.type, 'sandbox');
  assert.equal(result.merchant_order_id, 'SANDBOX-order-1');
  assert.equal(result.credits_applied, 200);
  assert.equal(result.phonepe_amount, 390);
});

test('duplicate successful provider callbacks are idempotent', async () => {
  const service = createService({
    async getPaymentWithBooking() {
      return {
        id: 'payment-1',
        status: 'success',
        merchantOrderId: 'SANDBOX-order-1',
        booking: pendingBooking({ status: 'confirmed' }),
      };
    },
  });

  const result = await service.handleProviderPaymentEvent({
    merchantOrderId: 'SANDBOX-order-1',
    state: 'COMPLETED',
  });

  assert.equal(result.booking_status, 'confirmed');
  assert.equal(result.payment_status, 'success');
  assert.equal(result.idempotent, true);
});

test('failed provider callbacks roll wallet credits back once', async () => {
  let failedInput;
  const service = createService({
    async getPaymentWithBooking() {
      return {
        id: 'payment-1',
        status: 'initiated',
        amount: 390,
        merchantOrderId: 'SANDBOX-order-1',
        booking: pendingBooking({ creditsApplied: 200 }),
      };
    },
    async failProviderPayment(input) {
      failedInput = input;
      return {
        booking: { id: bookingId, status: 'pending_payment', creditsApplied: 0 },
        payment: { id: 'payment-1', status: 'failed' },
      };
    },
  });

  const result = await service.handleProviderPaymentEvent({
    merchantOrderId: 'SANDBOX-order-1',
    state: 'FAILED',
  });

  assert.equal(failedInput.rollbackCredits, true);
  assert.equal(result.payment_status, 'failed');
});
