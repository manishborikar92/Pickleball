import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import createApp from '../../src/app.js';
import { ForbiddenError } from '../../src/utils/api-error.js';
import { createBookingsRouter } from '../../src/modules/bookings/bookings.routes.js';
import { createPaymentsRouter } from '../../src/modules/payments/payments.routes.js';

const userId = '33333333-3333-4333-8333-333333333333';
const bookingId = '44444444-4444-4444-8444-444444444444';

const authMiddleware = (req, _res, next) => {
  req.auth = {
    subject: userId,
    permissions: ['view_own_bookings'],
  };
  next();
};

const onboardingMiddleware = (_req, _res, next) => next();

test('booking routes record waiver and initiate payment through services', async () => {
  const calls = [];
  const app = createApp({
    configureRoutes(router) {
      router.use('/bookings', createBookingsRouter({
        authMiddleware,
        onboardingMiddleware,
        bookingsService: {
          async acceptWaiver({ userId: waiverUserId, bookingId: waiverBookingId, input, requestContext }) {
            calls.push(['waiver', waiverUserId, waiverBookingId, input, requestContext.ipAddress]);
            return {
              waiver_accepted: true,
              waiver_accepted_at: '2026-06-17T04:02:00.000Z',
            };
          },
          async initiatePayment({ userId: paymentUserId, bookingId: paymentBookingId, input }) {
            calls.push(['payment', paymentUserId, paymentBookingId, input]);
            return {
              type: 'phonepe',
              booking_id: paymentBookingId,
              merchant_order_id: 'PP-order-1',
              redirect_url: 'https://mercury.phonepe.com/transact/PP-order-1',
              credits_applied: 200,
              phonepe_amount: 390,
              total_amount: 590,
            };
          },
        },
      }));
    },
  });

  const waiver = await request(app)
    .post(`/api/v1/bookings/${bookingId}/waiver`)
    .set('Authorization', 'Bearer test')
    .send({ time_acknowledged: true, policy_accepted: true });

  assert.equal(waiver.status, 200);
  assert.equal(waiver.body.data.waiver_accepted, true);

  const payment = await request(app)
    .post(`/api/v1/bookings/${bookingId}/initiate-payment`)
    .set('Authorization', 'Bearer test')
    .send({ use_wallet_credits: true });

  assert.equal(payment.status, 200);
  assert.equal(payment.body.data.type, 'phonepe');
  assert.equal(payment.body.data.phonepe_amount, 390);
  assert.deepEqual(calls.map(([name]) => name), ['waiver', 'payment']);
});

test('payment routes expose protected status endpoint', async () => {
  const calls = [];
  const app = createApp({
    configureRoutes(router) {
      router.use('/payments', createPaymentsRouter({
        authMiddleware,
        onboardingMiddleware,
        paymentsService: {
          async getPaymentStatus({ userId: statusUserId, merchantOrderId }) {
            calls.push(['status', statusUserId, merchantOrderId]);
            return {
              merchant_order_id: merchantOrderId,
              booking_id: bookingId,
              booking_status: 'pending_payment',
              payment_status: 'initiated',
            };
          },
        },
      }));
    },
  });

  const status = await request(app)
    .get('/api/v1/payments/status/PP-order-1')
    .set('Authorization', 'Bearer test');

  assert.equal(status.status, 200);
  assert.equal(status.body.data.payment_status, 'initiated');
  assert.deepEqual(calls.map(([name]) => name), ['status']);
});

test('payment routes expose refund and retry refund endpoints', async () => {
  const calls = [];
  const app = createApp({
    configureRoutes(router) {
      router.use('/payments', createPaymentsRouter({
        authMiddleware,
        onboardingMiddleware,
        paymentsService: {
          async refundPayment({ paymentId, amount }) {
            calls.push(['refund', paymentId, amount]);
            return {
              status: 'refund_pending',
              paymentId,
              amount,
            };
          },
          async retryRefund({ paymentId }) {
            calls.push(['retry', paymentId]);
            return {
              status: 'refund_pending',
              paymentId,
            };
          },
        },
      }));
    },
  });

  const paymentId = '55555555-5555-5555-8555-555555555555';

  // 1. Post to refund route
  const refundRes = await request(app)
    .post(`/api/v1/payments/${paymentId}/refund`)
    .set('Authorization', 'Bearer test')
    .send({ amount: 300 });

  assert.equal(refundRes.status, 200);
  assert.equal(refundRes.body.data.status, 'refund_pending');
  assert.equal(refundRes.body.data.paymentId, paymentId);

  // 2. Post to refund retry route
  const retryRes = await request(app)
    .post(`/api/v1/payments/${paymentId}/refund/retry`)
    .set('Authorization', 'Bearer test');

  assert.equal(retryRes.status, 200);
  assert.equal(retryRes.body.data.status, 'refund_pending');
  assert.equal(retryRes.body.data.paymentId, paymentId);

  assert.deepEqual(calls, [
    ['refund', paymentId, 300],
    ['retry', paymentId],
  ]);
});

test('payment verify route verifies orders and returns JSON (public)', async () => {
  const events = [];
  const app = createApp({
    configureRoutes(router) {
      router.use('/payments', createPaymentsRouter({
        authMiddleware,
        onboardingMiddleware,
        paymentsService: {},
        bookingsService: {
          async getBookingIdByOrderId(orderId) {
            return orderId === 'PP-order-known' ? bookingId : null;
          },
          async handleProviderPaymentEvent(event) {
            events.push(event);
            return {
              merchant_order_id: event.merchantOrderId,
              booking_id: bookingId,
              booking_status: 'confirmed',
              payment_status: 'success',
            };
          },
        },
        paymentProvider: {
          name: 'sandbox',
          async getPaymentStatus() {
            return 'COMPLETED';
          },
        },
      }));
    },
  });

  // No Authorization header — the verify endpoint is public by design.
  const verified = await request(app)
    .get('/api/v1/payments/verify')
    .query({ orderId: 'PP-order-known' });

  assert.equal(verified.status, 200);
  assert.equal(verified.body.data.booking_id, bookingId);
  assert.equal(verified.body.data.booking_status, 'confirmed');
  assert.equal(verified.body.data.state, 'COMPLETED');
  assert.equal(events.length, 1);
  assert.equal(events[0].payload.source, 'verify');

  const unknown = await request(app)
    .get('/api/v1/payments/verify')
    .query({ orderId: 'PP-order-unknown' });

  assert.equal(unknown.status, 404);

  const missing = await request(app)
    .get('/api/v1/payments/verify');

  assert.equal(missing.status, 400);
});

test('payment routes reject un-onboarded users on status endpoint', async () => {
  const app = createApp({
    configureRoutes(router) {
      router.use('/payments', createPaymentsRouter({
        authMiddleware,
        onboardingMiddleware: (_req, _res, next) => {
          next(new ForbiddenError('Onboarding incomplete', { code: 'ONBOARDING_INCOMPLETE' }));
        },
        paymentsService: {
          async getPaymentStatus() {
            return {};
          },
        },
      }));
    },
  });

  const res = await request(app)
    .get('/api/v1/payments/status/SANDBOX-order-1')
    .set('Authorization', 'Bearer test');

  assert.equal(res.status, 403);
});

