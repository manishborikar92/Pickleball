import assert from 'node:assert/strict';
import test from 'node:test';

import { createBookingPricingService } from '../../src/modules/bookings/booking-pricing.service.js';

const courtOne = {
  id: '22222222-2222-4222-8222-222222222221',
  name: 'Court 1',
  environment: 'outdoor',
  basePrice: { amount: 500 },
};

const courtTwo = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Court 2',
  environment: 'indoor',
  basePrice: { amount: 550 },
};

test('pricing preview calculates authoritative unit, tax, and total amounts', () => {
  const service = createBookingPricingService({ taxRate: 0.18 });

  const quote = service.buildQuote({
    courts: [courtOne, courtTwo],
    slotDate: '2026-06-20',
    slotStartTimes: ['09:00', '10:00'],
    slotDurationMins: 60,
    pricingRules: [
      {
        courtId: null,
        priority: 10,
        isActive: true,
        rule: {
          type: 'time_modifier',
          days: ['Saturday'],
          start_time: '09:00',
          end_time: '12:00',
          adjustment_type: 'percentage',
          value: 20,
        },
      },
      {
        courtId: courtTwo.id,
        priority: 5,
        isActive: true,
        rule: {
          type: 'court_modifier',
          environment: 'indoor',
          adjustment_type: 'percentage',
          value: 10,
        },
      },
    ],
  });

  assert.equal(quote.court_count, 2);
  assert.equal(quote.slot_count, 2);
  assert.equal(quote.slot_unit_count, 4);
  assert.equal(quote.session_start_time, '09:00');
  assert.equal(quote.session_end_time, '11:00');
  assert.equal(quote.session_duration_mins, 120);
  assert.deepEqual(quote.price_breakdown.units.map((unit) => unit.unit_price), [600, 600, 726, 726]);
  assert.equal(quote.price_breakdown.subtotal, 2652);
  assert.equal(quote.price_breakdown.tax, 477.36);
  assert.equal(quote.price_breakdown.total, 3129.36);
});

test('pricing applies valid coupons after unit pricing and before tax', () => {
  const service = createBookingPricingService({ taxRate: 0.18 });

  const quote = service.buildQuote({
    courts: [courtOne],
    slotDate: '2026-06-18',
    slotStartTimes: ['09:00', '10:00'],
    slotDurationMins: 60,
    pricingRules: [],
    coupon: {
      code: 'FIRST10',
      discountType: 'percentage',
      discountValue: 10,
    },
  });

  assert.equal(quote.price_breakdown.subtotal, 1000);
  assert.equal(quote.price_breakdown.coupon_discount, 100);
  assert.equal(quote.price_breakdown.tax, 162);
  assert.equal(quote.price_breakdown.total, 1062);
});

test('createBookingPricingService requires taxRate configuration', () => {
  assert.throws(() => {
    createBookingPricingService();
  }, /taxRate is required/);

  assert.throws(() => {
    createBookingPricingService({});
  }, /taxRate is required/);
});

test('pricing calculates 0 tax when taxRate is 0', () => {
  const service = createBookingPricingService({ taxRate: 0 });

  const quote = service.buildQuote({
    courts: [courtOne],
    slotDate: '2026-06-18',
    slotStartTimes: ['09:00'],
    slotDurationMins: 60,
    pricingRules: [],
  });

  assert.equal(quote.price_breakdown.subtotal, 500);
  assert.equal(quote.price_breakdown.tax, 0);
  assert.equal(quote.price_breakdown.total, 500);
});

