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
        roles: [],
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
