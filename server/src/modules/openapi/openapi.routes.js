import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import { createOpenApiSpec } from './openapi.spec.js';

export const createOpenApiRouter = ({ config } = {}) => {
  const router = Router();
  const spec = createOpenApiSpec({ config });

  router.get('/openapi.json', (_req, res) => {
    res.json(spec);
  });

  if (!config?.isProduction) {
    router.use('/', swaggerUi.serve, swaggerUi.setup(spec));
  }

  return router;
};
