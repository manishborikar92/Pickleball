import { Router } from 'express';

import { validate } from '../../middleware/validate.middleware.js';
import { createVenuesController } from './venues.controller.js';
import {
  venueAvailabilityParamsSchema,
  venueAvailabilityQuerySchema,
  venueIdParamsSchema,
  venueSlugParamsSchema,
} from './venues.validators.js';

export const createVenuesRouter = ({ venueService } = {}) => {
  if (!venueService) {
    throw new Error('venueService is required');
  }

  const router = Router();
  const controller = createVenuesController({ venueService });

  router.get('/slug/:slug', validate(venueSlugParamsSchema, 'params'), controller.getBySlug);
  router.get('/:venueId/availability', validate(venueAvailabilityParamsSchema, 'params'), validate(venueAvailabilityQuerySchema, 'query'), controller.getAvailability);
  router.get('/:venueId', validate(venueIdParamsSchema, 'params'), controller.getById);

  return router;
};
