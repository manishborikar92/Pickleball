import assert from 'node:assert/strict';
import test from 'node:test';

import { flattenAuthContext } from '../../src/shared/auth-context.js';

const permission = (key) => ({ permission: { key } });

test('flattenAuthContext returns one effective role while preserving permission separation', () => {
  const context = flattenAuthContext({
    id: 'user-1',
    venueRoles: [
      {
        role: {
          name: 'customer',
          permissions: [permission('view_own_bookings')],
        },
      },
      {
        role: {
          name: 'manager',
          permissions: [permission('manage_bookings'), permission('view_own_bookings')],
        },
      },
    ],
  });

  assert.equal(context.role, 'manager');
  assert.deepEqual(context.permissions, ['view_own_bookings', 'manage_bookings']);
  assert.equal('roles' in context, false);
});

test('flattenAuthContext safely defaults an unassigned identity to customer', () => {
  const context = flattenAuthContext({ id: 'customer-1', venueRoles: [] });

  assert.equal(context.role, 'customer');
  assert.deepEqual(context.permissions, ['view_own_bookings']);
});

