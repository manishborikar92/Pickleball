import assert from 'node:assert/strict';
import test from 'node:test';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import createApp from '../../src/app.js';
import { validate } from '../../src/middleware/validate.middleware.js';
import { authenticate } from '../../src/middleware/authenticate.middleware.js';
import { requireVenuePermission } from '../../src/middleware/authorize.middleware.js';
import { ApiResponse } from '../../src/utils/api-response.js';

test('createApp wires root and health endpoints with a consistent response envelope', async () => {
  const app = createApp();

  const root = await request(app).get('/');
  assert.equal(root.status, 200);
  assert.equal(root.body.success, true);
  assert.equal(root.body.data.name, 'Pickleball Platform API');

  const health = await request(app).get('/api/v1/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.success, true);
  assert.equal(health.body.data.status, 'ok');
  assert.equal(health.body.data.database.provider, 'postgresql');
  assert.equal(typeof health.body.data.uptimeSeconds, 'number');
});

test('liveness and readiness probes expose operational status', async () => {
  const app = createApp();

  const live = await request(app).get('/api/v1/live');
  assert.equal(live.status, 200);
  assert.deepEqual(live.body.data, { status: 'alive' });

  const ready = await request(app).get('/api/v1/ready');
  assert.equal(ready.status, 200);
  assert.equal(ready.body.data.status, 'ready');
  assert.equal(ready.body.data.database.provider, 'postgresql');
});

test('unknown routes use the centralized not-found and error response format', async () => {
  const app = createApp();

  const response = await request(app).get('/api/v1/missing');

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    success: false,
    message: 'Route not found',
    data: {
      method: 'GET',
      path: '/api/v1/missing',
    },
  });
});

test('validation stores sanitized request data without mutating req.body', async () => {
  const app = createApp({
    configureRoutes(router) {
      router.post(
        '/echo',
        validate(
          Joi.object({
            name: Joi.string().trim().min(2).required(),
          }),
        ),
        (req, res) => {
          res.json(ApiResponse.success({
            validated: req.validated.body,
            raw: req.body,
          }));
        },
      );
    },
  });

  const response = await request(app)
    .post('/api/v1/echo')
    .send({ name: '  Ada  ', extra: 'remove-me' });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.validated, { name: 'Ada' });
  assert.deepEqual(response.body.data.raw, { name: '  Ada  ', extra: 'remove-me' });
});

test('validation failures include field-level errors', async () => {
  const app = createApp({
    configureRoutes(router) {
      router.post(
        '/echo',
        validate(Joi.object({ name: Joi.string().min(2).required() })),
        (_req, res) => res.json(ApiResponse.success()),
      );
    },
  });

  const response = await request(app).post('/api/v1/echo').send({ name: '' });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, 'Validation failed');
  assert.ok(response.body.data.errors.length > 0);
});

test('authenticate verifies JWTs and sets req.auth principal', async () => {
  const secret = 'test-access-secret-with-enough-length';
  const token = jwt.sign(
    { sub: 'user_123' },
    secret,
    { expiresIn: '5m', issuer: 'baseline-api', audience: 'baseline-web' },
  );

  const app = createApp({
    configOverrides: {
      auth: { accessTokenSecret: secret },
    },
    configureRoutes(router) {
      router.get('/secure', authenticate(), (req, res) => {
        res.json(ApiResponse.success({ auth: req.auth }));
      });
    },
  });

  const response = await request(app)
    .get('/api/v1/secure')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.auth.subject, 'user_123');
});

test('authenticate rejects tokens for revoked sessions', async () => {
  const secret = 'test-access-secret-with-enough-length';
  const token = jwt.sign(
    { sub: 'user_123', session_id: 'session_revoked' },
    secret,
    { expiresIn: '5m', issuer: 'baseline-api', audience: 'baseline-web' },
  );

  const app = createApp({
    configOverrides: {
      auth: { accessTokenSecret: secret },
    },
    configureRoutes(router) {
      router.get(
        '/session-secure',
        authenticate({
          validateSession: async () => false,
        }),
        (_req, res) => res.json(ApiResponse.success()),
      );
    },
  });

  const response = await request(app)
    .get('/api/v1/session-secure')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 401);
  assert.equal(response.body.message, 'Session is no longer active');
});

test('requireVenuePermission permits authorized users and rejects unauthorized users', async () => {
  const secret = 'test-access-secret-with-enough-length';
  const token = jwt.sign(
    { sub: 'user_123' },
    secret,
    { expiresIn: '5m', issuer: 'baseline-api', audience: 'baseline-web' },
  );

  const mockAuthService = {
    async hasPermission({ userId, venueId, permission }) {
      return userId === 'user_123' && venueId === 'venue-1' && permission === 'edit_pricing';
    },
  };

  const app = createApp({
    configOverrides: {
      auth: { accessTokenSecret: secret },
    },
    configureRoutes(router) {
      router.get('/admin/:venueId/pricing', (req, res, next) => {
        req.app.set('authService', mockAuthService);
        next();
      }, authenticate(), requireVenuePermission('edit_pricing'), (req, res) => {
        res.json(ApiResponse.success({ ok: true }));
      });
    },
  });

  const successResponse = await request(app)
    .get('/api/v1/admin/venue-1/pricing')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(successResponse.status, 200);

  const forbiddenResponse = await request(app)
    .get('/api/v1/admin/venue-2/pricing')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(forbiddenResponse.status, 403);
});

test('requireVenuePermission rejects requests without venue context', async () => {
  const secret = 'test-access-secret-with-enough-length';
  const token = jwt.sign(
    { sub: 'user_123' },
    secret,
    { expiresIn: '5m', issuer: 'baseline-api', audience: 'baseline-web' },
  );

  const app = createApp({
    configOverrides: {
      auth: { accessTokenSecret: secret },
    },
    configureRoutes(router) {
      router.get('/admin/pricing', authenticate(), requireVenuePermission('edit_pricing'), (req, res) => {
        res.json(ApiResponse.success({ ok: true }));
      });
    },
  });

  const response = await request(app)
    .get('/api/v1/admin/pricing')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 403);
  assert.match(response.body.message, /Venue context required/);
});
