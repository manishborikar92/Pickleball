import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import createApp from '../../src/app.js';
import { createAuthRouter } from '../../src/modules/auth/auth.routes.js';

const refreshCookie = 'pb_refresh_token=refresh-1; Path=/api/v1/auth; HttpOnly';

function createTestApp(serviceOverrides = {}, configOverrides = {}) {
  const authService = {
    async sendCustomerOtp() {
      return {
        phone: '+919876543210',
        expiresInSeconds: 300,
        sandboxOtp: '123456',
      };
    },
    async verifyCustomerOtp() {
      return {
        access_token: 'access-token',
        refreshToken: { raw: 'refresh-1' },
        user: {
          id: 'user-1',
          phone: '+919876543210',
          name: null,
          onboarding_complete: false,
        },
        next_step: 'complete_onboarding',
      };
    },
    async refreshSession() {
      return {
        access_token: 'access-token-2',
        refreshToken: { raw: 'refresh-2' },
        user: {
          id: 'user-1',
          phone: '+919876543210',
          name: 'Asha Mehta',
          onboarding_complete: true,
        },
      };
    },
    async logoutCurrent() {},
    async logoutAll() {},
    async loginStaff() {
      return {
        access_token: 'staff-access-token',
        refreshToken: { raw: 'staff-refresh-1' },
        user: {
          id: 'staff-user-1',
          email: 'manager@besanagpur.com',
          name: 'Ravi Kumar',
        },
        next_step: 'admin_dashboard',
      };
    },
    ...serviceOverrides,
  };

  return createApp({
    configOverrides,
    configureRoutes(router) {
      router.use('/auth', createAuthRouter({ authService }));
    },
  });
}

test('POST /auth/otp/send returns normalized OTP send metadata', async () => {
  const app = createTestApp();

  const response = await request(app)
    .post('/api/v1/auth/otp/send')
    .send({ phone: '98765 43210' });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.phone, '+919876543210');
  assert.equal(response.body.data.expires_in_seconds, 300);
  assert.equal(response.body.data.sandbox_otp, '123456');
});

test('POST /auth/otp/verify sets refresh cookie and returns access token', async () => {
  const app = createTestApp();

  const response = await request(app)
    .post('/api/v1/auth/otp/verify')
    .send({ phone: '+919876543210', otp: '123456' });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.access_token, 'access-token');
  assert.equal(response.body.data.next_step, 'complete_onboarding');
  assert.match(response.headers['set-cookie'][0], /pb_refresh_token=refresh-1/);
  assert.match(response.headers['set-cookie'][0], /HttpOnly/);
});

test('refresh cookie settings honor configured name, domain, and API prefix', async () => {
  const app = createTestApp({}, {
    app: { apiPrefix: '/internal' },
    auth: {
      refreshCookieName: 'custom_refresh',
      refreshCookieDomain: 'baselinearena.in',
    },
  });

  const response = await request(app)
    .post('/internal/auth/otp/verify')
    .send({ phone: '+919876543210', otp: '123456' });

  const cookie = response.headers['set-cookie'][0];
  assert.equal(response.status, 200);
  assert.match(cookie, /custom_refresh=refresh-1/);
  assert.match(cookie, /Domain=baselinearena\.in/);
  assert.match(cookie, /Path=\/internal\/auth/);
});

test('refresh endpoint reads the configured refresh cookie name', async () => {
  let receivedRefreshToken;
  const app = createTestApp({
    async refreshSession({ refreshToken }) {
      receivedRefreshToken = refreshToken;
      return {
        access_token: 'access-token-2',
        refreshToken: { raw: 'refresh-2' },
        user: {
          id: 'user-1',
          phone: '+919876543210',
          name: 'Asha Mehta',
          onboarding_complete: true,
        },
      };
    },
  }, {
    auth: { refreshCookieName: 'custom_refresh' },
  });

  const response = await request(app)
    .post('/api/v1/auth/refresh')
    .set('Cookie', 'custom_refresh=custom-token; Path=/api/v1/auth; HttpOnly')
    .send({});

  assert.equal(response.status, 200);
  assert.equal(receivedRefreshToken, 'custom-token');
});

test('POST /auth/refresh rotates refresh cookie', async () => {
  const app = createTestApp();

  const response = await request(app)
    .post('/api/v1/auth/refresh')
    .set('Cookie', refreshCookie)
    .send({});

  assert.equal(response.status, 200);
  assert.equal(response.body.data.access_token, 'access-token-2');
  assert.match(response.headers['set-cookie'][0], /pb_refresh_token=refresh-2/);
});

test('POST /auth/logout clears refresh cookie', async () => {
  const app = createTestApp();

  const response = await request(app)
    .post('/api/v1/auth/logout')
    .set('Cookie', refreshCookie)
    .send({});

  assert.equal(response.status, 200);
  assert.equal(response.body.data.logged_out, true);
  assert.match(response.headers['set-cookie'][0], /pb_refresh_token=;/);
});

test('POST /auth/staff/login sets refresh cookie and returns staff next step', async () => {
  const app = createTestApp();

  const response = await request(app)
    .post('/api/v1/auth/staff/login')
    .send({ email: 'manager@besanagpur.com', password: 'SecurePass123!' });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.access_token, 'staff-access-token');
  assert.equal(response.body.data.next_step, 'admin_dashboard');
  assert.match(response.headers['set-cookie'][0], /pb_refresh_token=staff-refresh-1/);
});

test('POST /auth/logout-all clears refresh cookie after revoking sessions', async () => {
  const secret = 'test-access-secret-with-enough-length';
  const app = createTestApp({}, {
    auth: { accessTokenSecret: secret },
  });
  const token = jwt.sign(
    { sub: 'user-1', roles: ['customer'], permissions: ['view_own_bookings'] },
    secret,
    { expiresIn: '5m', issuer: 'baseline-api', audience: 'baseline-web' },
  );

  const response = await request(app)
    .post('/api/v1/auth/logout-all')
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', refreshCookie)
    .send({});

  assert.equal(response.status, 200);
  assert.equal(response.body.data.logged_out_all, true);
  assert.match(response.headers['set-cookie'][0], /pb_refresh_token=;/);
});
