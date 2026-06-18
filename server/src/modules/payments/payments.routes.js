import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createPaymentsController } from './payments.controller.js';
import { paymentOrderParamsSchema } from './payments.validators.js';

export const createPaymentsRouter = ({
  paymentsService,
  authMiddleware = authenticate(),
} = {}) => {
  if (!paymentsService) {
    throw new Error('paymentsService is required');
  }

  const router = Router();
  const controller = createPaymentsController({ paymentsService });

  router.get('/status/:merchantOrderId', authMiddleware, validate(paymentOrderParamsSchema, 'params'), controller.getPaymentStatus);
  router.get('/sandbox/:merchantOrderId/complete', validate(paymentOrderParamsSchema, 'params'), controller.completeSandboxPayment);
  router.get('/sandbox/:merchantOrderId/fail', validate(paymentOrderParamsSchema, 'params'), controller.failSandboxPayment);

  return router;
};
