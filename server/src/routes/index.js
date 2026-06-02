import { Router } from 'express';

import { createHealthRouter } from '../modules/health/health.routes.js';
import { createDefaultAuthRouter } from '../modules/auth/index.js';
import { createDefaultUsersRouter, createDefaultUsersService } from '../modules/users/index.js';
import { createOpenApiRouter } from '../modules/openapi/openapi.routes.js';

export const createRouter = ({ config, startedAt, configureRoutes } = {}) => {
  const router = Router();

  router.use(createHealthRouter({ config, startedAt }));

  if (typeof configureRoutes === 'function') {
    configureRoutes(router);
  }

  const userService = createDefaultUsersService();
  router.use('/auth', createDefaultAuthRouter({ config, userService }));
  router.use('/users', createDefaultUsersRouter());
  router.use('/docs', createOpenApiRouter({ config }));

  return router;
};
