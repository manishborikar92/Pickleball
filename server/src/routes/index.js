import { Router } from 'express';

import { createHealthRouter } from '../modules/health/health.routes.js';
import { createDefaultAuthRouter, createDefaultAuthService } from '../modules/auth/index.js';
import { createDefaultUsersRouter, createDefaultUsersService } from '../modules/users/index.js';
import { createOpenApiRouter } from '../modules/openapi/openapi.routes.js';
import { createDefaultBookingsService } from '../modules/bookings/index.js';
import { createBookingsRouter } from '../modules/bookings/bookings.routes.js';
import { createDefaultPaymentsRouter } from '../modules/payments/index.js';
import { createDefaultVenuesRouter, createDefaultVenuesService } from '../modules/venues/index.js';
import { createPaymentProviderFromEnv } from '../modules/payments/provider-factory.js';
import { createDefaultReviewsService, createReviewsRouter } from '../modules/reviews/index.js';
import { createDefaultRewardsService, createRewardsRouter } from '../modules/rewards/index.js';
import { createRequireVenuePermission } from '../middleware/authorize.middleware.js';

export const createRouter = ({ config, startedAt, configureRoutes } = {}) => {
  const router = Router();

  router.use(createHealthRouter({ config, startedAt }));

  if (typeof configureRoutes === 'function') {
    configureRoutes(router);
  }

  const userService = createDefaultUsersService();
  const venueService = createDefaultVenuesService();
  const authorizationService = createDefaultAuthService({ config });

  // Create payment provider ONCE and share across modules.
  const paymentProvider = createPaymentProviderFromEnv(config);

  const bookingsService = createDefaultBookingsService({ config, venueService, paymentProvider });
  const reviewsService = createDefaultReviewsService({ authorizationService });
  const rewardsService = createDefaultRewardsService({ authorizationService });

  const { router: paymentsRouter, reconciliationService } = createDefaultPaymentsRouter({
    bookingsService,
    config,
    authService: authorizationService,
    paymentProvider,
  });

  // Create venue permission middleware factory for admin routes
  const requireVenuePermission = createRequireVenuePermission({ authorizationService });

  router.use('/auth', createDefaultAuthRouter({ config, userService, authService: authorizationService }));
  router.use('/users', createDefaultUsersRouter({ userService }));
  router.use('/venues', createDefaultVenuesRouter({ venueService }));
  router.use('/bookings', createBookingsRouter({ bookingsService }));
  router.use('/payments', paymentsRouter);
  router.use('/reviews', createReviewsRouter({ reviewsService, requireVenuePermission }));
  router.use('/rewards', createRewardsRouter({ rewardsService, requireVenuePermission }));
  router.use('/docs', createOpenApiRouter({ config }));

  return router;
};

