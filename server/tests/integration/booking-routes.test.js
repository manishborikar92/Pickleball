import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import createApp from '../../src/app.js';
import { createBookingsRouter } from '../../src/modules/bookings/bookings.routes.js';

const venueId = '11111111-1111-4111-8111-111111111111';
const courtId = '22222222-2222-4222-8222-222222222221';
const userId = '33333333-3333-4333-8333-333333333333';

const authMiddleware = (req, _res, next) => {
  req.auth = {
    subject: userId,
    permissions: ['view_own_bookings'],
  };
  next();
};

const onboardingMiddleware = (_req, _res, next) => next();

test('booking routes expose price preview and protected hold creation', async () => {
  const calls = [];
  const bookingsService = {
    async pricePreview({ input }) {
      calls.push(['preview', input]);
      return {
        court_count: 1,
        slot_count: 1,
        slot_unit_count: 1,
        session_start_time: '09:00',
        session_end_time: '10:00',
        session_duration_mins: 60,
        price_breakdown: { units: [], subtotal: 500, coupon_discount: 0, tax: 0, total: 500 },
      };
    },
    async createHold({ userId: holdUserId, input, requestContext }) {
      calls.push(['hold', holdUserId, input, requestContext.requestId]);
      return {
        booking_id: '44444444-4444-4444-8444-444444444444',
        status: 'pending_payment',
        expires_at: '2026-06-17T04:10:00.000Z',
        price_quote: { total: 500 },
      };
    },
  };
  const app = createApp({
    configureRoutes(router) {
      router.use('/bookings', createBookingsRouter({
        bookingsService,
        authMiddleware,
        onboardingMiddleware,
      }));
    },
  });

  const preview = await request(app)
    .post('/api/v1/bookings/price-preview')
    .send({
      venue_id: venueId,
      court_ids: [courtId],
      slot_date: '2026-06-18',
      slot_start_times: ['09:00'],
      total_amount: 1,
    });

  assert.equal(preview.status, 200);
  assert.equal(preview.body.data.price_breakdown.total, 500);
  assert.equal(calls[0][1].total_amount, undefined);

  const hold = await request(app)
    .post('/api/v1/bookings/hold')
    .set('Authorization', 'Bearer test')
    .send({
      venue_id: venueId,
      court_ids: [courtId],
      slot_date: '2026-06-18',
      slot_start_times: ['09:00'],
    });

  assert.equal(hold.status, 201);
  assert.equal(hold.body.data.booking_id, '44444444-4444-4444-8444-444444444444');
  assert.equal(calls[1][1], userId);
});

test('booking hold validation rejects client supplied totals and malformed dates', async () => {
  const app = createApp({
    configureRoutes(router) {
      router.use('/bookings', createBookingsRouter({
        bookingsService: {
          async createHold() {
            return {};
          },
          async pricePreview() {
            return {};
          },
        },
        authMiddleware,
        onboardingMiddleware,
      }));
    },
  });

  const response = await request(app)
    .post('/api/v1/bookings/hold')
    .send({
      venue_id: venueId,
      court_ids: [courtId],
      slot_date: '18-06-2026',
      slot_start_times: ['09:00'],
      total_amount: 1,
    });

  assert.equal(response.status, 400);
});
