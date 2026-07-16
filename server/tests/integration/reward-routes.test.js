import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import createApp from '../../src/app.js';
import { createRewardsRouter } from '../../src/modules/rewards/rewards.routes.js';

const userId = '33333333-3333-4333-8333-333333333333';
const venueId = '11111111-1111-4111-8111-111111111111';
const instanceId = '77777777-7777-4777-8777-777777777777';
const mechanismId = '66666666-6666-4666-8666-666666666666';

const authMiddleware = (req, _res, next) => {
  req.auth = { subject: userId, permissions: ['manage_bookings', 'edit_pricing'] };
  next();
};

const onboardingMiddleware = (_req, _res, next) => next();

// Records every permission guard the router builds so tests can assert wiring.
const createPermissionRecorder = () => {
  const calls = [];
  const factory = ({ permission, venueResolver }) => (req, _res, next) => {
    calls.push({ permission, venueId: venueResolver(req) });
    next();
  };
  return { factory, calls };
};

const validMechanismBody = {
  venue_id: venueId,
  name: 'Post-Booking Scratch Card',
  type: 'scratch_card',
  config: {
    card_theme: 'court_green',
    prizes: [
      { id: 'p1', label: 'Better luck next time!', type: 'no_prize', probability: 0.7 },
      { id: 'p2', label: 'Free Iced Coffee', type: 'voucher', terms: 'One per visit.', validity_days: 14, probability: 0.3 },
    ],
  },
};

const mountRewards = ({ rewardsService, requireVenuePermission }) => createApp({
  configureRoutes(router) {
    router.use('/rewards', createRewardsRouter({
      rewardsService,
      requireVenuePermission,
      authMiddleware,
      onboardingMiddleware,
    }));
  },
});

// ── Customer routes ────────────────────────────────────────────────────────

test('GET /rewards/instances returns the caller\'s instances with a success envelope', async () => {
  const calls = [];
  const rewardsService = {
    async getUserInstances(args) {
      calls.push(args);
      return [{ id: instanceId, status: 'pending', mechanism_type: 'scratch_card' }];
    },
  };
  const { factory } = createPermissionRecorder();
  const app = mountRewards({ rewardsService, requireVenuePermission: factory });

  const response = await request(app).get('/api/v1/rewards/instances?status=pending');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.length, 1);
  assert.deepEqual(calls, [{ userId, status: 'pending' }]);
});

test('GET /rewards/instances rejects an invalid status filter with 400', async () => {
  const rewardsService = { async getUserInstances() { throw new Error('should not be called'); } };
  const { factory } = createPermissionRecorder();
  const app = mountRewards({ rewardsService, requireVenuePermission: factory });

  const response = await request(app).get('/api/v1/rewards/instances?status=bogus');
  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
});

test('POST /rewards/instances/:id/reveal returns the outcome and voucher', async () => {
  const calls = [];
  const rewardsService = {
    async revealInstance(args) {
      calls.push(args);
      return {
        instance_id: instanceId,
        mechanism_type: 'scratch_card',
        status: 'revealed',
        outcome: { prize_id: 'p2', label: 'Free Iced Coffee', type: 'voucher' },
        voucher: { code: 'RWD-ABCD2345', redeemed: false },
      };
    },
  };
  const { factory } = createPermissionRecorder();
  const app = mountRewards({ rewardsService, requireVenuePermission: factory });

  const response = await request(app).post(`/api/v1/rewards/instances/${instanceId}/reveal`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.voucher.code, 'RWD-ABCD2345');
  assert.deepEqual(calls, [{ userId, instanceId }]);
});

test('POST /rewards/instances/:id/reveal rejects a malformed id with 400', async () => {
  const rewardsService = { async revealInstance() { throw new Error('should not be called'); } };
  const { factory } = createPermissionRecorder();
  const app = mountRewards({ rewardsService, requireVenuePermission: factory });

  const response = await request(app).post('/api/v1/rewards/instances/not-a-uuid/reveal');
  assert.equal(response.status, 400);
});

test('reveal error codes map through the error handler (404/409/410)', async () => {
  const { AppError, ConflictError, NotFoundError } = await import('../../src/utils/api-error.js');
  const cases = [
    [new NotFoundError('Reward not found', { code: 'REWARD_NOT_FOUND' }), 404],
    [new ConflictError('Already revealed', { code: 'REWARD_ALREADY_REVEALED' }), 409],
    [new AppError('Reward has expired', 410, { code: 'REWARD_EXPIRED' }), 410],
  ];

  for (const [error, expectedStatus] of cases) {
    const rewardsService = { async revealInstance() { throw error; } };
    const { factory } = createPermissionRecorder();
    const app = mountRewards({ rewardsService, requireVenuePermission: factory });

    const response = await request(app).post(`/api/v1/rewards/instances/${instanceId}/reveal`);
    assert.equal(response.status, expectedStatus);
    assert.equal(response.body.success, false);
    assert.equal(response.body.data.code, error.details.code);
  }
});

// ── Mechanism management routes ────────────────────────────────────────────

test('GET /rewards/mechanisms is gated by edit_pricing resolved from the query venue', async () => {
  const rewardsService = {
    async getVenueMechanisms(args) {
      assert.deepEqual(args, { venueId });
      return [];
    },
  };
  const { factory, calls } = createPermissionRecorder();
  const app = mountRewards({ rewardsService, requireVenuePermission: factory });

  const response = await request(app).get(`/api/v1/rewards/mechanisms?venue_id=${venueId}`);

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ permission: 'edit_pricing', venueId }]);
});

test('POST /rewards/mechanisms creates a mechanism with a 201 envelope', async () => {
  const created = [];
  const rewardsService = {
    async createMechanism({ input }) {
      created.push(input);
      return { id: mechanismId, venue_id: input.venue_id, is_active: false };
    },
  };
  const { factory, calls } = createPermissionRecorder();
  const app = mountRewards({ rewardsService, requireVenuePermission: factory });

  const response = await request(app).post('/api/v1/rewards/mechanisms').send(validMechanismBody);

  assert.equal(response.status, 201);
  assert.equal(response.body.data.id, mechanismId);
  assert.deepEqual(calls, [{ permission: 'edit_pricing', venueId }]);
  // Defaults applied by validation
  assert.equal(created[0].trigger_event, 'booking_confirmed');
  assert.equal(created[0].instance_expiry_days, 7);
  assert.equal(created[0].is_active, false);
});

test('POST /rewards/mechanisms rejects probabilities that do not sum to 1.0 with 400', async () => {
  const rewardsService = { async createMechanism() { throw new Error('should not be called'); } };
  const { factory } = createPermissionRecorder();
  const app = mountRewards({ rewardsService, requireVenuePermission: factory });

  const body = {
    ...validMechanismBody,
    config: {
      prizes: [
        { id: 'p1', label: 'Nothing', type: 'no_prize', probability: 0.5 },
        { id: 'p2', label: 'Coffee', type: 'voucher', probability: 0.4 },
      ],
    },
  };
  const response = await request(app).post('/api/v1/rewards/mechanisms').send(body);

  assert.equal(response.status, 400);
  assert.match(JSON.stringify(response.body.data), /sum to exactly 1\.0/);
});

test('POST /rewards/mechanisms rejects voucher fields on non-voucher prizes with 400', async () => {
  const rewardsService = { async createMechanism() { throw new Error('should not be called'); } };
  const { factory } = createPermissionRecorder();
  const app = mountRewards({ rewardsService, requireVenuePermission: factory });

  const body = {
    ...validMechanismBody,
    config: {
      prizes: [
        { id: 'p1', label: 'Nothing', type: 'no_prize', probability: 1, validity_days: 10 },
      ],
    },
  };
  const response = await request(app).post('/api/v1/rewards/mechanisms').send(body);
  assert.equal(response.status, 400);
});

test('PATCH /rewards/mechanisms/:id forwards partial updates (authorization in service)', async () => {
  const calls = [];
  const rewardsService = {
    async updateMechanism(args) {
      calls.push(args);
      return { id: mechanismId, is_active: false };
    },
  };
  const { factory, calls: permissionCalls } = createPermissionRecorder();
  const app = mountRewards({ rewardsService, requireVenuePermission: factory });

  const response = await request(app)
    .patch(`/api/v1/rewards/mechanisms/${mechanismId}`)
    .send({ is_active: false });

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ userId, mechanismId, input: { is_active: false } }]);
  // Venue permission resolved in the service, not the route.
  assert.deepEqual(permissionCalls, []);
});

test('PATCH /rewards/mechanisms/:id rejects an empty body with 400', async () => {
  const rewardsService = { async updateMechanism() { throw new Error('should not be called'); } };
  const { factory } = createPermissionRecorder();
  const app = mountRewards({ rewardsService, requireVenuePermission: factory });

  const response = await request(app).patch(`/api/v1/rewards/mechanisms/${mechanismId}`).send({});
  assert.equal(response.status, 400);
});

// ── Moderation routes ──────────────────────────────────────────────────────

test('GET /rewards/instances/moderation is gated by manage_bookings with paginated envelope', async () => {
  const rewardsService = {
    async getModerationInstances(args) {
      assert.equal(args.venueId, venueId);
      assert.equal(args.redeemed, false);
      return {
        data: [{ id: instanceId, voucher: { code: 'RWD-ABCD2345', redeemed: false } }],
        pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
      };
    },
  };
  const { factory, calls } = createPermissionRecorder();
  const app = mountRewards({ rewardsService, requireVenuePermission: factory });

  const response = await request(app)
    .get(`/api/v1/rewards/instances/moderation?venue_id=${venueId}&redeemed=false`);

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ permission: 'manage_bookings', venueId }]);
  assert.deepEqual(response.body.meta.pagination, { page: 1, limit: 20, total: 1, total_pages: 1 });
});

test('PATCH /rewards/instances/:id/redeem marks a voucher redeemed (authorization in service)', async () => {
  const calls = [];
  const rewardsService = {
    async redeemVoucher(args) {
      calls.push(args);
      return { instance_id: instanceId, voucher_code: 'RWD-ABCD2345', redeemed_at: '2026-07-16T10:00:00.000Z' };
    },
  };
  const { factory } = createPermissionRecorder();
  const app = mountRewards({ rewardsService, requireVenuePermission: factory });

  const response = await request(app)
    .patch(`/api/v1/rewards/instances/${instanceId}/redeem`)
    .send({ note: 'Café counter' });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.voucher_code, 'RWD-ABCD2345');
  assert.deepEqual(calls, [{ userId, instanceId, note: 'Café counter' }]);
});

test('PATCH /rewards/instances/:id/expire expires a pending instance (authorization in service)', async () => {
  const calls = [];
  const rewardsService = {
    async expireInstanceManually(args) {
      calls.push(args);
      return { instance_id: instanceId, status: 'expired' };
    },
  };
  const { factory } = createPermissionRecorder();
  const app = mountRewards({ rewardsService, requireVenuePermission: factory });

  const response = await request(app).patch(`/api/v1/rewards/instances/${instanceId}/expire`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, 'expired');
  assert.deepEqual(calls, [{ userId, instanceId }]);
});

// ── Router wiring guards ───────────────────────────────────────────────────

test('createRewardsRouter requires its dependencies', async () => {
  const { createRewardsRouter: factory } = await import('../../src/modules/rewards/rewards.routes.js');
  assert.throws(() => factory({}), /rewardsService is required/);
  assert.throws(() => factory({ rewardsService: {} }), /requireVenuePermission is required/);
});
