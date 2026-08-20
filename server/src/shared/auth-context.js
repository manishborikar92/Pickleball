import {
  DEFAULT_CUSTOMER_PERMISSIONS,
  resolveEffectiveRole,
} from './auth-constants.js';

export const flattenAuthContext = (user) => {
  const assignedRoles = user?.venueRoles?.map((assignment) => assignment?.role?.name) || [];
  const permissions = user?.venueRoles?.flatMap((assignment) => (
    assignment?.role?.permissions?.map((rolePermission) => rolePermission?.permission?.key).filter(Boolean) || []
  )) || [];

  return {
    user,
    role: resolveEffectiveRole(assignedRoles),
    permissions: [...new Set(permissions.length > 0 ? permissions : DEFAULT_CUSTOMER_PERMISSIONS)],
  };
};
