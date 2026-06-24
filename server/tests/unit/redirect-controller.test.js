import assert from 'node:assert/strict';
import test from 'node:test';

import { createRedirectController } from '../../src/modules/payments/redirect.controller.js';

const makeReq = (query = {}) => ({ query });

const makeRes = () => {
  const res = {
    redirectUrl: null,
    redirect(url) {
      res.redirectUrl = url;
      return res;
    },
  };
  return res;
};

test('redirect controller redirects to failed page when orderId is missing', async () => {
  const controller = createRedirectController({
    bookingsService: {},
    paymentProvider: {},
    config: { frontendBaseUrl: 'http://localhost:3000' },
  });

  const req = makeReq({});
  const res = makeRes();

  await controller.handleRedirect(req, res);

  assert.ok(res.redirectUrl.includes('/booking/failed'));
  assert.ok(res.redirectUrl.includes('missing_order_id'));
});

test('redirect controller redirects to confirmed page on COMPLETED status', async () => {
  const controller = createRedirectController({
    bookingsService: {
      async handleProviderPaymentEvent() {
        return {};
      },
    },
    paymentProvider: {
      async getPaymentStatus() {
        return 'COMPLETED';
      },
    },
    config: { frontendBaseUrl: 'http://localhost:3000' },
  });

  const req = makeReq({ orderId: 'PP-test-1' });
  const res = makeRes();

  await controller.handleRedirect(req, res);

  assert.ok(res.redirectUrl.includes('/booking/confirmed'));
  assert.ok(res.redirectUrl.includes('orderId=PP-test-1'));
});

test('redirect controller redirects to failed page on FAILED status', async () => {
  const controller = createRedirectController({
    bookingsService: {
      async handleProviderPaymentEvent() {
        return {};
      },
    },
    paymentProvider: {
      async getPaymentStatus() {
        return 'FAILED';
      },
    },
    config: { frontendBaseUrl: 'http://localhost:3000' },
  });

  const req = makeReq({ orderId: 'PP-test-2' });
  const res = makeRes();

  await controller.handleRedirect(req, res);

  assert.ok(res.redirectUrl.includes('/booking/failed'));
});

test('redirect controller redirects to pending page on PENDING status', async () => {
  const controller = createRedirectController({
    bookingsService: {},
    paymentProvider: {
      async getPaymentStatus() {
        return 'PENDING';
      },
    },
    config: { frontendBaseUrl: 'http://localhost:3000' },
  });

  const req = makeReq({ orderId: 'PP-test-3' });
  const res = makeRes();

  await controller.handleRedirect(req, res);

  assert.ok(res.redirectUrl.includes('/booking/pending'));
});

test('redirect controller redirects to pending page on provider error', async () => {
  const controller = createRedirectController({
    bookingsService: {},
    paymentProvider: {
      async getPaymentStatus() {
        throw new Error('PhonePe API timeout');
      },
    },
    config: { frontendBaseUrl: 'http://localhost:3000' },
  });

  const req = makeReq({ orderId: 'PP-test-4' });
  const res = makeRes();

  await controller.handleRedirect(req, res);

  assert.ok(res.redirectUrl.includes('/booking/pending'));
});
