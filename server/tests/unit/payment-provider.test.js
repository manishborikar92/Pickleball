import assert from 'node:assert/strict';
import test from 'node:test';

import { createSandboxPaymentProvider } from '../../src/modules/payments/sandbox-payment.provider.js';
import { generateMerchantOrderId } from '../../src/modules/payments/phonepe-payment.provider.js';

test('PhonePe merchant order ids are unique per retry and fit the gateway limit', () => {
  const bookingId = '12345678-90ab-4cde-8f01-23456789abcd';
  const firstAttempt = generateMerchantOrderId(bookingId, () => '0123456789abcdef');
  const retryAttempt = generateMerchantOrderId(bookingId, () => 'fedcba9876543210');

  assert.equal(firstAttempt, 'PP-1234567890ab4c-0123456789abcdef');
  assert.equal(firstAttempt.length, 34);
  assert.match(firstAttempt, /^[A-Za-z0-9-]+$/);
  assert.notEqual(firstAttempt, retryAttempt);
  assert.ok(retryAttempt.length <= 35);
});

test('sandbox payment provider creates provider-neutral payment orders', async () => {
  const provider = createSandboxPaymentProvider({
    frontendBaseUrl: 'http://localhost:3000',
    randomId: () => 'order-1',
  });

  const order = await provider.createPaymentOrder({
    booking: {
      id: '44444444-4444-4444-8444-444444444444',
      userId: '33333333-3333-4333-8333-333333333333',
    },
    amount: 590,
    currency: 'INR',
  });

  assert.equal(order.provider, 'sandbox');
  assert.equal(order.gateway, 'sandbox');
  assert.equal(order.merchant_order_id, 'SANDBOX-order-1');
  assert.equal(order.amount, 590);
  // Post-payment return lands on the frontend /booking/redirect route (the
  // merchantUrls.redirectUrl target) — the backend origin never appears in
  // the customer's browser.
  assert.equal(order.redirect_url, 'http://localhost:3000/booking/redirect?orderId=SANDBOX-order-1');
});
