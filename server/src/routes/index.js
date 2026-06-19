import { Router } from 'express';

import { createHealthRouter } from '../modules/health/health.routes.js';
import { createDefaultAuthRouter, createDefaultAuthService } from '../modules/auth/index.js';
import { createDefaultUsersRouter, createDefaultUsersService } from '../modules/users/index.js';
import { createOpenApiRouter } from '../modules/openapi/openapi.routes.js';
import { createDefaultBookingsService } from '../modules/bookings/index.js';
import { createBookingsRouter } from '../modules/bookings/bookings.routes.js';
import { createDefaultPaymentsRouter } from '../modules/payments/index.js';
import { createDefaultVenuesRouter, createDefaultVenuesService } from '../modules/venues/index.js';

export const createRouter = ({ config, startedAt, configureRoutes } = {}) => {
  const router = Router();

  router.use(createHealthRouter({ config, startedAt }));

  if (typeof configureRoutes === 'function') {
    configureRoutes(router);
  }

  const userService = createDefaultUsersService();
  const venueService = createDefaultVenuesService();
  const bookingsService = createDefaultBookingsService({ config, venueService });
  const authorizationService = createDefaultAuthService({ config });

  router.use('/auth', createDefaultAuthRouter({ config, userService, authService: authorizationService }));
  router.use('/users', createDefaultUsersRouter({ userService }));
  router.use('/venues', createDefaultVenuesRouter({ venueService }));
  router.use('/bookings', createBookingsRouter({ bookingsService }));
  router.use('/payments', createDefaultPaymentsRouter({ bookingsService, config, authService: authorizationService }));
  router.use('/docs', createOpenApiRouter({ config }));

  return router;
};
