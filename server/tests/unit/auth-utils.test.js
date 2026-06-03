import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';

import {
  normalizeIndianPhone,
  createOtpHash,
  verifyOtpHash,
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  createRefreshCookieOptions,
} from '../../src/modules/auth/auth.utils.js';

const fixedNow = new Date('2026-06-02T00:00:00.000Z');

test('normalizeIndianPhone accepts Indian mobile input and returns E.164 format', () => {
  assert.equal(normalizeIndianPhone('98765 43210'), '+919876543210');
  assert.equal(normalizeIndianPhone('+91-98765-43210'), '+919876543210');
  assert.equal(normalizeIndianPhone('12345'), null);
});

test('createOtpHash verifies the original OTP and rejects a different OTP', async () => {
  const hash = await createOtpHash('123456');

  assert.equal(await verifyOtpHash('123456', hash), true);
  assert.equal(await verifyOtpHash('654321', hash), false);
});

test('createAccessToken signs a user/session scoped JWT', () => {
  const token = createAccessToken({
    userId: 'user-1',
    sessionId: 'session-1',
    roles: ['customer'],
    permissions: ['view_own_bookings'],
    config: {
      accessTokenSecret: 'access-secret-with-at-least-32-characters',
      accessTokenTtlSeconds: 900,
      issuer: 'baseline-api',
      audience: 'baseline-web',
    },
    now: fixedNow,
  });

  assert.equal(typeof token, 'string');
  assert.equal(token.split('.').length, 3);
  const decoded = jwt.decode(token);
  assert.equal(decoded.sub, 'user-1');
  assert.equal(decoded.sid, 'session-1');
  assert.deepEqual(decoded.roles, ['customer']);
});

test('createRefreshToken returns raw token plus deterministic hashable value', () => {
  const token = createRefreshToken({
    randomBytes: () => Buffer.alloc(32, 7),
  });

  assert.equal(token.raw.length > 40, true);
  assert.equal(token.hash, hashRefreshToken(token.raw));
});

test('createRefreshCookieOptions uses secure httpOnly defaults', () => {
  const options = createRefreshCookieOptions({
    isProduction: true,
    refreshTokenTtlSeconds: 60 * 60 * 24 * 30,
  });

  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, 'lax');
  assert.equal(options.path, '/api/v1/auth');
  assert.equal(options.maxAge, 60 * 60 * 24 * 30 * 1000);
});
