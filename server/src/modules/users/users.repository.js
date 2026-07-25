import { Prisma } from '@prisma/client';
import { getPrisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../utils/api-error.js';
import { DEFAULT_CUSTOMER_PERMISSIONS } from '../../shared/auth-constants.js';
import { includeUserAuthContext } from '../../shared/auth-includes.js';
import { formatTime, toDateOnly } from '../bookings/booking-time.js';

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

const money = (value) => Number(value || 0);

const serializeBookingSummary = (booking) => {
  const courtNames = [...new Set((booking.slots || []).map((s) => s.court?.name).filter(Boolean))].sort();

  return {
    id: booking.id,
    court_names: courtNames,
    venue: booking.venue ? {
      id: booking.venue.id,
      name: booking.venue.name,
      slug: booking.venue.slug,
    } : null,
    slot_date: toDateOnly(booking.slotDate),
    slot_start_time: formatTime(booking.sessionStartTime),
    slot_end_time: formatTime(booking.sessionEndTime),
    status: booking.status,
    total_amount: money(booking.totalAmount),
    has_review: Boolean(booking.review),
  };
};

const serializeWalletTransaction = (transaction) => ({
  id: transaction.id,
  type: transaction.type,
  amount: money(transaction.amount),
  balance_after: money(transaction.balanceAfter),
  reason: transaction.reason,
  created_at: transaction.createdAt.toISOString(),
});

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

    async getMyBookings({ userId, status, page = 1, limit = 20 }) {
      const where = {
        userId,
        ...(status ? { status } : {}),
      };
      const skip = (page - 1) * limit;

      // These independent read queries deliberately avoid an interactive
      // transaction: Prisma's PostgreSQL adapter executes relational includes
      // internally, and wrapping them in one shared client causes pg's
      // concurrent-query deprecation warning. The previous transaction used
      // PostgreSQL's default READ COMMITTED isolation, so it did not provide a
      // shared pagination snapshot in the first place.
      const rows = await db().booking.findMany({
        where,
        orderBy: [
          { slotDate: 'desc' },
          { sessionStartTime: 'desc' },
        ],
        skip,
        take: limit,
        include: {
          venue: {
            select: { id: true, name: true, slug: true },
          },
          slots: {
            orderBy: [
              { slotDate: 'asc' },
              { slotStartTime: 'asc' },
            ],
            include: {
              court: {
                select: { id: true, name: true },
              },
            },
          },
          review: {
            select: { id: true },
          },
        },
      });
      const total = await db().booking.count({ where });

      return {
        data: rows.map(serializeBookingSummary),
        pagination: { page, limit, total },
      };
    },

    async getMyWallet({ userId }) {
      const user = await db().user.findUnique({
        where: { id: userId },
        select: {
          walletCredits: true,
          walletTransactions: {
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      return {
        balance: money(user.walletCredits),
        transactions: user.walletTransactions.map(serializeWalletTransaction),
      };
    },
  };
};
