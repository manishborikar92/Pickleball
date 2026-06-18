import assert from 'node:assert/strict';
import test from 'node:test';

import { createSandboxPaymentProvider } from '../../src/modules/payments/sandbox-payment.provider.js';

test('sandbox payment provider creates provider-neutral payment orders', async () => {
  const provider = createSandboxPaymentProvider({
    baseUrl: 'http://localhost:5000',
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
  assert.match(order.redirect_url, /\/api\/v1\/payments\/sandbox\/SANDBOX-order-1\/complete/);
});
