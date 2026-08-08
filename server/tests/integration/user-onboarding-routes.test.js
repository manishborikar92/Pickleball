import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import createApp from '../../src/app.js';
import { createAuthRouter } from '../../src/modules/auth/auth.routes.js';
import { createUsersRouter } from '../../src/modules/users/users.routes.js';
import { ForbiddenError } from '../../src/utils/api-error.js';

const secret = 'test-access-secret-with-enough-length';
const token = jwt.sign(
  { sub: 'user-1', user_id: 'user-1', session_id: 'session-1', permissions: ['view_own_bookings'] },
  secret,
  { expiresIn: '5m', issuer: 'baseline-api', audience: 'baseline-web' },
);

function createTestApp(
  userService,
  { onboardingMiddleware = (_req, _res, next) => next() } = {},
) {
  const authService = {
    sendCustomerOtp: async () => ({}),
    verifyCustomerOtp: async () => ({}),
    refreshSession: async () => ({}),
    logoutCurrent: async () => {},
    logoutAll: async () => {},
  };

  return createApp({
    configOverrides: {
      auth: { accessTokenSecret: secret },
    },
    configureRoutes(router) {
      router.use('/auth', createAuthRouter({ authService, userService }));
      router.use('/users', createUsersRouter({
        userService,
        onboardingMiddleware,
      }));
    },
  });
}

test('GET /users/me returns the authenticated user profile', async () => {
  const app = createTestApp({
    getCurrentUser: async (userId) => ({
      id: userId,
      phone: '+919876543210',
      name: null,
      onboarding_complete: false,
      roles: [],
      permissions: ['view_own_bookings'],
    }),
  });

  const response = await request(app)
    .get('/api/v1/users/me')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.id, 'user-1');
  assert.equal(response.body.data.onboarding_complete, false);
});

test('POST /auth/onboarding completes name collection with JWT only', async () => {
  const app = createTestApp({
    completeOnboarding: async ({ userId, name }) => ({
      user: {
        id: userId,
        phone: '+919876543210',
        name,
        onboarding_complete: true,
      },
      next_step: 'resume_booking',
    }),
  });

  const response = await request(app)
    .post('/api/v1/auth/onboarding')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: ' Asha  Mehta ' });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.user.name, 'Asha Mehta');
  assert.equal(response.body.data.next_step, 'resume_booking');
});

test('PATCH /users/me updates the authenticated user profile', async () => {
  const app = createTestApp({
    updateProfile: async ({ userId, name }) => ({
      id: userId,
      phone: '+919876543210',
      name,
      onboarding_complete: true,
      roles: [],
      permissions: ['view_own_bookings'],
    }),
  });

  const response = await request(app)
    .patch('/api/v1/users/me')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '  Asha   Mehta  ' });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.name, 'Asha Mehta');
  assert.equal(response.body.data.id, 'user-1');
});

test('PATCH /users/me rejects unsupported or invalid profile payloads', async () => {
  const app = createTestApp({
    updateProfile: async () => {
      throw new Error('must not call service');
    },
  });

  const missingName = await request(app)
    .patch('/api/v1/users/me')
    .set('Authorization', `Bearer ${token}`)
    .send({});
  assert.equal(missingName.status, 400);

  const unknownField = await request(app)
    .patch('/api/v1/users/me')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Asha Mehta', phone: '+919876543210' });
  assert.equal(unknownField.status, 400);
});

test('PATCH /users/me requires onboarding completion', async () => {
  const app = createTestApp(
    { updateProfile: async () => ({ name: 'Asha Mehta' }) },
    {
      onboardingMiddleware: (_req, _res, next) => next(new ForbiddenError(
        'Onboarding incomplete',
        { code: 'ONBOARDING_INCOMPLETE' },
      )),
    },
  );

  const response = await request(app)
    .patch('/api/v1/users/me')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Asha Mehta' });

  assert.equal(response.status, 403);
  assert.equal(response.body.data.code, 'ONBOARDING_INCOMPLETE');
});

test('PATCH /users/me rejects unauthenticated requests', async () => {
  const app = createTestApp({
    updateProfile: async () => {
      throw new Error('must not call service');
    },
  });

  const response = await request(app)
    .patch('/api/v1/users/me')
    .send({ name: 'Asha Mehta' });

  assert.equal(response.status, 401);
});
