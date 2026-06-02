import { getPrisma } from '../../lib/prisma.js';

const CUSTOMER_PERMISSIONS = ['view_own_bookings'];

const flattenAuthContext = (user) => {
  const roles = user.venueRoles?.map((assignment) => assignment.role.name) || [];
  const permissions = user.venueRoles?.flatMap((assignment) => (
    assignment.role.permissions.map((rolePermission) => rolePermission.permission.key)
  )) || [];

  return {
    user,
    roles: [...new Set(roles.length > 0 ? roles : ['customer'])],
    permissions: [...new Set(permissions.length > 0 ? permissions : CUSTOMER_PERMISSIONS)],
  };
};

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

  async findStaffCredentialByEmail({ email }) {
    const credential = await db().staffCredential.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        user: {
          include: {
            venueRoles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: { permission: true },
                    },
                  },
                },
              },
            },
          },
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

  async recordStaffLoginFailure({ id, lockedUntil = null }) {
    return db().staffCredential.update({
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

  async recordStaffLoginSuccess({ id, ipAddress = null }) {
    return db().staffCredential.update({
      where: { id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
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
      await tx.refreshToken.update({
        where: { id: currentTokenId },
        data: { revokedAt: new Date() },
      });

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
      include: {
        venueRoles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    return flattenAuthContext(user);
  },
  };
};
