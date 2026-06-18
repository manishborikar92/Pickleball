import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import createApp from '../../src/app.js';
import { createVenuesRouter } from '../../src/modules/venues/venues.routes.js';

test('venue and availability routes expose server-owned booking metadata', async () => {
  const venueService = {
    async getVenueById(id) {
      return {
        id,
        name: 'Besa, Nagpur',
        slug: 'besa-nagpur',
        advance_booking_days: 7,
        courts: [],
      };
    },
    async getVenueBySlug(slug) {
      return {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Besa, Nagpur',
        slug,
        advance_booking_days: 7,
        courts: [],
      };
    },
    async getAvailability({ venueId, date }) {
      return {
        venue_id: venueId,
        date,
        slot_duration_mins: 60,
        courts: [{
          court_id: '22222222-2222-4222-8222-222222222221',
          court_name: 'Court 1',
          slots: [{ start_time: '09:00', end_time: '10:00', status: 'available', unit_price: 500 }],
        }],
      };
    },
  };

  const app = createApp({
    configureRoutes(router) {
      router.use('/venues', createVenuesRouter({ venueService }));
    },
  });

  const bySlug = await request(app).get('/api/v1/venues/slug/besa-nagpur');
  assert.equal(bySlug.status, 200);
  assert.equal(bySlug.body.data.slug, 'besa-nagpur');

  const availability = await request(app)
    .get('/api/v1/venues/11111111-1111-4111-8111-111111111111/availability?date=2026-06-18');
  assert.equal(availability.status, 200);
  assert.equal(availability.body.data.slot_duration_mins, 60);
  assert.equal(availability.body.data.courts[0].slots[0].unit_price, 500);
});

test('availability route rejects missing date query', async () => {
  const venueService = {
    async getAvailability() {
      return {};
    },
  };

  const app = createApp({
    configureRoutes(router) {
      router.use('/venues', createVenuesRouter({ venueService }));
    },
  });

  const response = await request(app)
    .get('/api/v1/venues/11111111-1111-4111-8111-111111111111/availability');

  assert.equal(response.status, 400);
  assert.equal(response.body.data.errors[0].path, 'date');
});
