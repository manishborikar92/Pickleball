import crypto from 'node:crypto';
import {
  AppError,
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from '../../utils/api-error.js';
import { Permissions } from '../../shared/auth-constants.js';
import {
  createAccessToken,
  createOtpHash,
  createRefreshToken,
  hashRefreshToken,
  normalizeIndianPhone,
  verifyPasswordHash,
  verifyOtpHash,
} from './auth.utils.js';

const addSeconds = (date, seconds) => new Date(date.getTime() + seconds * 1000);

const resolveOtpCode = (config) => {
  if (config.otp.mode === 'sandbox') {
    return '123456';
  }

  if (config.otp.mode === 'test') {
    return config.otp.testCode;
  }

  return String(crypto.randomInt(100000, 1000000));
};

const onboardingComplete = (user) => Boolean(user?.onboardingCompletedAt);

const determineNextStep = ({ user, roles = [] }) => {
  const nonCustomerRole = roles.find((role) => role !== 'customer');
  if (!onboardingComplete(user)) {
    return 'complete_onboarding';
  }
  if (nonCustomerRole) {
    return 'admin_dashboard';
  }
  return 'resume_booking';
};

const serializeUser = ({ user, isNewUser = false }) => ({
  id: user.id,
  phone: user.phone,
  name: user.name,
  is_new_user: isNewUser,
  onboarding_complete: onboardingComplete(user),
});

const serializeStaffUser = ({ credential }) => ({
  id: credential.user.id,
  email: credential.email,
  name: credential.user.name,
  roles: credential.roles || [],
  permissions: credential.permissions || [],
});

export const createAuthService = ({
  repository,
  otpProvider,
  config,
  clock = () => new Date(),
  randomBytes,
}) => {
  const issueTokenPair = async ({
    user,
    roles,
    permissions,
    sessionId,
    parentRefreshTokenId = null,
    replaceRefreshTokenId = null,
  }) => {
    const now = clock();
    const accessToken = createAccessToken({
      userId: user.id,
      sessionId,
      roles,
      permissions,
      config: config.auth,
      now,
    });

    const refreshToken = createRefreshToken({ randomBytes });
    const refreshTokenRecord = {
      sessionId,
      userId: user.id,
      tokenHash: refreshToken.hash,
      parentTokenId: parentRefreshTokenId,
      expiresAt: addSeconds(now, config.auth.refreshTokenTtlSeconds),
    };
    const savedRefreshToken = replaceRefreshTokenId
      ? await repository.rotateRefreshToken({
        currentTokenId: replaceRefreshTokenId,
        nextToken: refreshTokenRecord,
      })
      : await repository.createRefreshToken(refreshTokenRecord);

    return {
      access_token: accessToken,
      expires_in: config.auth.accessTokenTtlSeconds,
      refreshToken: {
        id: savedRefreshToken.id,
        raw: refreshToken.raw,
      },
    };
  };

  return {
    async sendCustomerOtp({ phone, ipAddress }) {
      const normalizedPhone = normalizeIndianPhone(phone);
      if (!normalizedPhone) {
        throw new BadRequestError('Invalid phone number');
      }

      const latestOtp = await repository.findLatestActiveOtp({ phone: normalizedPhone });
      const now = clock();
      if (latestOtp) {
        const secondsSinceLast = Math.floor((now.getTime() - latestOtp.createdAt.getTime()) / 1000);
        const cooldownSeconds = 60;
        if (secondsSinceLast < cooldownSeconds) {
          throw new BadRequestError(`Please wait ${cooldownSeconds - secondsSinceLast} seconds before requesting a new OTP.`);
        }
      }

      const code = resolveOtpCode(config);
      const expiresAt = addSeconds(now, config.otp.ttlSeconds);

      await repository.createOtpRequest({
        phone: normalizedPhone,
        purpose: 'customer_login',
        otpHash: await createOtpHash(code),
        expiresAt,
        ipAddress,
        attemptCount: 0,
      });

      await otpProvider.sendOtp({
        phone: normalizedPhone,
        code,
        purpose: 'customer_login',
      });

      return {
        phone: normalizedPhone,
        expiresInSeconds: config.otp.ttlSeconds,
        ...(config.otp.mode === 'sandbox' ? { sandboxOtp: code } : {}),
      };
    },

    async verifyCustomerOtp({
      phone,
      otp,
      ipAddress = null,
      userAgent = null,
    }) {
      const normalizedPhone = normalizeIndianPhone(phone);
      if (!normalizedPhone) {
        throw new BadRequestError('Invalid phone number');
      }

      const latestOtp = await repository.findLatestActiveOtp({ phone: normalizedPhone });
      const now = clock();
      if (!latestOtp || latestOtp.expiresAt <= now) {
        throw new BadRequestError('OTP expired or not found');
      }

      if (latestOtp.attemptCount >= config.otp.maxAttempts) {
        throw new BadRequestError('Too many failed attempts. Please request a new OTP.');
      }

      const valid = await verifyOtpHash(otp, latestOtp.otpHash);
      await repository.markOtpAttempt({
        id: latestOtp.id,
        verifiedAt: valid ? now : null,
      });

      if (!valid) {
        throw new BadRequestError('Invalid OTP');
      }

      const { user, isNewUser } = await repository.findOrCreateUserByPhone({
        phone: normalizedPhone,
      });
      const authContext = await repository.getUserAuthContext(user.id);
      const roles = authContext.roles.length > 0 ? authContext.roles : ['customer'];
      const permissions = authContext.permissions.length > 0
        ? authContext.permissions
        : [Permissions.VIEW_OWN_BOOKINGS];
      const session = await repository.createSession({
        userId: user.id,
        expiresAt: addSeconds(now, config.auth.refreshTokenTtlSeconds),
        ipAddress,
        userAgent,
      });
      const tokenPair = await issueTokenPair({
        user,
        roles,
        permissions,
        sessionId: session.id,
      });

      return {
        ...tokenPair,
        user: serializeUser({ user, isNewUser }),
        next_step: determineNextStep({ user, roles }),
      };
    },

    async loginStaff({
      email,
      password,
      ipAddress = null,
      userAgent = null,
    }) {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const credential = await repository.findStaffCredentialByEmail({
        email: normalizedEmail,
      });

      if (!credential) {
        throw new UnauthorizedError('Invalid credentials');
      }

      const now = clock();
      if (credential.status === 'suspended') {
        throw new ForbiddenError('Account suspended');
      }

      if (credential.status === 'pending_activation') {
        throw new ForbiddenError('Account not activated');
      }

      if (credential.status === 'locked' && credential.lockedUntil) {
        if (credential.lockedUntil > now) {
          throw new AppError('Account locked', 423, {
            locked_until: credential.lockedUntil,
          });
        }

        await repository.unlockStaffCredential(credential.id);
        credential.status = 'active';
        credential.failedLoginAttempts = 0;
        credential.lockedUntil = null;
      }

      const passwordValid = await verifyPasswordHash(password, credential.passwordHash);
      if (!passwordValid) {
        const nextFailedCount = (credential.failedLoginAttempts || 0) + 1;
        await repository.recordStaffLoginFailure({
          id: credential.id,
          lockedUntil: nextFailedCount >= 10
            ? addSeconds(now, 30 * 60)
            : null,
        });
        throw new UnauthorizedError('Invalid credentials');
      }

      await repository.recordStaffLoginSuccess({
        id: credential.id,
        ipAddress,
      });

      const roles = credential.roles?.length ? credential.roles : ['staff'];
      const permissions = credential.permissions?.length ? credential.permissions : [];
      const session = await repository.createSession({
        userId: credential.user.id,
        expiresAt: addSeconds(now, config.auth.refreshTokenTtlSeconds),
        ipAddress,
        userAgent,
      });
      const tokenPair = await issueTokenPair({
        user: credential.user,
        roles,
        permissions,
        sessionId: session.id,
      });

      return {
        ...tokenPair,
        user: serializeStaffUser({ credential }),
        next_step: credential.forcePasswordChange
          ? 'force_password_change'
          : 'admin_dashboard',
      };
    },

    async refreshSession({ refreshToken }) {
      if (!refreshToken) {
        throw new UnauthorizedError('Refresh token required');
      }

      const existing = await repository.findRefreshTokenByHash(hashRefreshToken(refreshToken));
      const now = clock();
      if (!existing) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      if (existing.expiresAt <= now) {
        throw new UnauthorizedError('Refresh token expired');
      }

      const handleGracePeriod = async (tokenRecord) => {
        const currentNow = clock();
        const timeSinceRevocation = currentNow.getTime() - tokenRecord.revokedAt.getTime();
        const gracePeriodMs = 10000; // 10 seconds
        const clockSkewToleranceMs = 2000; // 2 seconds

        const isLegitimateConcurrentRefresh =
          tokenRecord.replacedByTokenId !== null &&
          tokenRecord.replacedByTokenId !== undefined &&
          tokenRecord.session?.status === 'active' &&
          timeSinceRevocation >= -clockSkewToleranceMs &&
          timeSinceRevocation <= gracePeriodMs;

        const authContext = await repository.getUserAuthContext(tokenRecord.userId);
        const roles = authContext.roles.length > 0 ? authContext.roles : ['customer'];
        const permissions = authContext.permissions.length > 0
          ? authContext.permissions
          : [Permissions.VIEW_OWN_BOOKINGS];

        if (isLegitimateConcurrentRefresh) {
          const accessToken = createAccessToken({
            userId: tokenRecord.userId,
            sessionId: tokenRecord.sessionId,
            roles,
            permissions,
            config: config.auth,
            now: currentNow,
          });
          return {
            access_token: accessToken,
            expires_in: config.auth.accessTokenTtlSeconds,
            user: serializeUser({ user: authContext.user }),
            skipCookieUpdate: true,
          };
        } else {
          if (tokenRecord.session?.status === 'active') {
            await repository.revokeSession({
              sessionId: tokenRecord.sessionId,
              reason: 'refresh_token_reuse',
            });
          }
          throw new UnauthorizedError('Refresh token has been revoked');
        }
      };

      // If the token is already revoked, we check if it qualifies for the grace period.
      if (existing.revokedAt) {
        return handleGracePeriod(existing);
      }

      // For unrevoked tokens, we enforce that the parent session must be active.
      if (existing.session?.status !== 'active') {
        throw new UnauthorizedError('Refresh token expired');
      }

      const authContext = await repository.getUserAuthContext(existing.userId);
      const roles = authContext.roles.length > 0 ? authContext.roles : ['customer'];
      const permissions = authContext.permissions.length > 0
        ? authContext.permissions
        : [Permissions.VIEW_OWN_BOOKINGS];

      try {
        const tokenPair = await issueTokenPair({
          user: authContext.user,
          roles,
          permissions,
          sessionId: existing.sessionId,
          parentRefreshTokenId: existing.id,
          replaceRefreshTokenId: existing.id,
        });

        return {
          ...tokenPair,
          user: serializeUser({ user: authContext.user }),
        };
      } catch (err) {
        if (err.message === 'TOKEN_ALREADY_ROTATED') {
          const updatedToken = await repository.findRefreshTokenByHash(hashRefreshToken(refreshToken));
          if (updatedToken && updatedToken.revokedAt) {
            return handleGracePeriod(updatedToken);
          }
        }
        throw err;
      }
    },

    async logoutCurrent({ refreshToken }) {
      if (!refreshToken) {
        return;
      }
      const existing = await repository.findRefreshTokenByHash(hashRefreshToken(refreshToken));
      if (!existing) {
        return;
      }

      await repository.revokeRefreshToken({ id: existing.id });
      await repository.revokeSession({
        sessionId: existing.sessionId,
        reason: 'logout_current',
      });
    },

    async logoutAll({ userId }) {
      await repository.revokeAllUserSessions({
        userId,
        reason: 'logout_all',
      });
    },

    async hasPermission({ userId, venueId, permission }) {
      if (!userId || !venueId || !permission) {
        return false;
      }
      return repository.hasVenuePermission({
        userId,
        venueId,
        permissionKey: permission,
      });
    },
  };
};
