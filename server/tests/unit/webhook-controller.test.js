import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { createWebhookController } from '../../src/modules/payments/webhook.controller.js';

const makeReq = (body, authHeader) => ({
  body,
  headers: { authorization: authHeader || '' },
});

const makeRes = () => {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
  };
  return res;
};

test('webhook controller rejects requests with invalid auth', async () => {
  const controller = createWebhookController({
    bookingsService: {},
    reconciliationService: {},
    config: {
      phonepe: {
        webhookUsername: 'testuser',
        webhookPassword: 'testpass',
      },
    },
  });

  const req = makeReq({ type: 'checkout.order.completed' }, 'invalid-hash');
  const res = makeRes();

  await controller.handleWebhook(req, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
});

test('webhook controller accepts valid SHA256 auth and responds 200', async () => {
  const username = 'testuser';
  const password = 'testpass';
  const expectedHash = crypto
    .createHash('sha256')
    .update(`${username}:${password}`)
    .digest('hex');

  const calls = [];
  const controller = createWebhookController({
    bookingsService: {
      async handleProviderPaymentEvent(args) {
        calls.push(args);
      },
    },
    reconciliationService: {},
    config: {
      phonepe: {
        webhookUsername: username,
        webhookPassword: password,
      },
    },
  });

  const req = makeReq(
    {
      type: 'checkout.order.completed',
      payload: { merchantOrderId: 'PP-order-1', state: 'COMPLETED' },
    },
    expectedHash,
  );
  const res = makeRes();

  await controller.handleWebhook(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
});

test('webhook controller routes COMPLETED event to bookingsService', async () => {
  const username = 'u';
  const password = 'p';
  const authHash = crypto.createHash('sha256').update(`${username}:${password}`).digest('hex');

  const calls = [];
  const controller = createWebhookController({
    bookingsService: {
      async handleProviderPaymentEvent(args) {
        calls.push(args);
      },
    },
    reconciliationService: {},
    config: { phonepe: { webhookUsername: username, webhookPassword: password } },
  });

  const req = makeReq(
    {
      type: 'checkout.order.completed',
      payload: { merchantOrderId: 'PP-order-2', state: 'COMPLETED' },
    },
    authHash,
  );
  const res = makeRes();

  await controller.handleWebhook(req, res);

  // Allow async processing to complete.
  await new Promise((resolve) => { setTimeout(resolve, 50); });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].merchantOrderId, 'PP-order-2');
  assert.equal(calls[0].state, 'COMPLETED');
});

test('webhook controller routes FAILED event to bookingsService', async () => {
  const username = 'u';
  const password = 'p';
  const authHash = crypto.createHash('sha256').update(`${username}:${password}`).digest('hex');

  const calls = [];
  const controller = createWebhookController({
    bookingsService: {
      async handleProviderPaymentEvent(args) {
        calls.push(args);
      },
    },
    reconciliationService: {},
    config: { phonepe: { webhookUsername: username, webhookPassword: password } },
  });

  const req = makeReq(
    {
      type: 'checkout.order.failed',
      payload: { merchantOrderId: 'PP-order-3', state: 'FAILED' },
    },
    authHash,
  );
  const res = makeRes();

  await controller.handleWebhook(req, res);

  await new Promise((resolve) => { setTimeout(resolve, 50); });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].merchantOrderId, 'PP-order-3');
  assert.equal(calls[0].state, 'FAILED');
});

test('webhook controller handles processing errors gracefully (post-200)', async () => {
  const username = 'u';
  const password = 'p';
  const authHash = crypto.createHash('sha256').update(`${username}:${password}`).digest('hex');

  const controller = createWebhookController({
    bookingsService: {
      async handleProviderPaymentEvent() {
        throw new Error('DB unavailable');
      },
    },
    reconciliationService: {},
    config: { phonepe: { webhookUsername: username, webhookPassword: password } },
  });

  const req = makeReq(
    {
      type: 'checkout.order.completed',
      payload: { merchantOrderId: 'PP-err', state: 'COMPLETED' },
    },
    authHash,
  );
  const res = makeRes();

  // Should NOT throw — errors are logged, not propagated.
  await controller.handleWebhook(req, res);

  assert.equal(res.statusCode, 200);
});
