import { Router } from 'express';

import { createWebhookController } from './webhook.controller.js';

/**
 * Webhook routes — mounted at /api/v1/payments/webhooks.
 *
 * No authentication middleware (webhook auth is handled in controller via SHA256).
 * Body is standard JSON parsed by Express's built-in json() middleware.
 */
export const createPaymentsWebhookRouter = ({ bookingsService, reconciliationService, config } = {}) => {
  const router = Router();
  const controller = createWebhookController({ bookingsService, reconciliationService, config });

  router.post('/phonepe', controller.handleWebhook);

  return router;
};
