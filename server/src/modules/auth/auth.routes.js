import { Router } from 'express';

import { validate } from '../../middleware/validate.middleware.js';
import { authenticate } from '../../middleware/authenticate.middleware.js';
import { createAuthController } from './auth.controller.js';
import { sendOtpSchema, staffLoginSchema, verifyOtpSchema } from './auth.validators.js';
import { createOnboardingRouter } from '../users/users.routes.js';

export const createAuthRouter = ({ authService, userService } = {}) => {
  if (!authService) {
    throw new Error('authService is required');
  }

  const router = Router();
  const controller = createAuthController({ authService });

  router.post('/otp/send', validate(sendOtpSchema), controller.sendOtp);
  router.post('/otp/verify', validate(verifyOtpSchema), controller.verifyOtp);
  router.post('/staff/login', validate(staffLoginSchema), controller.loginStaff);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.post('/logout-all', authenticate(), controller.logoutAll);
  if (userService) {
    router.use(createOnboardingRouter({ userService }));
  }

  return router;
};
