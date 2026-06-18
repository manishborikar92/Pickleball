import assert from 'node:assert/strict';
import test from 'node:test';

import { createVenuesService } from '../../src/modules/venues/venues.service.js';
import { createBookingPricingService } from '../../src/modules/bookings/booking-pricing.service.js';

const time = (value) => new Date(`1970-01-01T${value}:00.000Z`);

const venue = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Besa, Nagpur',
  timezone: 'Asia/Kolkata',
  rolloverTime: time('08:00'),
  advanceBookingDays: 7,
  isActive: true,
};

const courts = [
  {
    id: '22222222-2222-4222-8222-222222222221',
    venueId: venue.id,
    name: 'Court 1',
    environment: 'outdoor',
    status: 'active',
    displayOrder: 1,
    basePrice: { amount: 500 },
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    venueId: venue.id,
    name: 'Court 2',
    environment: 'outdoor',
    status: 'active',
    displayOrder: 2,
    basePrice: { amount: 550 },
  },
];

const schedules = courts.map((court) => ({
  id: `schedule-${court.displayOrder}`,
  venueId: venue.id,
  courtId: court.id,
  dayOfWeek: [0, 1, 2, 3, 4, 5, 6],
  openTime: time('09:00'),
  closeTime: time('12:00'),
  slotDurationMins: 60,
  isActive: true,
}));

function createService(overrides = {}) {
  return createVenuesService({
    repository: {
      async getAvailabilityContext() {
        return {
          venue,
          courts,
          schedules,
          scheduleExceptions: [],
          bookingSlots: [],
          pricingRules: [],
          ...overrides,
        };
      },
    },
    pricingService: createBookingPricingService({ taxRate: 0 }),
    clock: () => new Date('2026-06-17T04:00:00.000Z'),
  });
}

test('availability generates slots from active schedules with server unit prices', async () => {
  const service = createService();

  const result = await service.getAvailability({
    venueId: venue.id,
    date: '2026-06-18',
  });

  assert.equal(result.date, '2026-06-18');
  assert.equal(result.slot_duration_mins, 60);
  assert.equal(result.courts.length, 2);
  assert.deepEqual(result.courts[0].slots.map((slot) => slot.start_time), ['09:00', '10:00', '11:00']);
  assert.equal(result.courts[0].slots[0].status, 'available');
  assert.equal(result.courts[0].slots[0].unit_price, 500);
  assert.equal(result.courts[1].slots[0].unit_price, 550);
});

test('availability overlays booking slot states without exposing expired holds as pending', async () => {
  const service = createService({
    bookingSlots: [
      {
        courtId: courts[0].id,
        slotStartTime: time('09:00'),
        status: 'confirmed',
        booking: { status: 'confirmed', expiresAt: null },
      },
      {
        courtId: courts[0].id,
        slotStartTime: time('10:00'),
        status: 'pending_payment',
        booking: { status: 'pending_payment', expiresAt: new Date('2026-06-17T05:00:00.000Z') },
      },
      {
        courtId: courts[0].id,
        slotStartTime: time('11:00'),
        status: 'pending_payment',
        booking: { status: 'pending_payment', expiresAt: new Date('2026-06-17T03:00:00.000Z') },
      },
    ],
  });

  const result = await service.getAvailability({
    venueId: venue.id,
    date: '2026-06-18',
  });

  const statuses = result.courts[0].slots.map((slot) => slot.status);
  assert.deepEqual(statuses, ['booked', 'pending', 'available']);
});

test('availability applies closed and modified-hours exceptions by court', async () => {
  const service = createService({
    scheduleExceptions: [
      {
        venueId: venue.id,
        courtId: courts[0].id,
        exceptionDate: new Date('2026-06-18T00:00:00.000Z'),
        exceptionType: 'closed',
      },
      {
        venueId: venue.id,
        courtId: courts[1].id,
        exceptionDate: new Date('2026-06-18T00:00:00.000Z'),
        exceptionType: 'modified_hours',
        openTime: time('10:00'),
        closeTime: time('12:00'),
      },
    ],
  });

  const result = await service.getAvailability({
    venueId: venue.id,
    date: '2026-06-18',
  });

  assert.deepEqual(result.courts[0].slots, []);
  assert.deepEqual(result.courts[1].slots.map((slot) => slot.start_time), ['10:00', '11:00']);
});
