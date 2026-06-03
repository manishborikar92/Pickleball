import { Prisma } from '@prisma/client';
import { getPrisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../utils/api-error.js';
import { DEFAULT_CUSTOMER_PERMISSIONS } from '../../shared/auth-constants.js';
import { includeUserAuthContext } from '../../shared/auth-includes.js';

const serializeAuthProfile = (user) => {
  const roles = user.venueRoles?.map((assignment) => ({
    venue_id: assignment.venueId,
    venue_name: assignment.venue?.name,
    role: assignment.role.name,
  })) || [];

  const permissions = user.venueRoles?.flatMap((assignment) => (
    assignment.role.permissions.map((rolePermission) => rolePermission.permission.key)
  )) || [];

  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    onboarding_complete: Boolean(user.onboardingCompletedAt),
    roles,
    permissions: [...new Set(permissions.length > 0 ? permissions : DEFAULT_CUSTOMER_PERMISSIONS)],
  };
};

export const createUsersRepository = ({ prisma } = {}) => {
  const db = () => prisma || getPrisma();

  return {
    async getCurrentUser(userId) {
      const user = await db().user.findUnique({
        where: { id: userId },
        include: includeUserAuthContext,
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      return serializeAuthProfile(user);
    },

    async completeOnboarding({ userId, name }) {
      try {
        return await db().$transaction(async (tx) => {
          const existing = await tx.user.findUnique({ where: { id: userId } });
          if (!existing) {
            throw new NotFoundError('User not found');
          }

          const user = await tx.user.update({
            where: { id: userId },
            data: {
              name,
              onboardingCompletedAt: existing.onboardingCompletedAt || new Date(),
            },
            include: includeUserAuthContext,
          });

          return serializeAuthProfile(user);
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new NotFoundError('User not found');
        }
        throw error;
      }
    },
  };
};
