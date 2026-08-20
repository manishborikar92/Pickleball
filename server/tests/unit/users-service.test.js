import assert from 'node:assert/strict';
import test from 'node:test';

import { createUsersService } from '../../src/modules/users/users.service.js';

test('updateProfile delegates the authenticated user and normalized name to the repository', async () => {
  const calls = [];
  const repository = {
    updateProfile: async (input) => {
      calls.push(input);
      return {
        id: 'user-1',
        phone: '+919876543210',
        name: input.name,
        onboarding_complete: true,
        role: 'customer',
        venue_roles: [],
        permissions: ['view_own_bookings'],
      };
    },
  };

  const result = await createUsersService({ repository }).updateProfile({
    userId: 'user-1',
    name: 'Asha Mehta',
  });

  assert.deepEqual(calls, [{ userId: 'user-1', name: 'Asha Mehta' }]);
  assert.equal(result.name, 'Asha Mehta');
  assert.deepEqual(result.permissions, ['view_own_bookings']);
});

test('completeOnboarding preserves the canonical auth profile in its response', async () => {
  const repository = {
    completeOnboarding: async ({ userId, name }) => ({
      id: userId,
      phone: '+919876543210',
      name,
      onboarding_complete: true,
      role: 'customer',
      venue_roles: [],
      permissions: ['view_own_bookings'],
    }),
  };

  const result = await createUsersService({ repository }).completeOnboarding({
    userId: 'user-1',
    name: 'Asha Mehta',
  });

  assert.equal(result.user.role, 'customer');
  assert.deepEqual(result.user.venue_roles, []);
  assert.equal(result.next_step, 'resume_booking');
});
