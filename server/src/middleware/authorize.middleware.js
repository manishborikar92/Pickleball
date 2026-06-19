import { ForbiddenError, UnauthorizedError } from '../utils/api-error.js';

/**
 * @deprecated Use requireVenuePermission instead.
 */
export const authorize = (...allowedRoles) => (req, _res, next) => {
  if (!req.auth) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (allowedRoles.length === 0) {
    return next();
  }

  const grantedRoles = new Set([
    ...(Array.isArray(req.auth.roles) ? req.auth.roles : []),
    req.auth.role,
  ].filter(Boolean));

  if (!allowedRoles.some((role) => grantedRoles.has(role))) {
    return next(new ForbiddenError('Insufficient permissions'));
  }

  return next();
};

/**
 * @deprecated Use requireVenuePermission instead.
 */
export const requirePermissions = (...requiredPermissions) => (req, _res, next) => {
  if (!req.auth) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const granted = new Set(req.auth.permissions || []);
  const missing = requiredPermissions.filter((permission) => !granted.has(permission));
  if (missing.length > 0) {
    return next(new ForbiddenError('Missing required permissions', { missing }));
  }

  return next();
};

export const requireVenuePermission = (permissionKey) => async (req, _res, next) => {
  try {
    if (!req.auth?.subject) {
      throw new UnauthorizedError('Authentication required');
    }

    const venueId = req.params?.venueId || req.params?.id || req.query?.venueId || req.body?.venueId;
    if (!venueId) {
      throw new ForbiddenError('Venue context required for this operation');
    }

    const authService = req.app.get('authService');
    if (!authService) {
      throw new Error('authService is required for requireVenuePermission');
    }

    const hasPerm = await authService.hasPermission({
      userId: req.auth.subject,
      venueId,
      permission: permissionKey,
    });

    if (!hasPerm) {
      throw new ForbiddenError('Missing required permissions');
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
