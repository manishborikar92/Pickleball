import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import createApp from '../../src/app.js';
import { createNotificationsRouter } from '../../src/modules/notifications/notifications.routes.js';

const userId = '33333333-3333-4333-8333-333333333333';
const venueId = '11111111-1111-4111-8111-111111111111';

const authMiddleware = (req, _res, next) => {
  req.auth = { subject: userId, permissions: ['manage_venues', 'manage_bookings'] };
  next();
};

// Records every permission guard the router builds so tests can assert wiring.
const createPermissionRecorder = () => {
  const calls = [];
  const factory = ({ permission, venueResolver }) => (req, _res, next) => {
    calls.push({ permission, venueId: venueResolver(req) });
    next();
  };
  return { factory, calls };
};

const mountNotifications = ({ notificationsService, requireVenuePermission }) => createApp({
  configureRoutes(router) {
    router.use('/notifications', createNotificationsRouter({
      notificationsService,
      requireVenuePermission,
      authMiddleware,
    }));
  },
});

// ── GET /notifications/settings ────────────────────────────────────────────

test('GET /notifications/settings is gated by manage_venues resolved from the query venue', async () => {
  const notificationsService = {
    async getNotificationSettings(args) {
      assert.deepEqual(args, { venueId });
      return { venue_id: venueId, reminders_enabled: true, review_requests_enabled: false };
    },
  };
  const { factory, calls } = createPermissionRecorder();
  const app = mountNotifications({ notificationsService, requireVenuePermission: factory });

  const response = await request(app).get(`/api/v1/notifications/settings?venue_id=${venueId}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.reminders_enabled, true);
  assert.deepEqual(calls, [{ permission: 'manage_venues', venueId }]);
});

test('GET /notifications/settings rejects a missing venue_id with 400', async () => {
  const notificationsService = { async getNotificationSettings() { throw new Error('should not be called'); } };
  const { factory } = createPermissionRecorder();
  const app = mountNotifications({ notificationsService, requireVenuePermission: factory });

  const response = await request(app).get('/api/v1/notifications/settings');
  assert.equal(response.status, 400);
});

// ── PATCH /notifications/settings ──────────────────────────────────────────

test('PATCH /notifications/settings forwards the toggle update (authorization at route)', async () => {
  const calls = [];
  const notificationsService = {
    async updateNotificationSettings(args) {
      calls.push(args);
      return { venue_id: args.venueId, reminders_enabled: true, review_requests_enabled: true };
    },
  };
  const { factory, calls: permissionCalls } = createPermissionRecorder();
  const app = mountNotifications({ notificationsService, requireVenuePermission: factory });

  const response = await request(app)
    .patch('/api/v1/notifications/settings')
    .send({ venue_id: venueId, reminders_enabled: true, review_requests_enabled: true });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.review_requests_enabled, true);
  assert.deepEqual(calls, [{ userId, venueId, input: { reminders_enabled: true, review_requests_enabled: true } }]);
  assert.deepEqual(permissionCalls, [{ permission: 'manage_venues', venueId }]);
});

test('PATCH /notifications/settings rejects an empty toggle set with 400', async () => {
  const notificationsService = { async updateNotificationSettings() { throw new Error('should not be called'); } };
  const { factory } = createPermissionRecorder();
  const app = mountNotifications({ notificationsService, requireVenuePermission: factory });

  const response = await request(app)
    .patch('/api/v1/notifications/settings')
    .send({ venue_id: venueId });

  assert.equal(response.status, 400);
});

// ── GET /notifications/log ─────────────────────────────────────────────────

test('GET /notifications/log is gated by manage_bookings with a paginated envelope', async () => {
  const notificationsService = {
    async getNotificationLog(args) {
      assert.equal(args.venueId, venueId);
      assert.equal(args.status, 'sent');
      return {
        data: [{ id: 'n1', type: 'reminder_t24', status: 'sent' }],
        pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
        summary: { sent: 1 },
      };
    },
  };
  const { factory, calls } = createPermissionRecorder();
  const app = mountNotifications({ notificationsService, requireVenuePermission: factory });

  const response = await request(app)
    .get(`/api/v1/notifications/log?venue_id=${venueId}&status=sent`);

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ permission: 'manage_bookings', venueId }]);
  assert.deepEqual(response.body.meta.pagination, { page: 1, limit: 20, total: 1, total_pages: 1 });
  assert.deepEqual(response.body.meta.summary, { sent: 1 });
});

test('GET /notifications/log rejects an invalid status filter with 400', async () => {
  const notificationsService = { async getNotificationLog() { throw new Error('should not be called'); } };
  const { factory } = createPermissionRecorder();
  const app = mountNotifications({ notificationsService, requireVenuePermission: factory });

  const response = await request(app).get(`/api/v1/notifications/log?venue_id=${venueId}&status=bogus`);
  assert.equal(response.status, 400);
});

// ── Router wiring guards ───────────────────────────────────────────────────

test('createNotificationsRouter requires its dependencies', async () => {
  const { createNotificationsRouter: factory } = await import('../../src/modules/notifications/notifications.routes.js');
  assert.throws(() => factory({}), /notificationsService is required/);
  assert.throws(() => factory({ notificationsService: {} }), /requireVenuePermission is required/);
});
