import assert from 'node:assert/strict';
import test from 'node:test';

import { createReconciliationService } from '../../src/modules/payments/reconciliation.service.js';
import { ConflictError } from '../../src/utils/api-error.js';
const bookingId = '44444444-4444-4444-8444-444444444444';
const paymentId = '55555555-5555-5555-8555-555555555555';

function createMocks(overrides = {}) {
  const paymentsRepository = {
    async getPayment(id) {
      return {
        id,
        bookingId,
        status: 'success',
        amount: 500,
        ...overrides.payment,
      };
    },
    async getPaymentByRefundId(refundId) {
      return {
        id: paymentId,
        bookingId,
        status: 'refund_pending',
        merchantRefundId: refundId,
        amount: 500,
      };
    },
    async updatePaymentRefundInitiated(args) {
      overrides.initiatedArgs = args;
      return { id: paymentId, status: 'refund_pending' };
    },
    async updatePaymentRefundSuccess(args) {
      overrides.successArgs = args;
      return { id: paymentId, status: 'refunded' };
    },
    async updatePaymentRefundFailed(args) {
      overrides.failedArgs = args;
      return { id: paymentId, status: 'refund_failed' };
    },
    ...overrides.repository,
  };

  const bookingsService = {
    async restoreWalletCredits(args) {
      overrides.restoredArgs = args;
      return { restoredAmount: 200, balanceAfter: 1000, ...overrides.restoreResult };
    },
    ...overrides.bookingsService,
  };

  const paymentProvider = {
    async refundPayment(args) {
      overrides.providerRefundArgs = args;
      return { status: 'SUCCESS', ...overrides.providerRefundResult };
    },
    ...overrides.provider,
  };

  const service = createReconciliationService({
    paymentsRepository,
    bookingsService,
    paymentProvider,
    clock: () => new Date('2026-06-18T12:00:00.000Z'),
  });

  return { service, overrides };
}

test('reconcileLatePayment restores wallet credits and triggers auto-refund', async () => {
  const { service, overrides } = createMocks({
    payment: { status: 'success', amount: 500 },
  });

  await service.reconcileLatePayment({
    paymentId,
    bookingId,
    amount: 500,
  });
  assert.equal(overrides.restoredArgs.bookingId, bookingId);
  assert.equal(overrides.initiatedArgs.paymentId, paymentId);
  assert.equal(overrides.initiatedArgs.amount, 500);
  assert.equal(overrides.successArgs.paymentId, paymentId);
});

test('initiateRefund rejects non-success/non-failed payments', async () => {
  const { service } = createMocks({
    payment: { status: 'initiated' },
  });

  await assert.rejects(
    () => service.initiateRefund({ paymentId, amount: 500 }),
    ConflictError
  );
});

test('initiateRefund transitions to refund_failed if provider fails', async () => {
  const { service, overrides } = createMocks({
    payment: { status: 'success' },
    providerRefundResult: { status: 'FAILED' },
  });

  const result = await service.initiateRefund({ paymentId, amount: 500 });

  assert.equal(result.status, 'refund_failed');
  assert.ok(overrides.failedArgs);
});

test('retryRefund allowed for refund_failed payments', async () => {
  const { service, overrides } = createMocks({
    payment: { status: 'refund_failed', refundAmount: 500 },
  });

  const result = await service.retryRefund({ paymentId });

  assert.equal(result.status, 'refunded');
  assert.equal(overrides.initiatedArgs.paymentId, paymentId);
  assert.equal(overrides.successArgs.paymentId, paymentId);
});

test('retryRefund rejected for success payments', async () => {
  const { service } = createMocks({
    payment: { status: 'success' },
  });

  await assert.rejects(
    () => service.retryRefund({ paymentId }),
    ConflictError
  );
});

test('initiateRefund passes originalMerchantOrderId and reuse of merchantRefundId on retry', async () => {
  const existingRefundId = 'REFUND-existing-id-123';
  const { service, overrides } = createMocks({
    payment: {
      status: 'refund_failed',
      merchantOrderId: 'PP-original-order-1',
      merchantRefundId: existingRefundId,
      refundAmount: 500,
    },
  });

  const result = await service.retryRefund({ paymentId });

  assert.equal(result.status, 'refunded');
  assert.equal(overrides.providerRefundArgs.originalMerchantOrderId, 'PP-original-order-1');
  assert.equal(overrides.providerRefundArgs.merchantRefundId, existingRefundId);
  assert.equal(overrides.providerRefundArgs.amount, 500);
});

test('initiateRefund defaults to original payment amount when amount is omitted', async () => {
  const { service, overrides } = createMocks({
    payment: {
      status: 'success',
      amount: 750,
      merchantOrderId: 'PP-original-order-2',
    },
  });

  const result = await service.initiateRefund({ paymentId });

  assert.equal(result.status, 'refunded');
  assert.equal(overrides.providerRefundArgs.originalMerchantOrderId, 'PP-original-order-2');
  assert.equal(overrides.providerRefundArgs.amount, 750);
});
