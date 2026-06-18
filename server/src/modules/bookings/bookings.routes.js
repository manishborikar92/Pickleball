import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.middleware.js';
import { requireOnboarding } from '../../middleware/require-onboarding.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createBookingsController } from './bookings.controller.js';
import {
  bookingParamsSchema,
  bookingSelectionSchema,
  initiatePaymentSchema,
  waiverSchema,
} from './bookings.validators.js';

export const createBookingsRouter = ({
  bookingsService,
  authMiddleware = authenticate(),
  onboardingMiddleware = requireOnboarding(),
} = {}) => {
  if (!bookingsService) {
    throw new Error('bookingsService is required');
  }

  const router = Router();
  const controller = createBookingsController({ bookingsService });

  router.post('/price-preview', validate(bookingSelectionSchema), controller.pricePreview);
  router.post('/hold', authMiddleware, onboardingMiddleware, validate(bookingSelectionSchema), controller.createHold);
  router.get('/:bookingId', authMiddleware, onboardingMiddleware, validate(bookingParamsSchema, 'params'), controller.getBooking);
  router.post('/:bookingId/waiver', authMiddleware, onboardingMiddleware, validate(bookingParamsSchema, 'params'), validate(waiverSchema), controller.acceptWaiver);
  router.post('/:bookingId/initiate-payment', authMiddleware, onboardingMiddleware, validate(bookingParamsSchema, 'params'), validate(initiatePaymentSchema), controller.initiatePayment);

  return router;
};
