import assert from 'node:assert/strict';
import test from 'node:test';

import { createVerifyController } from '../../src/modules/payments/verify.controller.js';

const makeReq = (query = {}) => ({ query, validated: { query } });

const makeRes = () => {
  const res = {
    jsonBody: null,
    json(body) {
      res.jsonBody = body;
      return res;
    },
  };
  return res;
};

/**
 * Runs the asyncHandler-wrapped verify handler to completion. asyncHandler
 * does not return the handler's promise, so resolve on res.json OR next(err).
 */
const runVerify = (controller, req, res) => new Promise((resolve) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    originalJson(body);
    resolve(null);
    return res;
  };
  controller.handleVerify(req, res, (error) => resolve(error ?? null));
});

test('verify handler returns 404 error for unknown orderId', async () => {
  const controller = createVerifyController({
    bookingsService: {
      async getBookingIdByOrderId() {
        return null;
      },
    },
    paymentProvider: {},
  });

  const req = makeReq({ orderId: 'PP-unknown-1' });
  const res = makeRes();

  const error = await runVerify(controller, req, res);

  assert.equal(error?.statusCode, 404);
  assert.equal(res.jsonBody, null);
});

test('verify handler processes COMPLETED payments and returns JSON', async () => {
  const events = [];
  const controller = createVerifyController({
    bookingsService: {
      async getBookingIdByOrderId() {
        return 'booking-json-1';
      },
      async handleProviderPaymentEvent(event) {
        events.push(event);
        return {
          merchant_order_id: event.merchantOrderId,
          booking_id: 'booking-json-1',
          booking_status: 'confirmed',
          payment_status: 'success',
        };
      },
    },
    paymentProvider: {
      name: 'phonepe',
      async getPaymentStatus() {
        return 'COMPLETED';
      },
    },
  });

  const req = makeReq({ orderId: 'PP-json-1' });
  const res = makeRes();

  const error = await runVerify(controller, req, res);

  assert.equal(error, null);
  assert.equal(res.jsonBody.success, true);
  assert.equal(res.jsonBody.data.booking_id, 'booking-json-1');
  assert.equal(res.jsonBody.data.booking_status, 'confirmed');
  assert.equal(res.jsonBody.data.payment_status, 'success');
  assert.equal(res.jsonBody.data.state, 'COMPLETED');
  assert.equal(events.length, 1);
  assert.equal(events[0].state, 'COMPLETED');
  assert.equal(events[0].payload.source, 'verify');
});

test('verify handler processes FAILED payments and returns JSON', async () => {
  const controller = createVerifyController({
    bookingsService: {
      async getBookingIdByOrderId() {
        return 'booking-json-2';
      },
      async handleProviderPaymentEvent() {
        return {
          merchant_order_id: 'PP-json-2',
          booking_id: 'booking-json-2',
          booking_status: 'pending_payment',
          payment_status: 'failed',
        };
      },
    },
    paymentProvider: {
      name: 'phonepe',
      async getPaymentStatus() {
        return 'FAILED';
      },
    },
  });

  const req = makeReq({ orderId: 'PP-json-2' });
  const res = makeRes();

  await runVerify(controller, req, res);

  assert.equal(res.jsonBody.data.payment_status, 'failed');
  assert.equal(res.jsonBody.data.state, 'FAILED');
});

test('verify handler returns pending state without processing', async () => {
  let processed = false;
  const controller = createVerifyController({
    bookingsService: {
      async getBookingIdByOrderId() {
        return 'booking-json-3';
      },
      async handleProviderPaymentEvent() {
        processed = true;
        return {};
      },
    },
    paymentProvider: {
      name: 'phonepe',
      async getPaymentStatus() {
        return 'PENDING';
      },
    },
  });

  const req = makeReq({ orderId: 'PP-json-3' });
  const res = makeRes();

  await runVerify(controller, req, res);

  assert.equal(processed, false);
  assert.equal(res.jsonBody.data.booking_id, 'booking-json-3');
  assert.equal(res.jsonBody.data.state, 'PENDING');
});

test('verify handler falls back to database truth when the provider fails', async () => {
  const controller = createVerifyController({
    bookingsService: {
      async getBookingIdByOrderId() {
        return 'booking-json-4';
      },
    },
    paymentProvider: {
      name: 'phonepe',
      async getPaymentStatus() {
        throw new Error('PhonePe API timeout');
      },
    },
  });

  const req = makeReq({ orderId: 'PP-json-4' });
  const res = makeRes();

  const error = await runVerify(controller, req, res);

  assert.equal(error, null);
  assert.equal(res.jsonBody.data.booking_id, 'booking-json-4');
  assert.equal(res.jsonBody.data.state, 'UNKNOWN');
});
