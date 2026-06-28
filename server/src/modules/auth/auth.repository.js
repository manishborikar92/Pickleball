import { getPrisma } from '../../lib/prisma.js';
import { flattenAuthContext } from '../../shared/auth-context.js';
import { includeUserAuthContext } from '../../shared/auth-includes.js';

export const createAuthRepository = ({ prisma } = {}) => {
  const db = () => prisma || getPrisma();

  return {
  async createOtpRequest(record) {
    return db().otpRequest.create({
      data: record,
    });
  },

  async findLatestActiveOtp({ phone }) {
    return db().otpRequest.findFirst({
      where: {
        phone,
        verifiedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async markOtpAttempt({ id, verifiedAt = null }) {
    return db().otpRequest.update({
      where: { id },
      data: {
        attemptCount: { increment: 1 },
        verifiedAt,
      },
    });
  },

  async findOrCreateUserByPhone({ phone }) {
    const existing = await db().user.findUnique({ where: { phone } });
    if (existing) {
      const user = existing.isPhoneVerified
        ? existing
        : await db().user.update({
          where: { id: existing.id },
          data: { isPhoneVerified: true },
        });
      return { user, isNewUser: false };
    }

    const user = await db().user.create({
      data: {
        phone,
        isPhoneVerified: true,
      },
    });
    return { user, isNewUser: true };
  },

  async findAdminCredentialByEmail({ email }) {
    const credential = await db().adminCredential.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        user: {
          include: includeUserAuthContext,
        },
      },
    });

    if (!credential) {
      return null;
    }

    const authContext = flattenAuthContext(credential.user);
    return {
      ...credential,
      roles: authContext.roles,
      permissions: authContext.permissions,
    };
  },

  async recordAdminLoginFailure({ id, lockedUntil = null }) {
    return db().adminCredential.update({
      where: { id },
      data: {
        failedLoginAttempts: { increment: 1 },
        ...(lockedUntil
          ? {
              status: 'locked',
              lockedUntil,
            }
          : {}),
      },
    });
  },

  async recordAdminLoginSuccess({ id, ipAddress = null }) {
    return db().adminCredential.update({
      where: { id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });
  },

  async unlockAdminCredential(id) {
    return db().adminCredential.update({
      where: { id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        status: 'active',
      },
    });
  },

  async createSession(record) {
    return db().authSession.create({
      data: record,
    });
  },

  async createRefreshToken(record) {
    return db().refreshToken.create({
      data: record,
    });
  },

  async rotateRefreshToken({ currentTokenId, nextToken }) {
    return db().$transaction(async (tx) => {
      const updated = await tx.refreshToken.updateMany({
        where: {
          id: currentTokenId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      if (updated.count === 0) {
        throw new Error('TOKEN_ALREADY_ROTATED');
      }

      const created = await tx.refreshToken.create({
        data: nextToken,
      });

      await tx.refreshToken.update({
        where: { id: currentTokenId },
        data: { replacedByTokenId: created.id },
      });

      return created;
    });
  },

  async findRefreshTokenByHash(tokenHash) {
    return db().refreshToken.findUnique({
      where: { tokenHash },
      include: { session: true },
    });
  },

  async revokeRefreshToken({ id, replacedByTokenId = null }) {
    return db().refreshToken.update({
      where: { id },
      data: {
        revokedAt: new Date(),
        replacedByTokenId,
      },
    });
  },

  async revokeSession({ sessionId, reason }) {
    await db().refreshToken.updateMany({
      where: {
        sessionId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return db().authSession.update({
      where: { id: sessionId },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });
  },

  async revokeAllUserSessions({ userId, reason }) {
    await db().refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return db().authSession.updateMany({
      where: {
        userId,
        status: 'active',
      },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });
  },

  async getUserAuthContext(userId) {
    const user = await db().user.findUnique({
      where: { id: userId },
      include: includeUserAuthContext,
    });

    return flattenAuthContext(user);
  },

  async hasVenuePermission({ userId, venueId, permissionKey }) {
    const count = await db().venueUserRole.count({
      where: {
        userId,
        venueId,
        role: {
          permissions: {
            some: {
              permission: {
                key: permissionKey,
              },
            },
          },
        },
      },
    });

    return count > 0;
  },
  };
};
