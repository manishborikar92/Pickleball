import { createAuthRepository } from './auth.repository.js';
import { createAuthRouter } from './auth.routes.js';
import { createAuthService } from './auth.service.js';
import { createOtpProvider } from './otp.provider.js';

export const createDefaultAuthRouter = ({ config, userService }) => {
  const repository = createAuthRepository();
  const otpProvider = createOtpProvider({ config });
  const authService = createAuthService({
    repository,
    otpProvider,
    config,
  });

  return createAuthRouter({ authService, userService });
};
