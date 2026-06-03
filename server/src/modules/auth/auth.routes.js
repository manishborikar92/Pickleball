import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { validate } from '../../middleware/validate.middleware.js';
import { authenticate } from '../../middleware/authenticate.middleware.js';
import { createAuthController } from './auth.controller.js';
import { sendOtpSchema, staffLoginSchema, verifyOtpSchema } from './auth.validators.js';
import { createOnboardingRouter } from '../users/users.routes.js';

const authLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const otpLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

export const createAuthRouter = ({ authService, userService } = {}) => {
  if (!authService) {
    throw new Error('authService is required');
  }

  const router = Router();
  const controller = createAuthController({ authService });

  router.post('/otp/send', otpLimiter, validate(sendOtpSchema), controller.sendOtp);
  router.post('/otp/verify', otpLimiter, validate(verifyOtpSchema), controller.verifyOtp);
  router.post('/staff/login', authLimiter, validate(staffLoginSchema), controller.loginStaff);
  router.post('/refresh', authLimiter, controller.refresh);
  router.post('/logout', controller.logout);
  router.post('/logout-all', authenticate(), controller.logoutAll);
  if (userService) {
    router.use(createOnboardingRouter({ userService }));
  }

  return router;
};
