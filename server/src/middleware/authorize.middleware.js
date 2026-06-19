import {
  ConfigurationError,
  MissingVenueContextError,
  PermissionDeniedError,
  UnauthorizedError,
} from '../utils/api-error.js';

export const createRequireVenuePermission = ({ authorizationService } = {}) => {
  return ({ permission, venueResolver }) => async (req, _res, next) => {
    try {
      if (!req.auth?.subject) {
        throw new UnauthorizedError('Authentication required');
      }

      if (!authorizationService) {
        throw new ConfigurationError('authorizationService is required for requireVenuePermission');
      }

      if (typeof venueResolver !== 'function') {
        throw new ConfigurationError('venueResolver is required and must be a function');
      }

      const venueId = venueResolver(req);
      if (!venueId) {
        throw new MissingVenueContextError('Venue context required for this operation');
      }

      const hasPerm = await authorizationService.hasPermission({
        userId: req.auth.subject,
        venueId,
        permission,
      });

      if (!hasPerm) {
        throw new PermissionDeniedError('Missing required permissions');
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};

