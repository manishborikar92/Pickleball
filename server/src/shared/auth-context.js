import { DEFAULT_CUSTOMER_ROLE, DEFAULT_CUSTOMER_PERMISSIONS } from './auth-constants.js';

export const flattenAuthContext = (user) => {
  const roles = user.venueRoles?.map((assignment) => assignment.role.name) || [];
  const permissions = user.venueRoles?.flatMap((assignment) => (
    assignment.role.permissions.map((rolePermission) => rolePermission.permission.key)
  )) || [];

  return {
    user,
    roles: [...new Set(roles.length > 0 ? roles : [DEFAULT_CUSTOMER_ROLE])],
    permissions: [...new Set(permissions.length > 0 ? permissions : DEFAULT_CUSTOMER_PERMISSIONS)],
  };
};
