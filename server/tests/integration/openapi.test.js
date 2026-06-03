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
  assert.ok(response.body.paths['/auth/staff/login']);
  assert.ok(response.body.paths['/auth/refresh']);
  assert.ok(response.body.paths['/auth/onboarding']);
  assert.ok(response.body.paths['/users/me']);
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
    'POST /api/v1/auth/staff/login',
    'POST /api/v1/auth/refresh',
    'POST /api/v1/auth/logout',
    'POST /api/v1/auth/logout-all',
    'POST /api/v1/auth/onboarding',
    'GET /api/v1/users/me',
    'GET /api/v1/docs/openapi.json',
    'GET /api/v1/docs',
  ].forEach((route) => {
    assert.ok(documentedRoutes.has(route), `${route} missing from OpenAPI`);
  });
});
