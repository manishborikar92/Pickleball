import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import createApp from '../../src/app.js';
import { createUsersRouter } from '../../src/modules/users/users.routes.js';

const userId = '33333333-3333-4333-8333-333333333333';

const authMiddleware = (req, _res, next) => {
  req.auth = {
    subject: userId,
    permissions: ['view_own_bookings'],
  };
  next();
};

test('user routes expose owner-scoped bookings and wallet summaries', async () => {
  const calls = [];
  const app = createApp({
    configureRoutes(router) {
      router.use('/users', createUsersRouter({
        authMiddleware,
        userService: {
          async getCurrentUser() {
            return { id: userId, permissions: ['view_own_bookings'] };
          },
          async getMyBookings({ userId: bookingUserId, status, page, limit }) {
            calls.push(['bookings', bookingUserId, status, page, limit]);
            return {
              data: [{
                id: 'booking-1',
                status: 'confirmed',
                total_amount: 590,
                venue: { id: 'venue-1', name: 'Besa, Nagpur' },
                court: { id: 'court-1', name: 'Court 1' },
                slot_date: '2026-06-18',
                slot_start_time: '09:00',
                slot_end_time: '10:00',
                has_review: false,
              }],
              pagination: { page, limit, total: 1 },
            };
          },
          async getMyWallet({ userId: walletUserId }) {
            calls.push(['wallet', walletUserId]);
            return {
              balance: 500,
              transactions: [{
                id: 'wallet-1',
                type: 'credit_issued',
                amount: 500,
                balance_after: 500,
                reason: 'Facility cancellation',
                created_at: '2026-06-17T04:00:00.000Z',
              }],
            };
          },
        },
      }));
    },
  });

  const bookings = await request(app)
    .get('/api/v1/users/me/bookings?status=confirmed&page=2&limit=5')
    .set('Authorization', 'Bearer test');

  assert.equal(bookings.status, 200);
  assert.equal(bookings.body.data.data[0].status, 'confirmed');
  assert.deepEqual(bookings.body.data.pagination, { page: 2, limit: 5, total: 1 });

  const wallet = await request(app)
    .get('/api/v1/users/me/wallet')
    .set('Authorization', 'Bearer test');

  assert.equal(wallet.status, 200);
  assert.equal(wallet.body.data.balance, 500);
  assert.deepEqual(calls, [
    ['bookings', userId, 'confirmed', 2, 5],
    ['wallet', userId],
  ]);
});
