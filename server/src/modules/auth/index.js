import { createAuthRepository } from './auth.repository.js';
import { createAuthRouter } from './auth.routes.js';
import { createAuthService } from './auth.service.js';
import { createOtpProvider } from './otp.provider.js';

export const createDefaultAuthService = ({ config } = {}) => {
  const repository = createAuthRepository();
  const otpProvider = createOtpProvider({ config });
  return createAuthService({
    repository,
    otpProvider,
    config,
  });
};

export const createDefaultAuthRouter = ({ userService, authService } = {}) => {
  return createAuthRouter({ authService, userService });
};
