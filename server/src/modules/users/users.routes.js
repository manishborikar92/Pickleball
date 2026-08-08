import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { requireOnboarding } from '../../middleware/require-onboarding.middleware.js';
import { createUsersController } from './users.controller.js';
import { myBookingsQuerySchema, onboardingSchema, profileUpdateSchema } from './users.validators.js';

export const createUsersRouter = ({
  userService,
  authMiddleware = authenticate(),
  onboardingMiddleware = requireOnboarding(),
} = {}) => {
  if (!userService) {
    throw new Error('userService is required');
  }

  const router = Router();
  const controller = createUsersController({ userService });

  router.get('/me', authMiddleware, controller.currentUser);
  router.patch('/me', authMiddleware, onboardingMiddleware, validate(profileUpdateSchema), controller.updateProfile);
  router.get('/me/bookings', authMiddleware, onboardingMiddleware, validate(myBookingsQuerySchema, 'query'), controller.myBookings);
  router.get('/me/wallet', authMiddleware, onboardingMiddleware, controller.myWallet);

  return router;
};

export const createOnboardingRouter = ({ userService } = {}) => {
  if (!userService) {
    throw new Error('userService is required');
  }

  const router = Router();
  const controller = createUsersController({ userService });

  router.post('/onboarding', authenticate(), validate(onboardingSchema), controller.completeOnboarding);

  return router;
};
