import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { requireOnboarding } from '../../middleware/require-onboarding.middleware.js';
import { createPaymentsController } from './payments.controller.js';
import { createRedirectController } from './redirect.controller.js';
import {
  paymentIdParamsSchema,
  paymentOrderParamsSchema,
  refundBodySchema,
} from './payments.validators.js';

export const createPaymentsRouter = ({
  paymentsService,
  paymentProvider,
  bookingsService,
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

  // PhonePe post-payment browser redirect (public — no auth).
  if (paymentProvider && bookingsService) {
    const redirectController = createRedirectController({ bookingsService, paymentProvider, config });
    router.get('/redirect', redirectController.handleRedirect);
  }

  router.post('/:paymentId/refund', authMiddleware, validate(paymentIdParamsSchema, 'params'), validate(refundBodySchema, 'body'), controller.refundPayment);
  router.post('/:paymentId/refund/retry', authMiddleware, validate(paymentIdParamsSchema, 'params'), controller.retryRefund);

  return router;
};

