import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import createApp from '../../src/app.js';

test('OpenAPI JSON documents auth and onboarding endpoints', async () => {
  const app = createApp();

  const response = await request(app).get('/api/v1/docs/openapi.json');

  assert.equal(response.status, 200);
  assert.equal(response.body.openapi, '3.0.3');
  assert.ok(response.body.paths['/auth/otp/send']);
  assert.ok(response.body.paths['/auth/otp/verify']);
  assert.ok(response.body.paths['/auth/admin/login']);
  assert.ok(response.body.paths['/auth/refresh']);
  assert.ok(response.body.paths['/auth/onboarding']);
  assert.ok(response.body.paths['/users/me']);
  assert.ok(response.body.paths['/users/me/bookings']);
  assert.ok(response.body.paths['/users/me/wallet']);
  assert.ok(response.body.paths['/venues/{venueId}']);
  assert.ok(response.body.paths['/venues/slug/{slug}']);
  assert.ok(response.body.paths['/venues/{venueId}/availability']);
  assert.ok(response.body.paths['/bookings/price-preview']);
  assert.ok(response.body.paths['/bookings/hold']);
  assert.ok(response.body.paths['/bookings/{bookingId}/waiver']);
  assert.ok(response.body.paths['/bookings/{bookingId}/initiate-payment']);
  assert.ok(response.body.paths['/payments/status/{merchantOrderId}']);
  assert.ok(response.body.paths['/reviews']);
  assert.ok(response.body.paths['/reviews'].post);
  assert.ok(response.body.paths['/reviews'].get);
  assert.ok(response.body.paths['/reviews/me']);
  assert.ok(response.body.paths['/reviews/moderation']);
  assert.ok(response.body.paths['/reviews/{reviewId}']);
  assert.ok(response.body.components.securitySchemes.bearerAuth);
});

test('Swagger UI route is available outside production', async () => {
  const app = createApp();

  const response = await request(app).get('/api/v1/docs/');

  assert.equal(response.status, 200);
  assert.match(response.text, /Swagger UI/);
});

test('OpenAPI JSON covers every built-in HTTP route', async () => {
  const app = createApp();

  const response = await request(app).get('/api/v1/docs/openapi.json');
  const documentedRoutes = new Set(
    Object.entries(response.body.paths).flatMap(([path, operations]) => (
      Object.keys(operations).map((method) => {
        const fullPath = path.startsWith('/api/v1') || path === '/' ? path : `/api/v1${path}`;
        return `${method.toUpperCase()} ${fullPath}`;
      })
    )),
  );

  [
    'GET /',
    'GET /api/v1/health',
    'GET /api/v1/live',
    'GET /api/v1/ready',
    'POST /api/v1/auth/otp/send',
    'POST /api/v1/auth/otp/verify',
    'POST /api/v1/auth/admin/login',
    'POST /api/v1/auth/refresh',
    'POST /api/v1/auth/logout',
    'POST /api/v1/auth/logout-all',
    'POST /api/v1/auth/onboarding',
    'GET /api/v1/users/me',
    'GET /api/v1/users/me/bookings',
    'GET /api/v1/users/me/wallet',
    'GET /api/v1/venues/{venueId}',
    'GET /api/v1/venues/slug/{slug}',
    'GET /api/v1/venues/{venueId}/availability',
    'POST /api/v1/bookings/price-preview',
    'POST /api/v1/bookings/hold',
    'GET /api/v1/bookings/{bookingId}',
    'POST /api/v1/bookings/{bookingId}/waiver',
    'POST /api/v1/bookings/{bookingId}/initiate-payment',
    'GET /api/v1/payments/status/{merchantOrderId}',
    'GET /api/v1/payments/redirect',
    'POST /api/v1/webhooks/phonepe',
    'POST /api/v1/reviews',
    'GET /api/v1/reviews',
    'GET /api/v1/reviews/me',
    'GET /api/v1/reviews/moderation',
    'PATCH /api/v1/reviews/{reviewId}',
    'GET /api/v1/docs/openapi.json',
    'GET /api/v1/docs',
  ].forEach((route) => {
    assert.ok(documentedRoutes.has(route), `${route} missing from OpenAPI`);
  });
});
