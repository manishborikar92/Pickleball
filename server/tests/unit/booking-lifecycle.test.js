import assert from 'node:assert/strict';
import test from 'node:test';

import { createBookingsService } from '../../src/modules/bookings/bookings.service.js';
import { ConflictError, TooManyRequestsError } from '../../src/utils/api-error.js';

const userId = '33333333-3333-4333-8333-333333333333';
const venueId = '11111111-1111-4111-8111-111111111111';
const courtId = '22222222-2222-4222-8222-222222222221';

const quote = {
  court_count: 1,
  slot_count: 1,
  slot_unit_count: 1,
  session_start_time: '09:00',
  session_end_time: '10:00',
  session_duration_mins: 60,
  price_breakdown: {
    units: [{ court_id: courtId, court_name: 'Court 1', slot_start_time: '09:00', slot_end_time: '10:00', unit_price: 500 }],
    subtotal: 500,
    coupon_discount: 0,
    tax: 90,
    total: 590,
  },
};

function createService(repositoryOverrides = {}) {
  return createBookingsService({
    repository: {
      async getHoldContext() {
        return {
          venue: { id: venueId, advanceBookingDays: 7, rolloverTime: new Date('1970-01-01T08:00:00.000Z') },
          courts: [{ id: courtId, venueId, status: 'active', name: 'Court 1', basePrice: { amount: 500 } }],
          pricingRules: [],
          coupon: null,
        };
      },
      async countActivePendingHolds() {
        return 0;
      },
      async createHold() {
        return {
          id: '44444444-4444-4444-8444-444444444444',
          status: 'pending_payment',
          expiresAt: new Date('2026-06-17T04:10:00.000Z'),
        };
      },
      async findUnavailableUnits() {
        return [];
      },
      ...repositoryOverrides,
    },
    availabilityService: {
      async getAvailability() {
        return {
          slot_duration_mins: 60,
          courts: [{
            court_id: courtId,
            slots: [{ start_time: '09:00', end_time: '10:00', status: 'available', unit_price: 500 }],
          }],
        };
      },
    },
    selectionService: {
      validateSelection() {
        return {
          courts: [{ id: courtId, venueId, status: 'active', name: 'Court 1', basePrice: { amount: 500 } }],
          slotStartTimes: ['09:00'],
          slotDurationMins: 60,
        };
      },
    },
    pricingService: {
      buildQuote() {
        return quote;
      },
    },
    clock: () => new Date('2026-06-17T04:00:00.000Z'),
  });
}

test('createHold writes an atomic pending booking from server-calculated quote', async () => {
  let createHoldInput;
  const service = createService({
    async createHold(input) {
      createHoldInput = input;
      return {
        id: '44444444-4444-4444-8444-444444444444',
        status: 'pending_payment',
        expiresAt: input.expiresAt,
      };
    },
  });

  const result = await service.createHold({
    userId,
    input: {
      venue_id: venueId,
      court_ids: [courtId],
      slot_date: '2026-06-18',
      slot_start_times: ['09:00'],
      total_amount: 1,
    },
    requestContext: { requestId: 'req-1' },
  });

  assert.equal(result.booking_id, '44444444-4444-4444-8444-444444444444');
  assert.equal(result.status, 'pending_payment');
  assert.equal(result.price_quote.total, 590);
  assert.equal(createHoldInput.booking.totalAmount, 590);
  assert.equal(createHoldInput.booking.baseAmount, 500);
  assert.equal(createHoldInput.slotUnits.length, 1);
});

test('createHold rejects users that already have two active holds', async () => {
  const service = createService({
    async countActivePendingHolds() {
      return 2;
    },
  });

  await assert.rejects(() => service.createHold({
    userId,
    input: {
      venue_id: venueId,
      court_ids: [courtId],
      slot_date: '2026-06-18',
      slot_start_times: ['09:00'],
    },
    requestContext: {},
  }), TooManyRequestsError);
});

test('createHold maps unique slot conflicts to SLOTS_UNAVAILABLE', async () => {
  const error = new Error('Unique constraint failed');
  error.code = 'P2002';

  const service = createService({
    async createHold() {
      throw error;
    },
    async findUnavailableUnits() {
      return [{ court_id: courtId, court_name: 'Court 1', slot_start_time: '09:00' }];
    },
  });

  await assert.rejects(() => service.createHold({
    userId,
    input: {
      venue_id: venueId,
      court_ids: [courtId],
      slot_date: '2026-06-18',
      slot_start_times: ['09:00'],
    },
    requestContext: {},
  }), (err) => {
    assert.ok(err instanceof ConflictError);
    assert.equal(err.details.code, 'SLOTS_UNAVAILABLE');
    assert.equal(err.details.unavailable[0].slot_start_time, '09:00');
    return true;
  });
});

test('simultaneous hold attempts allow one winner and reject the conflicting loser', async () => {
  let attempts = 0;
  const uniqueError = new Error('Unique constraint failed');
  uniqueError.code = 'P2002';

  const service = createService({
    async createHold(input) {
      attempts += 1;
      if (attempts === 1) {
        return {
          id: '44444444-4444-4444-8444-444444444444',
          status: 'pending_payment',
          expiresAt: input.booking.expiresAt,
        };
      }
      throw uniqueError;
    },
    async findUnavailableUnits() {
      return [{ court_id: courtId, court_name: 'Court 1', slot_start_time: '09:00' }];
    },
  });

  const requestInput = {
    userId,
    input: {
      venue_id: venueId,
      court_ids: [courtId],
      slot_date: '2026-06-18',
      slot_start_times: ['09:00'],
    },
    requestContext: {},
  };

  const results = await Promise.allSettled([
    service.createHold(requestInput),
    service.createHold(requestInput),
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejection = results.find((result) => result.status === 'rejected');
  assert.ok(rejection.reason instanceof ConflictError);
  assert.equal(rejection.reason.details.code, 'SLOTS_UNAVAILABLE');
});

test('expirePendingHolds delegates idempotent expiry to repository and logs count', async () => {
  let expireInput;
  const service = createService({
    async expirePendingHolds(input) {
      expireInput = input;
      return {
        expired_count: 2,
        wallet_credits_rolled_back: 300,
      };
    },
  });

  const result = await service.expirePendingHolds({
    limit: 50,
    requestContext: { requestId: 'sweeper-1' },
  });

  assert.equal(result.expired_count, 2);
  assert.equal(result.wallet_credits_rolled_back, 300);
  assert.equal(expireInput.limit, 50);
  assert.equal(expireInput.now.toISOString(), '2026-06-17T04:00:00.000Z');
});

test('initiatePayment transitions booking to expired and throws 410 when hold is expired', async () => {
  let expiredBookingId;
  const service = createService({
    async getBookingForPayment({ bookingId, userId }) {
      return {
        id: bookingId,
        userId,
        status: 'pending_payment',
        expiresAt: new Date('2026-06-17T03:59:00.000Z'), // expired relative to clock T04:00
        waiverAccepted: true,
      };
    },
    async expireBooking({ bookingId }) {
      expiredBookingId = bookingId;
      return { id: bookingId, status: 'expired' };
    },
  });

  await assert.rejects(() => service.initiatePayment({
    userId,
    bookingId: 'booking-expired-id',
    input: {},
  }), (err) => {
    assert.equal(err.statusCode, 410);
    assert.equal(err.details?.code, 'BOOKING_EXPIRED');
    return true;
  });

  assert.equal(expiredBookingId, 'booking-expired-id');
});

test('acceptWaiver guards booking status correctly', async () => {
  // 1. Not found
  const serviceNotFound = createService({
    async getBookingForPayment() {
      return null;
    },
  });
  await assert.rejects(
    () => serviceNotFound.acceptWaiver({ userId, bookingId: 'nonexistent' }),
    /Booking not found/
  );

  // 2. Already confirmed
  const serviceConfirmed = createService({
    async getBookingForPayment() {
      return { id: 'b1', status: 'confirmed' };
    },
  });
  await assert.rejects(
    () => serviceConfirmed.acceptWaiver({ userId, bookingId: 'b1' }),
    (err) => {
      assert.ok(err instanceof ConflictError);
      assert.equal(err.details?.code, 'INVALID_BOOKING_STATE');
      return true;
    }
  );

  // 3. Not pending_payment (e.g. cancelled)
  const serviceCancelled = createService({
    async getBookingForPayment() {
      return { id: 'b1', status: 'cancelled' };
    },
  });
  await assert.rejects(
    () => serviceCancelled.acceptWaiver({ userId, bookingId: 'b1' }),
    (err) => {
      assert.ok(err instanceof ConflictError);
      assert.equal(err.details?.code, 'INVALID_BOOKING_STATE');
      return true;
    }
  );

  // 4. Expired hold transitions to expired and throws 410
  let expiredBookingId;
  const serviceExpired = createService({
    async getBookingForPayment() {
      return { id: 'b1', status: 'pending_payment', expiresAt: new Date('2026-06-17T03:59:00.000Z') };
    },
    async expireBooking({ bookingId }) {
      expiredBookingId = bookingId;
      return { id: bookingId, status: 'expired' };
    },
  });
  await assert.rejects(
    () => serviceExpired.acceptWaiver({ userId, bookingId: 'b1' }),
    (err) => {
      assert.equal(err.statusCode, 410);
      assert.equal(err.details?.code, 'BOOKING_EXPIRED');
      return true;
    }
  );
  assert.equal(expiredBookingId, 'b1');

  // 5. Valid hold accepts waiver
  let waiverUpdates;
  const serviceValid = createService({
    async getBookingForPayment() {
      return { id: 'b1', status: 'pending_payment', expiresAt: new Date('2026-06-17T04:10:00.000Z') };
    },
    async acceptWaiver({ userId, bookingId, acceptedAt, ipAddress }) {
      waiverUpdates = { userId, bookingId, acceptedAt, ipAddress };
      return { waiverAcceptedAt: acceptedAt };
    },
  });
  const res = await serviceValid.acceptWaiver({ userId, bookingId: 'b1', requestContext: { ipAddress: '1.2.3.4' } });
  assert.ok(res.waiver_accepted);
  assert.equal(waiverUpdates.bookingId, 'b1');
  assert.equal(waiverUpdates.ipAddress, '1.2.3.4');
});

