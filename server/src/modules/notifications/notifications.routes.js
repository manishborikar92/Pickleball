import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createNotificationsController } from './notifications.controller.js';
import {
  logQuerySchema,
  settingsQuerySchema,
  updateSettingsSchema,
} from './notifications.validators.js';

/**
 * Notification admin routes — all owned by the notifications module and mounted
 * under `/notifications`. Venue permission is resolved at the route layer from
 * the `venue_id` in the query/body (mirrors the reviews/rewards list endpoints);
 * the service does not re-authorize (ADR-011).
 *
 *   GET   /notifications/settings        — manage_venues
 *   PATCH /notifications/settings        — manage_venues
 *   GET   /notifications/log             — manage_bookings
 */
export const createNotificationsRouter = ({
  notificationsService,
  requireVenuePermission,
  authMiddleware = authenticate(),
} = {}) => {
  if (!notificationsService) throw new Error('notificationsService is required');
  if (!requireVenuePermission) throw new Error('requireVenuePermission is required');

  const router = Router();
  const controller = createNotificationsController({ notificationsService });

  router.get(
    '/settings',
    authMiddleware,
    requireVenuePermission({
      permission: 'manage_venues',
      venueResolver: (req) => req.query.venue_id,
    }),
    validate(settingsQuerySchema, 'query'),
    controller.getSettings,
  );

  router.patch(
    '/settings',
    authMiddleware,
    requireVenuePermission({
      permission: 'manage_venues',
      venueResolver: (req) => req.body.venue_id,
    }),
    validate(updateSettingsSchema),
    controller.updateSettings,
  );

  router.get(
    '/log',
    authMiddleware,
    requireVenuePermission({
      permission: 'manage_bookings',
      venueResolver: (req) => req.query.venue_id,
    }),
    validate(logQuerySchema, 'query'),
    controller.getLog,
  );

  return router;
};
