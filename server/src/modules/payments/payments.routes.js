import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { requireOnboarding } from '../../middleware/require-onboarding.middleware.js';
import { createPaymentsController } from './payments.controller.js';
import { createVerifyController } from './verify.controller.js';
import { createPaymentsWebhookRouter } from './webhook.routes.js';
import {
  paymentVerifyQuerySchema,
  paymentIdParamsSchema,
  paymentOrderParamsSchema,
  refundBodySchema,
} from './payments.validators.js';

export const createPaymentsRouter = ({
  paymentsService,
  paymentProvider,
  bookingsService,
  reconciliationService,
  config,
  authMiddleware = authenticate(),
  onboardingMiddleware = requireOnboarding(),
} = {}) => {
  if (!paymentsService) {
    throw new Error('paymentsService is required');
  }

  const router = Router();
  const controller = createPaymentsController({ paymentsService });

  router.get('/status/:merchantOrderId', authMiddleware, onboardingMiddleware, validate(paymentOrderParamsSchema, 'params'), controller.getPaymentStatus);

  // PhonePe "Verify Payment Response" step (public — the gateway redirect
  // carries no auth). The frontend /booking/redirect page — the target of
  // merchantUrls.redirectUrl — calls this JSON endpoint server-side, so the
  // backend origin never reaches the customer's browser.
  if (paymentProvider && bookingsService) {
    const verifyController = createVerifyController({ bookingsService, paymentProvider });
    router.get('/verify', validate(paymentVerifyQuerySchema, 'query'), verifyController.handleVerify);
  }

  // Webhook receiver endpoint: POST /payments/webhooks/phonepe (public S2S callback)
  if (reconciliationService) {
    router.use('/webhooks', createPaymentsWebhookRouter({ bookingsService, reconciliationService, config }));
  }

  router.post('/:paymentId/refund', authMiddleware, validate(paymentIdParamsSchema, 'params'), validate(refundBodySchema, 'body'), controller.refundPayment);
  router.post('/:paymentId/refund/retry', authMiddleware, validate(paymentIdParamsSchema, 'params'), controller.retryRefund);

  return router;
};

