import assert from 'node:assert/strict';
import test from 'node:test';

import { createAuthService } from '../../src/modules/auth/auth.service.js';
import { createPasswordHash, hashRefreshToken } from '../../src/modules/auth/auth.utils.js';

const baseConfig = {
  auth: {
    accessTokenSecret: 'access-secret-with-at-least-32-characters',
    accessTokenTtlSeconds: 900,
    refreshTokenTtlSeconds: 60 * 60 * 24 * 30,
    issuer: 'baseline-api',
    audience: 'baseline-web',
  },
  otp: {
    mode: 'sandbox',
    testCode: '123456',
    ttlSeconds: 300,
  },
  isProduction: false,
};

const fixedNow = new Date('2026-06-02T00:00:00.000Z');
let idCounter = 0;
const nextId = (prefix) => `${prefix}-${++idCounter}`;

function createMemoryRepository(clock = () => fixedNow) {
  const users = new Map();
  const otps = [];
  const sessions = new Map();
  const refreshTokens = new Map();
  const staffCredentials = new Map();

  return {
    data: { users, otps, sessions, refreshTokens, staffCredentials },
    async createOtpRequest(record) {
      const saved = { id: nextId('otp'), createdAt: clock(), ...record };
      otps.push(saved);
      return saved;
    },
    async findLatestActiveOtp({ phone }) {
      return [...otps].reverse().find((otp) => otp.phone === phone && !otp.verifiedAt) || null;
    },
    async markOtpAttempt({ id, verifiedAt = null }) {
      const otp = otps.find((item) => item.id === id);
      otp.attemptCount += 1;
      otp.verifiedAt = verifiedAt;
      return otp;
    },
    async findOrCreateUserByPhone({ phone }) {
      if (users.has(phone)) {
        return { user: users.get(phone), isNewUser: false };
      }
      const user = {
        id: nextId('user'),
        phone,
        name: null,
        isPhoneVerified: true,
        roles: [],
        permissions: ['view_own_bookings'],
      };
      users.set(phone, user);
      return { user, isNewUser: true };
    },
    async findStaffCredentialByEmail({ email }) {
      return staffCredentials.get(email.toLowerCase()) || null;
    },
    async recordStaffLoginFailure({ id }) {
      const credential = [...staffCredentials.values()].find((item) => item.id === id);
      credential.failedLoginAttempts += 1;
      return credential;
    },
    async recordStaffLoginSuccess({ id, ipAddress }) {
      const credential = [...staffCredentials.values()].find((item) => item.id === id);
      credential.failedLoginAttempts = 0;
      credential.lastLoginIp = ipAddress;
      credential.lastLoginAt = fixedNow;
      return credential;
    },
    async unlockStaffCredential(id) {
      const credential = [...staffCredentials.values()].find((item) => item.id === id);
      credential.failedLoginAttempts = 0;
      credential.lockedUntil = null;
      credential.status = 'active';
      return credential;
    },
    async createSession({ userId, expiresAt, ipAddress, userAgent }) {
      const session = {
        id: nextId('session'),
        userId,
        status: 'active',
        expiresAt,
        ipAddress,
        userAgent,
      };
      sessions.set(session.id, session);
      return session;
    },
    async createRefreshToken(record) {
      const refreshToken = { id: nextId('refresh'), revokedAt: null, ...record };
      refreshTokens.set(refreshToken.id, refreshToken);
      return refreshToken;
    },
    async rotateRefreshToken({ currentTokenId, nextToken }) {
      const current = refreshTokens.get(currentTokenId);
      if (current.revokedAt) {
        throw new Error('TOKEN_ALREADY_ROTATED');
      }
      current.revokedAt = fixedNow;
      const created = { id: nextId('refresh'), revokedAt: null, ...nextToken };
      refreshTokens.set(created.id, created);
      current.replacedByTokenId = created.id;
      return created;
    },
    async findRefreshTokenByHash(tokenHash) {
      const token = [...refreshTokens.values()].find((item) => item.tokenHash === tokenHash) || null;
      if (!token) return null;
      const session = sessions.get(token.sessionId);
      return {
        ...token,
        session,
      };
    },
    async revokeRefreshToken({ id, replacedByTokenId = null }) {
      const token = refreshTokens.get(id);
      token.revokedAt = fixedNow;
      token.replacedByTokenId = replacedByTokenId;
      return token;
    },
    async revokeSession({ sessionId, reason }) {
      const session = sessions.get(sessionId);
      session.status = 'revoked';
      session.revokedAt = fixedNow;
      session.revokeReason = reason;
      return session;
    },
    async revokeAllUserSessions({ userId, reason }) {
      for (const session of sessions.values()) {
        if (session.userId === userId) {
          session.status = 'revoked';
          session.revokedAt = fixedNow;
          session.revokeReason = reason;
        }
      }
    },
    async getUserAuthContext(userId) {
      const user = [...users.values()].find((item) => item.id === userId);
      return {
        user,
        roles: ['customer'],
        permissions: ['view_own_bookings'],
      };
    },
  };
}

test('sendCustomerOtp stores a hashed sandbox OTP and dispatches provider send', async () => {
  const repository = createMemoryRepository();
  const sent = [];
  const service = createAuthService({
    repository,
    otpProvider: { sendOtp: async (payload) => sent.push(payload) },
    config: baseConfig,
    clock: () => fixedNow,
  });

  const result = await service.sendCustomerOtp({
    phone: '98765 43210',
    ipAddress: '127.0.0.1',
  });

  assert.equal(result.phone, '+919876543210');
  assert.equal(result.expiresInSeconds, 300);
  assert.equal(result.sandboxOtp, '123456');
  assert.equal(sent[0].phone, '+919876543210');
  assert.equal(sent[0].code, '123456');
  assert.equal(repository.data.otps[0].otpHash.includes('123456'), false);
});

test('verifyCustomerOtp creates user, session, access token, and refresh token', async () => {
  const repository = createMemoryRepository();
  const service = createAuthService({
    repository,
    otpProvider: { sendOtp: async () => {} },
    config: baseConfig,
    clock: () => fixedNow,
    randomBytes: () => Buffer.alloc(32, 9),
  });

  await service.sendCustomerOtp({ phone: '+919876543210' });
  const result = await service.verifyCustomerOtp({
    phone: '+919876543210',
    otp: '123456',
    ipAddress: '127.0.0.1',
    userAgent: 'node-test',
  });

  assert.equal(result.user.phone, '+919876543210');
  assert.equal(result.user.onboarding_complete, false);
  assert.equal(result.next_step, 'complete_onboarding');
  assert.equal(result.access_token.split('.').length, 3);
  assert.equal(result.refreshToken.raw.length > 40, true);
  assert.equal(repository.data.sessions.size, 1);
});

test('refreshSession rotates refresh token and revokes the used token', async () => {
  const repository = createMemoryRepository();
  let bytesValue = 1;
  const service = createAuthService({
    repository,
    otpProvider: { sendOtp: async () => {} },
    config: baseConfig,
    clock: () => fixedNow,
    randomBytes: () => Buffer.alloc(32, bytesValue++),
  });

  await service.sendCustomerOtp({ phone: '+919876543210' });
  const verified = await service.verifyCustomerOtp({ phone: '+919876543210', otp: '123456' });

  const refreshed = await service.refreshSession({ refreshToken: verified.refreshToken.raw });
  const oldToken = await repository.findRefreshTokenByHash(hashRefreshToken(verified.refreshToken.raw));

  assert.equal(refreshed.access_token.split('.').length, 3);
  assert.notEqual(refreshed.refreshToken.raw, verified.refreshToken.raw);
  assert.notEqual(oldToken.revokedAt, null);
});

test('loginStaff issues token pair for an active staff credential', async () => {
  const repository = createMemoryRepository();
  const staffUser = {
    id: 'staff-user-1',
    phone: '+919999999999',
    name: 'Ravi Kumar',
    isPhoneVerified: true,
  };
  repository.data.staffCredentials.set('manager@besanagpur.com', {
    id: 'staff-credential-1',
    email: 'manager@besanagpur.com',
    passwordHash: await createPasswordHash('SecurePass123!'),
    status: 'active',
    forcePasswordChange: false,
    failedLoginAttempts: 0,
    user: staffUser,
    roles: ['manager'],
    permissions: ['manage_bookings'],
  });

  const service = createAuthService({
    repository,
    otpProvider: { sendOtp: async () => {} },
    config: baseConfig,
    clock: () => fixedNow,
    randomBytes: () => Buffer.alloc(32, 7),
  });

  const result = await service.loginStaff({
    email: 'Manager@BesaNagpur.com',
    password: 'SecurePass123!',
    ipAddress: '127.0.0.1',
    userAgent: 'node-test',
  });

  assert.equal(result.user.email, 'manager@besanagpur.com');
  assert.equal(result.next_step, 'admin_dashboard');
  assert.equal(result.access_token.split('.').length, 3);
  assert.equal(repository.data.sessions.size, 1);
});

test('sendCustomerOtp enforces 60-second cooldown', async () => {
  let mockTime = new Date('2026-06-02T00:00:00.000Z');
  const repository = createMemoryRepository(() => mockTime);
  const service = createAuthService({
    repository,
    otpProvider: { sendOtp: async () => {} },
    config: baseConfig,
    clock: () => mockTime,
  });

  // First request should succeed
  await service.sendCustomerOtp({ phone: '+919876543210' });

  // Second request immediately after should fail
  await assert.rejects(
    () => service.sendCustomerOtp({ phone: '+919876543210' }),
    /Please wait 60 seconds before requesting a new OTP/
  );

  // Advance time by 30 seconds - should still fail
  mockTime = new Date(mockTime.getTime() + 30 * 1000);
  await assert.rejects(
    () => service.sendCustomerOtp({ phone: '+919876543210' }),
    /Please wait 30 seconds before requesting a new OTP/
  );

  // Advance time by another 31 seconds (total 61s) - should succeed
  mockTime = new Date(mockTime.getTime() + 31 * 1000);
  const result = await service.sendCustomerOtp({ phone: '+919876543210' });
  assert.equal(result.phone, '+919876543210');
});

test('verifyCustomerOtp blocks verification after maxAttempts limit is reached', async () => {
  const repository = createMemoryRepository();
  const testConfig = {
    ...baseConfig,
    otp: {
      ...baseConfig.otp,
      maxAttempts: 3,
    },
  };

  const service = createAuthService({
    repository,
    otpProvider: { sendOtp: async () => {} },
    config: testConfig,
    clock: () => fixedNow,
  });

  await service.sendCustomerOtp({ phone: '+919876543210' });

  // Attempt 1: Failed
  await assert.rejects(
    () => service.verifyCustomerOtp({ phone: '+919876543210', otp: '000000' }),
    /Invalid OTP/
  );

  // Attempt 2: Failed
  await assert.rejects(
    () => service.verifyCustomerOtp({ phone: '+919876543210', otp: '000000' }),
    /Invalid OTP/
  );

  // Attempt 3: Failed
  await assert.rejects(
    () => service.verifyCustomerOtp({ phone: '+919876543210', otp: '000000' }),
    /Invalid OTP/
  );

  // Attempt 4: Should be blocked by attempt count check
  await assert.rejects(
    () => service.verifyCustomerOtp({ phone: '+919876543210', otp: '123456' }),
    /Too many failed attempts/
  );
});

test('loginStaff automatically unlocks and resets attempts if lock has expired', async () => {
  const repository = createMemoryRepository();
  const staffUser = {
    id: 'staff-user-1',
    phone: '+919999999999',
    name: 'Ravi Kumar',
    isPhoneVerified: true,
  };

  const pastLockTime = new Date(fixedNow.getTime() - 60000);
  repository.data.staffCredentials.set('manager@besanagpur.com', {
    id: 'staff-credential-1',
    email: 'manager@besanagpur.com',
    passwordHash: await createPasswordHash('SecurePass123!'),
    status: 'locked',
    forcePasswordChange: false,
    failedLoginAttempts: 10,
    lockedUntil: pastLockTime,
    user: staffUser,
    roles: ['manager'],
    permissions: ['manage_bookings'],
  });

  const service = createAuthService({
    repository,
    otpProvider: { sendOtp: async () => {} },
    config: baseConfig,
    clock: () => fixedNow,
    randomBytes: () => Buffer.alloc(32, 7),
  });

  const result = await service.loginStaff({
    email: 'manager@besanagpur.com',
    password: 'SecurePass123!',
    ipAddress: '127.0.0.1',
    userAgent: 'node-test',
  });

  assert.equal(result.user.email, 'manager@besanagpur.com');

  const cred = repository.data.staffCredentials.get('manager@besanagpur.com');
  assert.equal(cred.status, 'active');
  assert.equal(cred.failedLoginAttempts, 0);
  assert.equal(cred.lockedUntil, null);
});

test('refreshSession allows concurrent refresh requests inside grace window', async () => {
  const repository = createMemoryRepository();
  let time = new Date('2026-06-02T00:00:00.000Z');
  const service = createAuthService({
    repository,
    otpProvider: { sendOtp: async () => {} },
    config: baseConfig,
    clock: () => time,
    randomBytes: () => Buffer.alloc(32, 1),
  });

  await service.sendCustomerOtp({ phone: '+919876543210' });
  const verified = await service.verifyCustomerOtp({ phone: '+919876543210', otp: '123456' });

  // Rotate once to generate a rotated token
  await service.refreshSession({ refreshToken: verified.refreshToken.raw });

  // Advance time by 5 seconds (inside 10s grace window)
  time = new Date(time.getTime() + 5000);

  // Parallel/concurrent refresh request using the original revoked token
  const refreshed2 = await service.refreshSession({ refreshToken: verified.refreshToken.raw });

  // It should successfully return the new access token and skip cookie update
  assert.equal(refreshed2.skipCookieUpdate, true);
  assert.equal(refreshed2.access_token.split('.').length, 3);
});

test('refreshSession rejects reuse of a revoked token outside grace window', async () => {
  const repository = createMemoryRepository();
  let time = new Date('2026-06-02T00:00:00.000Z');
  const service = createAuthService({
    repository,
    otpProvider: { sendOtp: async () => {} },
    config: baseConfig,
    clock: () => time,
    randomBytes: () => Buffer.alloc(32, 1),
  });

  await service.sendCustomerOtp({ phone: '+919876543210' });
  const verified = await service.verifyCustomerOtp({ phone: '+919876543210', otp: '123456' });

  // Rotate once
  await service.refreshSession({ refreshToken: verified.refreshToken.raw });

  // Advance time by 11 seconds (outside 10s grace window)
  time = new Date(time.getTime() + 11000);

  // Attempt reuse
  await assert.rejects(
    () => service.refreshSession({ refreshToken: verified.refreshToken.raw }),
    /Refresh token has been revoked/
  );

  // Parent session must be revoked now
  const session = repository.data.sessions.get(repository.data.refreshTokens.values().next().value.sessionId);
  assert.equal(session.status, 'revoked');
  assert.equal(session.revokeReason, 'refresh_token_reuse');
});

test('refreshSession blocks refresh attempt after logout', async () => {
  const repository = createMemoryRepository();
  const service = createAuthService({
    repository,
    otpProvider: { sendOtp: async () => {} },
    config: baseConfig,
    clock: () => fixedNow,
    randomBytes: () => Buffer.alloc(32, 1),
  });

  await service.sendCustomerOtp({ phone: '+919876543210' });
  const verified = await service.verifyCustomerOtp({ phone: '+919876543210', otp: '123456' });

  // Perform logout
  await service.logoutCurrent({ refreshToken: verified.refreshToken.raw });

  // Attempt refresh with the logged out token - should fail
  await assert.rejects(
    () => service.refreshSession({ refreshToken: verified.refreshToken.raw }),
    /Refresh token has been revoked/
  );
});

test('refreshSession blocks refresh attempt after session is revoked', async () => {
  const repository = createMemoryRepository();
  const service = createAuthService({
    repository,
    otpProvider: { sendOtp: async () => {} },
    config: baseConfig,
    clock: () => fixedNow,
    randomBytes: () => Buffer.alloc(32, 1),
  });

  await service.sendCustomerOtp({ phone: '+919876543210' });
  const verified = await service.verifyCustomerOtp({ phone: '+919876543210', otp: '123456' });

  // Revoke session manually (simulate admin revocation or logout all)
  const session = repository.data.sessions.get(repository.data.refreshTokens.values().next().value.sessionId);
  await repository.revokeSession({ sessionId: session.id, reason: 'admin_revocation' });

  // Attempt refresh - should fail
  await assert.rejects(
    () => service.refreshSession({ refreshToken: verified.refreshToken.raw }),
    /Refresh token expired/
  );
});

test('refreshSession handles multiple parallel refresh requests in grace window', async () => {
  const repository = createMemoryRepository();
  let time = new Date('2026-06-02T00:00:00.000Z');
  const service = createAuthService({
    repository,
    otpProvider: { sendOtp: async () => {} },
    config: baseConfig,
    clock: () => time,
    randomBytes: () => Buffer.alloc(32, 1),
  });

  await service.sendCustomerOtp({ phone: '+919876543210' });
  const verified = await service.verifyCustomerOtp({ phone: '+919876543210', otp: '123456' });

  // Rotate once to generate a rotated token
  await service.refreshSession({ refreshToken: verified.refreshToken.raw });

  // Advance time within grace window
  time = new Date(time.getTime() + 2000);

  // Execute multiple parallel refreshes using the original revoked token
  const promises = [
    service.refreshSession({ refreshToken: verified.refreshToken.raw }),
    service.refreshSession({ refreshToken: verified.refreshToken.raw }),
    service.refreshSession({ refreshToken: verified.refreshToken.raw }),
  ];

  const results = await Promise.all(promises);
  for (const res of results) {
    assert.equal(res.skipCookieUpdate, true);
    assert.equal(res.access_token.split('.').length, 3);
  }
});

test('refreshSession falls back to grace period when rotateRefreshToken throws TOKEN_ALREADY_ROTATED', async () => {
  const repository = createMemoryRepository();
  const service = createAuthService({
    repository,
    otpProvider: { sendOtp: async () => {} },
    config: baseConfig,
    clock: () => fixedNow,
    randomBytes: () => Buffer.alloc(32, 1),
  });

  await service.sendCustomerOtp({ phone: '+919876543210' });
  const verified = await service.verifyCustomerOtp({ phone: '+919876543210', otp: '123456' });

  // Manually mock rotateRefreshToken to throw TOKEN_ALREADY_ROTATED during refreshSession.
  // This simulates the race condition where two requests read it as active, but one commits first.
  let throwRotated = false;
  repository.rotateRefreshToken = async ({ currentTokenId, nextToken }) => {
    if (throwRotated) {
      // Simulate that the token was concurrently updated in the DB
      const current = repository.data.refreshTokens.get(currentTokenId);
      current.revokedAt = fixedNow;
      current.replacedByTokenId = 'refresh-concurrent-successor';
      throw new Error('TOKEN_ALREADY_ROTATED');
    }
    // Normal first rotation behavior
    const current = repository.data.refreshTokens.get(currentTokenId);
    current.revokedAt = fixedNow;
    const created = { id: 'refresh-concurrent-successor', revokedAt: null, ...nextToken };
    repository.data.refreshTokens.set(created.id, created);
    current.replacedByTokenId = created.id;
    return created;
  };

  // Turn on simulation of the race condition
  throwRotated = true;

  // This call will hit rotateRefreshToken, which throws TOKEN_ALREADY_ROTATED.
  // It should catch the error, re-read the now-revoked token, and process it via the grace period path.
  const refreshed = await service.refreshSession({ refreshToken: verified.refreshToken.raw });

  assert.equal(refreshed.skipCookieUpdate, true);
  assert.equal(refreshed.access_token.split('.').length, 3);
});

test('refreshSession allows concurrent refresh with negative clock skew within grace limit', async () => {
  const repository = createMemoryRepository();
  let time = new Date('2026-06-02T00:00:10.000Z');
  const service = createAuthService({
    repository,
    otpProvider: { sendOtp: async () => {} },
    config: baseConfig,
    clock: () => time,
    randomBytes: () => Buffer.alloc(32, 1),
  });

  await service.sendCustomerOtp({ phone: '+919876543210' });
  const verified = await service.verifyCustomerOtp({ phone: '+919876543210', otp: '123456' });

  // Rotate the token once, setting revokedAt in DB to 2026-06-02T00:00:10.000Z
  await service.refreshSession({ refreshToken: verified.refreshToken.raw });

  // Simulate a negative clock skew: the clock on the service evaluates currentNow to 2026-06-02T00:00:08.000Z (2 seconds in the past)
  time = new Date('2026-06-02T00:00:08.000Z');

  // Verify that the reuse of the revoked token is allowed because timeSinceRevocation (-2000ms) is >= -gracePeriodMs (-10000ms)
  const refreshedSkew = await service.refreshSession({ refreshToken: verified.refreshToken.raw });

  assert.equal(refreshedSkew.skipCookieUpdate, true);
  assert.equal(refreshedSkew.access_token.split('.').length, 3);
});


