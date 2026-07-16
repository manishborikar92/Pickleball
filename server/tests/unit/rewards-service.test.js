import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createRewardIssuanceService,
  createRewardsService,
  drawPrize,
} from '../../src/modules/rewards/rewards.service.js';

const userId = '33333333-3333-4333-8333-333333333333';
const otherUserId = '99999999-9999-4999-8999-999999999999';
const bookingId = '44444444-4444-4444-8444-444444444444';
const venueId = '11111111-1111-4111-8111-111111111111';
const mechanismId = '66666666-6666-4666-8666-666666666666';
const instanceId = '77777777-7777-4777-8777-777777777777';

const NOW = new Date('2026-07-16T10:00:00.000Z');
const FUTURE = new Date('2026-07-20T10:00:00.000Z');
const PAST = new Date('2026-07-10T10:00:00.000Z');

const silentLogger = { info: () => {}, warn: () => {}, error: () => {} };

const scratchConfig = {
  card_theme: 'court_green',
  prizes: [
    { id: 'p1', label: 'Better luck next time!', type: 'no_prize', probability: 0.6 },
    { id: 'p2', label: 'Free Iced Coffee at the Baseline Café', type: 'voucher', terms: 'One per visit.', validity_days: 14, probability: 0.3 },
    { id: 'p3', label: '20% Off Any Snack Combo', type: 'voucher', probability: 0.1 },
  ],
};

const voucherOutcome = {
  prize_id: 'p2',
  label: 'Free Iced Coffee at the Baseline Café',
  type: 'voucher',
  terms: 'One per visit.',
  validity_days: 14,
};

const mechanism = {
  id: mechanismId,
  venueId,
  name: 'Post-Booking Scratch Card',
  type: 'scratch_card',
  triggerEvent: 'booking_confirmed',
  config: scratchConfig,
  instanceExpiryDays: 7,
  isActive: true,
};

const pendingInstance = (overrides = {}) => ({
  id: instanceId,
  mechanismId,
  mechanismType: 'scratch_card',
  userId,
  bookingId,
  status: 'pending',
  configSnapshot: scratchConfig,
  outcome: voucherOutcome,
  prizeType: 'voucher',
  revealedAt: null,
  expiresAt: FUTURE,
  voucherCode: null,
  voucherValidUntil: null,
  redeemedAt: null,
  redemptionNote: null,
  createdAt: PAST,
  mechanism: { name: 'Post-Booking Scratch Card', venueId },
  booking: { id: bookingId, slotDate: PAST },
  ...overrides,
});

const revealedVoucher = (overrides = {}) => pendingInstance({
  status: 'revealed',
  revealedAt: PAST,
  voucherCode: 'RWD-ABCD2345',
  voucherValidUntil: FUTURE,
  ...overrides,
});

const stubRepository = (overrides = {}) => ({
  findActiveMechanisms: async () => [],
  createInstance: async ({ data }) => ({ id: instanceId, ...data }),
  getUserInstances: async () => [],
  getInstanceById: async () => null,
  revealInstance: async () => ({ claimed: false }),
  redeemVoucher: async () => ({ count: 0 }),
  sweepExpiredInstances: async () => ({ count: 0 }),
  expireInstance: async () => ({ count: 0 }),
  getVenueMechanisms: async () => [],
  getMechanismById: async () => null,
  createMechanism: async ({ data }) => ({ id: mechanismId, ...data }),
  updateMechanism: async () => ({}),
  venueExists: async () => true,
  getModerationInstances: async () => ({ instances: [], total: 0 }),
  ...overrides,
});

// Drives the repository.revealInstance contract the way the real transaction
// does: claim the pending row, then apply the voucher stamp.
const revealHarness = (instance) => async ({ now, voucher }) => ({
  claimed: true,
  instance: {
    ...instance,
    status: 'revealed',
    revealedAt: now,
    ...(voucher
      ? { voucherCode: voucher.code, voucherValidUntil: voucher.validUntil, outcome: voucher.outcome }
      : {}),
  },
});

const makeService = (repository, extra = {}) =>
  createRewardsService({ repository, clock: () => NOW, logger: silentLogger, ...extra });

// ── Weighted draw ─────────────────────────────────────────────────────────

test('drawPrize maps the roll onto cumulative probability bands', () => {
  const prizes = scratchConfig.prizes;
  assert.equal(drawPrize(prizes, () => 0).id, 'p1');
  assert.equal(drawPrize(prizes, () => 0.5999).id, 'p1');
  assert.equal(drawPrize(prizes, () => 0.6).id, 'p2');
  assert.equal(drawPrize(prizes, () => 0.8999).id, 'p2');
  assert.equal(drawPrize(prizes, () => 0.9).id, 'p3');
  assert.equal(drawPrize(prizes, () => 0.999999).id, 'p3');
});

test('drawPrize falls through to the last prize on float drift', () => {
  const prizes = [
    { id: 'a', probability: 0.5 },
    { id: 'b', probability: 0.49999999999 },
  ];
  assert.equal(drawPrize(prizes, () => 0.9999999999999).id, 'b');
});

// ── Issuance ──────────────────────────────────────────────────────────────

test('issuance creates one pending instance per active mechanism with snapshot and expiry', async () => {
  const created = [];
  const repository = stubRepository({
    findActiveMechanisms: async ({ venueId: v, triggerEvent }) => {
      assert.equal(v, venueId);
      assert.equal(triggerEvent, 'booking_confirmed');
      return [mechanism];
    },
    createInstance: async ({ data }) => {
      created.push(data);
      return { id: instanceId, ...data };
    },
  });
  const issuance = createRewardIssuanceService({
    repository,
    rng: () => 0.7, // lands on p2 (voucher)
    logger: silentLogger,
  });

  const issued = await issuance.issueForBooking({
    tx: {},
    booking: { id: bookingId, userId, venueId },
    now: NOW,
  });

  assert.equal(issued.length, 1);
  const data = created[0];
  assert.equal(data.status, 'pending');
  assert.equal(data.mechanismId, mechanismId);
  assert.equal(data.mechanismType, 'scratch_card');
  assert.equal(data.prizeType, 'voucher');
  assert.deepEqual(data.configSnapshot, scratchConfig);
  assert.deepEqual(data.outcome, voucherOutcome);
  // No voucher code at issuance — it materializes at reveal.
  assert.equal(data.voucherCode, undefined);
  // expires_at = now + instance_expiry_days
  assert.equal(data.expiresAt.getTime(), NOW.getTime() + 7 * 24 * 60 * 60 * 1000);
});

test('issuance is a no-op when no mechanisms are active', async () => {
  const issuance = createRewardIssuanceService({ repository: stubRepository(), logger: silentLogger });
  const issued = await issuance.issueForBooking({ tx: {}, booking: { id: bookingId, userId, venueId }, now: NOW });
  assert.deepEqual(issued, []);
});

test('issuance skips duplicates on unique-constraint conflict (idempotent confirm)', async () => {
  const repository = stubRepository({
    findActiveMechanisms: async () => [mechanism],
    createInstance: async () => {
      const error = new Error('duplicate');
      error.code = 'P2002';
      throw error;
    },
  });
  const issuance = createRewardIssuanceService({ repository, logger: silentLogger });

  const issued = await issuance.issueForBooking({ tx: {}, booking: { id: bookingId, userId, venueId }, now: NOW });
  assert.deepEqual(issued, []);
});

test('issuance propagates non-duplicate database errors (rolls back confirmation)', async () => {
  const repository = stubRepository({
    findActiveMechanisms: async () => [mechanism],
    createInstance: async () => {
      throw new Error('connection lost');
    },
  });
  const issuance = createRewardIssuanceService({ repository, logger: silentLogger });

  await assert.rejects(
    issuance.issueForBooking({ tx: {}, booking: { id: bookingId, userId, venueId }, now: NOW }),
    /connection lost/
  );
});

// ── Customer listing ──────────────────────────────────────────────────────

test('getUserInstances hides the outcome for pending instances and exposes voucher detail for revealed', async () => {
  const repository = stubRepository({
    getUserInstances: async () => [
      pendingInstance(),
      revealedVoucher({ id: '11111111-2222-4333-8444-555555555555' }),
    ],
  });
  const service = makeService(repository);

  const result = await service.getUserInstances({ userId });

  assert.equal(result.length, 2);
  const [pending, past] = result;
  assert.equal(pending.status, 'pending');
  assert.equal(pending.outcome, undefined);
  assert.equal(pending.voucher, undefined);
  assert.equal(pending.card_theme, 'court_green');
  assert.equal(past.status, 'revealed');
  assert.deepEqual(past.outcome, {
    prize_id: 'p2',
    label: 'Free Iced Coffee at the Baseline Café',
    type: 'voucher',
    terms: 'One per visit.',
  });
  assert.deepEqual(past.voucher, {
    code: 'RWD-ABCD2345',
    valid_until: FUTURE,
    redeemed: false,
  });
});

test('getInstance returns 404 for another user\'s instance', async () => {
  const repository = stubRepository({
    getInstanceById: async () => pendingInstance({ userId: otherUserId }),
  });
  const service = makeService(repository);

  await assert.rejects(service.getInstance({ userId, instanceId }), (error) => {
    assert.equal(error.statusCode, 404);
    return true;
  });
});

// ── Reveal state machine ──────────────────────────────────────────────────

test('reveal rejects a missing instance with 404 REWARD_NOT_FOUND', async () => {
  const service = makeService(stubRepository());
  await assert.rejects(service.revealInstance({ userId, instanceId }), (error) => {
    assert.equal(error.statusCode, 404);
    assert.equal(error.details.code, 'REWARD_NOT_FOUND');
    return true;
  });
});

test('reveal rejects a non-owner with 404 (existence never leaked)', async () => {
  const repository = stubRepository({
    getInstanceById: async () => pendingInstance({ userId: otherUserId }),
  });
  const service = makeService(repository);
  await assert.rejects(service.revealInstance({ userId, instanceId }), (error) => {
    assert.equal(error.statusCode, 404);
    assert.equal(error.details.code, 'REWARD_NOT_FOUND');
    return true;
  });
});

test('reveal rejects an already-revealed instance with 409 REWARD_ALREADY_REVEALED', async () => {
  const repository = stubRepository({
    getInstanceById: async () => revealedVoucher(),
  });
  const service = makeService(repository);
  await assert.rejects(service.revealInstance({ userId, instanceId }), (error) => {
    assert.equal(error.statusCode, 409);
    assert.equal(error.details.code, 'REWARD_ALREADY_REVEALED');
    return true;
  });
});

test('reveal rejects an expired instance with 410 REWARD_EXPIRED', async () => {
  const repository = stubRepository({
    getInstanceById: async () => pendingInstance({ status: 'expired' }),
  });
  const service = makeService(repository);
  await assert.rejects(service.revealInstance({ userId, instanceId }), (error) => {
    assert.equal(error.statusCode, 410);
    assert.equal(error.details.code, 'REWARD_EXPIRED');
    return true;
  });
});

test('reveal lazily expires a pending instance past its expiry before the sweeper ran', async () => {
  const expired = [];
  const repository = stubRepository({
    getInstanceById: async () => pendingInstance({ expiresAt: PAST }),
    expireInstance: async ({ instanceId: id }) => {
      expired.push(id);
      return { count: 1 };
    },
  });
  const service = makeService(repository);
  await assert.rejects(service.revealInstance({ userId, instanceId }), (error) => {
    assert.equal(error.statusCode, 410);
    assert.equal(error.details.code, 'REWARD_EXPIRED');
    return true;
  });
  assert.deepEqual(expired, [instanceId]);
});

test('reveal reports 409 when a concurrent reveal wins the status-guard race', async () => {
  const repository = stubRepository({
    getInstanceById: async () => pendingInstance(),
    revealInstance: async () => ({ claimed: false }),
  });
  const service = makeService(repository);
  await assert.rejects(service.revealInstance({ userId, instanceId }), (error) => {
    assert.equal(error.statusCode, 409);
    assert.equal(error.details.code, 'REWARD_ALREADY_REVEALED');
    return true;
  });
});

// ── Reveal outcomes ───────────────────────────────────────────────────────

test('revealing a no_prize outcome returns the outcome with no voucher', async () => {
  const instance = pendingInstance({
    outcome: { prize_id: 'p1', label: 'Better luck next time!', type: 'no_prize' },
    prizeType: 'no_prize',
  });
  const repository = stubRepository({
    getInstanceById: async () => instance,
    revealInstance: revealHarness(instance),
  });
  const service = makeService(repository);

  const result = await service.revealInstance({ userId, instanceId });

  assert.equal(result.status, 'revealed');
  assert.deepEqual(result.outcome, { prize_id: 'p1', label: 'Better luck next time!', type: 'no_prize' });
  assert.equal(result.voucher, undefined);
});

test('revealing a voucher outcome issues a unique code with the prize validity window', async () => {
  const instance = pendingInstance();
  const vouchers = [];
  const repository = stubRepository({
    getInstanceById: async () => instance,
    revealInstance: async (args) => {
      vouchers.push(args.voucher);
      return revealHarness(instance)(args);
    },
  });
  const service = makeService(repository, { rng: () => 0.5 });

  const result = await service.revealInstance({ userId, instanceId });

  assert.equal(vouchers.length, 1);
  assert.match(vouchers[0].code, /^RWD-[A-Z2-9]{8}$/);
  // validity_days: 14 from the prize outcome
  assert.equal(vouchers[0].validUntil.getTime(), NOW.getTime() + 14 * 24 * 60 * 60 * 1000);
  assert.equal(result.status, 'revealed');
  assert.equal(result.voucher.code, vouchers[0].code);
  assert.equal(result.voucher.redeemed, false);
  assert.deepEqual(result.outcome, {
    prize_id: 'p2',
    label: 'Free Iced Coffee at the Baseline Café',
    type: 'voucher',
    terms: 'One per visit.',
  });
});

test('a voucher prize without validity_days uses the 30-day default window', async () => {
  const instance = pendingInstance({
    outcome: { prize_id: 'p3', label: '20% Off Any Snack Combo', type: 'voucher' },
  });
  const vouchers = [];
  const repository = stubRepository({
    getInstanceById: async () => instance,
    revealInstance: async (args) => {
      vouchers.push(args.voucher);
      return revealHarness(instance)(args);
    },
  });
  const service = makeService(repository);

  await service.revealInstance({ userId, instanceId });

  assert.equal(vouchers[0].validUntil.getTime(), NOW.getTime() + 30 * 24 * 60 * 60 * 1000);
});

test('reveal retries on voucher-code collision and succeeds', async () => {
  const instance = pendingInstance();
  let calls = 0;
  const repository = stubRepository({
    getInstanceById: async () => instance,
    revealInstance: async (args) => {
      calls++;
      if (calls === 1) {
        const error = new Error('duplicate voucher code');
        error.code = 'P2002';
        throw error;
      }
      return revealHarness(instance)(args);
    },
  });
  const service = makeService(repository);

  const result = await service.revealInstance({ userId, instanceId });
  assert.equal(calls, 2);
  assert.equal(result.status, 'revealed');
});

test('a reveal transaction failure propagates so the instance stays pending', async () => {
  const instance = pendingInstance();
  const repository = stubRepository({
    getInstanceById: async () => instance,
    revealInstance: async () => {
      throw new Error('transaction aborted');
    },
  });
  const service = makeService(repository);

  await assert.rejects(service.revealInstance({ userId, instanceId }), /transaction aborted/);
});

// ── Voucher redemption ────────────────────────────────────────────────────

test('redeemVoucher marks a revealed voucher redeemed for authorized staff', async () => {
  const redeemed = [];
  const repository = stubRepository({
    getInstanceById: async () => revealedVoucher(),
    redeemVoucher: async ({ instanceId: id, now, note }) => {
      redeemed.push({ id, now, note });
      return { count: 1 };
    },
  });
  const authorizationService = {
    hasPermission: async ({ permission, venueId: v }) => {
      assert.equal(permission, 'manage_bookings');
      assert.equal(v, venueId);
      return true;
    },
  };
  const service = makeService(repository, { authorizationService });

  const result = await service.redeemVoucher({ userId, instanceId, note: 'Café counter' });

  assert.deepEqual(redeemed, [{ id: instanceId, now: NOW, note: 'Café counter' }]);
  assert.equal(result.voucher_code, 'RWD-ABCD2345');
  assert.equal(result.redeemed_at, NOW);
  assert.equal(result.redemption_note, 'Café counter');
});

test('redeemVoucher denies staff without manage_bookings on the venue via 404', async () => {
  const repository = stubRepository({
    getInstanceById: async () => revealedVoucher(),
  });
  const authorizationService = { hasPermission: async () => false };
  const service = makeService(repository, { authorizationService });

  await assert.rejects(service.redeemVoucher({ userId, instanceId }), (error) => {
    assert.equal(error.statusCode, 404);
    return true;
  });
});

test('redeemVoucher rejects a pending (unrevealed) instance with 409', async () => {
  const repository = stubRepository({
    getInstanceById: async () => pendingInstance(),
  });
  const service = makeService(repository, { authorizationService: { hasPermission: async () => true } });

  await assert.rejects(service.redeemVoucher({ userId, instanceId }), (error) => {
    assert.equal(error.statusCode, 409);
    assert.equal(error.details.code, 'VOUCHER_NOT_REDEEMABLE');
    return true;
  });
});

test('redeemVoucher rejects a no_prize instance with 409 (nothing to redeem)', async () => {
  const repository = stubRepository({
    getInstanceById: async () => revealedVoucher({
      prizeType: 'no_prize',
      voucherCode: null,
      voucherValidUntil: null,
      outcome: { prize_id: 'p1', label: 'Better luck next time!', type: 'no_prize' },
    }),
  });
  const service = makeService(repository, { authorizationService: { hasPermission: async () => true } });

  await assert.rejects(service.redeemVoucher({ userId, instanceId }), (error) => {
    assert.equal(error.statusCode, 409);
    assert.equal(error.details.code, 'VOUCHER_NOT_REDEEMABLE');
    return true;
  });
});

test('redeemVoucher rejects an already-redeemed voucher with 409', async () => {
  const repository = stubRepository({
    getInstanceById: async () => revealedVoucher({ redeemedAt: PAST }),
  });
  const service = makeService(repository, { authorizationService: { hasPermission: async () => true } });

  await assert.rejects(service.redeemVoucher({ userId, instanceId }), (error) => {
    assert.equal(error.statusCode, 409);
    assert.equal(error.details.code, 'VOUCHER_ALREADY_REDEEMED');
    return true;
  });
});

test('redeemVoucher rejects a voucher past its validity window with 410', async () => {
  const repository = stubRepository({
    getInstanceById: async () => revealedVoucher({ voucherValidUntil: PAST }),
  });
  const service = makeService(repository, { authorizationService: { hasPermission: async () => true } });

  await assert.rejects(service.redeemVoucher({ userId, instanceId }), (error) => {
    assert.equal(error.statusCode, 410);
    assert.equal(error.details.code, 'VOUCHER_EXPIRED');
    return true;
  });
});

test('redeemVoucher reports 409 when a concurrent redemption wins the guard race', async () => {
  const repository = stubRepository({
    getInstanceById: async () => revealedVoucher(),
    redeemVoucher: async () => ({ count: 0 }),
  });
  const service = makeService(repository, { authorizationService: { hasPermission: async () => true } });

  await assert.rejects(service.redeemVoucher({ userId, instanceId }), (error) => {
    assert.equal(error.statusCode, 409);
    assert.equal(error.details.code, 'VOUCHER_ALREADY_REDEEMED');
    return true;
  });
});

// ── Sweeper ───────────────────────────────────────────────────────────────

test('sweepExpiredInstances reports the number of expired instances', async () => {
  const swept = [];
  const repository = stubRepository({
    sweepExpiredInstances: async ({ now, limit }) => {
      swept.push({ now, limit });
      return { count: 3 };
    },
  });
  const service = makeService(repository);

  const result = await service.sweepExpiredInstances();

  assert.deepEqual(result, { expired_count: 3 });
  assert.equal(swept[0].now, NOW);
  assert.equal(swept[0].limit, 100);
});

// ── Mechanism management ──────────────────────────────────────────────────

test('createMechanism rejects an unknown venue with 404', async () => {
  const repository = stubRepository({ venueExists: async () => false });
  const service = makeService(repository);

  await assert.rejects(
    service.createMechanism({ input: { venue_id: venueId, name: 'X', type: 'scratch_card', trigger_event: 'booking_confirmed', instance_expiry_days: 7, is_active: false, config: scratchConfig } }),
    (error) => {
      assert.equal(error.statusCode, 404);
      return true;
    }
  );
});

test('createMechanism persists and serializes a valid mechanism', async () => {
  const repository = stubRepository({
    createMechanism: async ({ data }) => ({
      id: mechanismId,
      ...data,
      createdAt: NOW,
      updatedAt: NOW,
    }),
  });
  const service = makeService(repository);

  const result = await service.createMechanism({
    input: {
      venue_id: venueId,
      name: 'Post-Booking Scratch Card',
      type: 'scratch_card',
      trigger_event: 'booking_confirmed',
      instance_expiry_days: 7,
      is_active: true,
      config: scratchConfig,
    },
  });

  assert.equal(result.id, mechanismId);
  assert.equal(result.venue_id, venueId);
  assert.equal(result.type, 'scratch_card');
  assert.equal(result.is_active, true);
  assert.deepEqual(result.config, scratchConfig);
});

test('updateMechanism denies a caller without edit_pricing on the mechanism\'s venue via 404', async () => {
  const repository = stubRepository({
    getMechanismById: async () => ({ ...mechanism, venueId }),
  });
  const authorizationService = { hasPermission: async () => false };
  const service = makeService(repository, { authorizationService });

  await assert.rejects(
    service.updateMechanism({ userId, mechanismId, input: { is_active: false } }),
    (error) => {
      assert.equal(error.statusCode, 404);
      return true;
    }
  );
});

test('updateMechanism applies partial edits for an authorized caller', async () => {
  const updates = [];
  const repository = stubRepository({
    getMechanismById: async () => ({ ...mechanism, venueId }),
    updateMechanism: async ({ data }) => {
      updates.push(data);
      return { ...mechanism, ...data, createdAt: NOW, updatedAt: NOW };
    },
  });
  const authorizationService = {
    hasPermission: async ({ permission, venueId: v }) => {
      assert.equal(permission, 'edit_pricing');
      assert.equal(v, venueId);
      return true;
    },
  };
  const service = makeService(repository, { authorizationService });

  const result = await service.updateMechanism({ userId, mechanismId, input: { is_active: false } });

  assert.deepEqual(updates, [{ isActive: false }]);
  assert.equal(result.is_active, false);
});

// ── Moderation ────────────────────────────────────────────────────────────

test('getModerationInstances exposes outcome, voucher, and user detail with pagination', async () => {
  const repository = stubRepository({
    getModerationInstances: async () => ({
      instances: [revealedVoucher({ user: { id: userId, name: 'Asha', phone: '+919876543210' } })],
      total: 1,
    }),
  });
  const service = makeService(repository);

  const result = await service.getModerationInstances({ venueId, page: 1, limit: 20 });

  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].voucher.code, 'RWD-ABCD2345');
  assert.equal(result.data[0].user.phone, '+919876543210');
  assert.deepEqual(result.pagination, { page: 1, limit: 20, total: 1, total_pages: 1 });
});

test('expireInstanceManually rejects a revealed instance with 409', async () => {
  const repository = stubRepository({
    getInstanceById: async () => revealedVoucher(),
    expireInstance: async () => ({ count: 0 }),
  });
  const service = makeService(repository, { authorizationService: { hasPermission: async () => true } });

  await assert.rejects(service.expireInstanceManually({ userId, instanceId }), (error) => {
    assert.equal(error.statusCode, 409);
    return true;
  });
});

test('expireInstanceManually expires a pending instance for an authorized manager', async () => {
  const repository = stubRepository({
    getInstanceById: async () => pendingInstance(),
    expireInstance: async () => ({ count: 1 }),
  });
  const authorizationService = {
    hasPermission: async ({ permission }) => {
      assert.equal(permission, 'manage_bookings');
      return true;
    },
  };
  const service = makeService(repository, { authorizationService });

  const result = await service.expireInstanceManually({ userId, instanceId });
  assert.deepEqual(result, { instance_id: instanceId, status: 'expired' });
});
