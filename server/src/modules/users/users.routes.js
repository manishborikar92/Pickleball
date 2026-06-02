import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createUsersController } from './users.controller.js';
import { onboardingSchema } from './users.validators.js';

export const createUsersRouter = ({ userService } = {}) => {
  if (!userService) {
    throw new Error('userService is required');
  }

  const router = Router();
  const controller = createUsersController({ userService });

  router.get('/me', authenticate(), controller.currentUser);

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
