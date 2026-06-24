import assert from 'node:assert/strict';
import test from 'node:test';

import { createBookingSelectionService } from '../../src/modules/bookings/booking-selection.service.js';
import { BadRequestError } from '../../src/utils/api-error.js';

const venue = {
  id: '11111111-1111-4111-8111-111111111111',
  advanceBookingDays: 7,
  rolloverTime: new Date('1970-01-01T08:00:00.000Z'),
  timezone: 'Asia/Kolkata',
};

const courts = [
  { id: '22222222-2222-4222-8222-222222222221', status: 'active', venueId: venue.id },
  { id: '22222222-2222-4222-8222-222222222222', status: 'active', venueId: venue.id },
];

const availability = {
  slot_duration_mins: 60,
  courts: courts.map((court) => ({
    court_id: court.id,
    slots: [
      { start_time: '09:00', end_time: '10:00', status: 'available', unit_price: 500 },
      { start_time: '10:00', end_time: '11:00', status: 'available', unit_price: 500 },
      { start_time: '11:00', end_time: '12:00', status: 'pending' },
    ],
  })),
};

test('selection validation accepts active courts and consecutive available slots', () => {
  const service = createBookingSelectionService({
    clock: () => new Date('2026-06-17T03:00:00.000Z'),
  });

  const result = service.validateSelection({
    venue,
    courts,
    availability,
    input: {
      court_ids: courts.map((court) => court.id),
      slot_date: '2026-06-18',
      slot_start_times: ['09:00', '10:00'],
    },
  });

  assert.equal(result.slotDurationMins, 60);
  assert.deepEqual(result.slotStartTimes, ['09:00', '10:00']);
  assert.equal(result.courts.length, 2);
});

test('selection validation rejects non-consecutive slots', () => {
  const service = createBookingSelectionService({
    clock: () => new Date('2026-06-17T03:00:00.000Z'),
  });

  assert.throws(() => service.validateSelection({
    venue,
    courts,
    availability,
    input: {
      court_ids: [courts[0].id],
      slot_date: '2026-06-18',
      slot_start_times: ['09:00', '11:00'],
    },
  }), BadRequestError);
});

test('selection validation rejects unavailable generated slots', () => {
  const service = createBookingSelectionService({
    clock: () => new Date('2026-06-17T03:00:00.000Z'),
  });

  assert.throws(() => service.validateSelection({
    venue,
    courts,
    availability,
    input: {
      court_ids: [courts[0].id],
      slot_date: '2026-06-18',
      slot_start_times: ['11:00'],
    },
  }), /not available/);
});

test('selection validation rejects same-day past slots', () => {
  const service = createBookingSelectionService({
    // 2026-06-17T03:30:00Z is 09:00 AM IST. So a slot at 09:00 AM is starting now/past.
    clock: () => new Date('2026-06-17T03:31:00.000Z'),
  });

  const venueWithTz = { ...venue, timezone: 'Asia/Kolkata' };

  assert.throws(() => service.validateSelection({
    venue: venueWithTz,
    courts,
    availability,
    input: {
      court_ids: [courts[0].id],
      slot_date: '2026-06-17',
      slot_start_times: ['09:00'],
    },
  }), (err) => {
    assert.ok(err instanceof BadRequestError);
    assert.equal(err.details?.code, 'SLOT_IN_PAST');
    return true;
  });
});

test('selection validation accepts same-day future slots', () => {
  const service = createBookingSelectionService({
    // 08:00 AM IST is 2026-06-17T02:30:00Z.
    clock: () => new Date('2026-06-17T02:30:00.000Z'),
  });

  const venueWithTz = { ...venue, timezone: 'Asia/Kolkata' };

  const result = service.validateSelection({
    venue: venueWithTz,
    courts,
    availability,
    input: {
      court_ids: [courts[0].id],
      slot_date: '2026-06-17',
      slot_start_times: ['09:00'],
    },
  });

  assert.equal(result.slotDurationMins, 60);
});
