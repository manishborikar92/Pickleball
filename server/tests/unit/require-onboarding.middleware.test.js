import assert from 'node:assert/strict';
import test from 'node:test';

import { requireOnboarding } from '../../src/middleware/require-onboarding.middleware.js';

async function invokeMiddleware({ subject, user }) {
  const req = subject ? { auth: { subject } } : { auth: {} };
  let nextError;
  let queryCount = 0;
  const middleware = requireOnboarding({
    prisma: {
      user: {
        findUnique: async () => {
          queryCount += 1;
          return user;
        },
      },
    },
  });

  await middleware(req, {}, (error) => {
    nextError = error;
  });

  return { nextError, queryCount, req };
}

test('requireOnboarding allows an onboarded user with a name and completion timestamp', async () => {
  const result = await invokeMiddleware({
    subject: 'onboarded-user-1',
    user: {
      id: 'onboarded-user-1',
      name: 'Asha Mehta',
      onboardingCompletedAt: new Date('2026-06-01T00:00:00.000Z'),
    },
  });

  assert.equal(result.nextError, undefined);
  assert.equal(result.queryCount, 1);
  assert.equal(result.req.auth.user.id, 'onboarded-user-1');
  assert.equal(result.req.auth.user.name, 'Asha Mehta');
  assert.equal(result.req.auth.user.onboarding_complete, true);
});

test('requireOnboarding rejects a named user without a completion timestamp', async () => {
  const result = await invokeMiddleware({
    subject: 'incomplete-user-1',
    user: {
      id: 'incomplete-user-1',
      name: 'Asha Mehta',
      onboardingCompletedAt: null,
    },
  });

  assert.equal(result.nextError?.statusCode, 403);
  assert.equal(result.nextError?.details?.code, 'ONBOARDING_INCOMPLETE');
  assert.equal(result.req.auth.user, undefined);
});

test('requireOnboarding rejects an unnamed user before the protected handler runs', async () => {
  const result = await invokeMiddleware({
    subject: 'incomplete-user-1',
    user: {
      id: 'incomplete-user-1',
      name: null,
      onboardingCompletedAt: null,
    },
  });

  assert.equal(result.nextError?.statusCode, 403);
  assert.equal(result.nextError?.details?.code, 'ONBOARDING_INCOMPLETE');
  assert.equal(result.req.auth.user, undefined);
});

test('requireOnboarding rejects requests without an authenticated subject', async () => {
  const result = await invokeMiddleware({ subject: null, user: null });

  assert.equal(result.nextError?.statusCode, 401);
  assert.equal(result.queryCount, 0);
});
