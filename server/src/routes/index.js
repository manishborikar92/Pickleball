import { Router } from 'express';

import { createHealthRouter } from '../modules/health/health.routes.js';
import { createDefaultAuthRouter } from '../modules/auth/index.js';
import { createDefaultUsersRouter, createDefaultUsersService } from '../modules/users/index.js';
import { createOpenApiRouter } from '../modules/openapi/openapi.routes.js';
import { createDefaultBookingsService } from '../modules/bookings/index.js';
import { createBookingsRouter } from '../modules/bookings/bookings.routes.js';
import { createDefaultPaymentsRouter } from '../modules/payments/index.js';
import { createDefaultVenuesRouter } from '../modules/venues/index.js';

export const createRouter = ({ config, startedAt, configureRoutes } = {}) => {
  const router = Router();

  router.use(createHealthRouter({ config, startedAt }));

  if (typeof configureRoutes === 'function') {
    configureRoutes(router);
  }

  const userService = createDefaultUsersService();
  const bookingsService = createDefaultBookingsService({ config });
  router.use('/auth', createDefaultAuthRouter({ config, userService }));
  router.use('/users', createDefaultUsersRouter());
  router.use('/venues', createDefaultVenuesRouter());
  router.use('/bookings', createBookingsRouter({ bookingsService }));
  router.use('/payments', createDefaultPaymentsRouter({ bookingsService, config }));
  router.use('/docs', createOpenApiRouter({ config }));

  return router;
};
