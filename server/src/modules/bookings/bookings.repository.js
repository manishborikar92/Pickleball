import { Prisma } from '@prisma/client';

import { getPrisma } from '../../lib/prisma.js';
import { ConflictError, NotFoundError } from '../../utils/api-error.js';
import { formatTime, minutesToTimeDate, timeToMinutes } from './booking-time.js';

const activeSlotStatuses = ['pending_payment', 'confirmed', 'walk_in', 'admin_block'];

const toMoney = (value) => Number(value || 0);

const slotTimeDates = (slotStartTimes) => slotStartTimes.map((time) => (
  time instanceof Date ? time : minutesToTimeDate(timeToMinutes(time))
));

const bookingIncludeForPayment = {
  user: {
    select: {
      id: true,
      walletCredits: true,
    },
  },
  payments: {
    orderBy: { createdAt: 'desc' },
  },
};

export const createBookingsRepository = ({ prisma } = {}) => {
  const db = () => prisma || getPrisma();

  const expirePendingHolds = async (tx, now) => {
    await tx.booking.updateMany({
      where: {
        status: 'pending_payment',
        expiresAt: { lte: now },
      },
      data: {
        status: 'expired',
      },
    });

    await tx.bookingSlot.updateMany({
      where: {
        status: 'pending_payment',
        booking: {
          status: 'expired',
        },
      },
      data: {
        status: 'expired',
      },
    });
  };

  return {
    async getHoldContext({ venueId, couponCode }) {
      const now = new Date();
      const [venue, courts, pricingRules, coupon] = await Promise.all([
        db().venue.findFirst({
          where: {
            id: venueId,
            deletedAt: null,
            isActive: true,
          },
        }),
        db().court.findMany({
          where: {
            venueId,
            deletedAt: null,
          },
          include: {
            basePrice: true,
          },
          orderBy: { displayOrder: 'asc' },
        }),
        db().pricingRule.findMany({
          where: {
            venueId,
            isActive: true,
          },
          orderBy: [
            { priority: 'asc' },
            { createdAt: 'asc' },
          ],
        }),
        couponCode ? db().coupon.findFirst({
          where: {
            code: couponCode,
            isActive: true,
            deletedAt: null,
            OR: [
              { venueId },
              { venueId: null },
            ],
            AND: [
              {
                OR: [
                  { validFrom: null },
                  { validFrom: { lte: now } },
                ],
              },
              {
                OR: [
                  { validUntil: null },
                  { validUntil: { gte: now } },
                ],
              },
            ],
          },
        }) : null,
      ]);

      if (!venue) {
        throw new NotFoundError('Venue not found');
      }

      return {
        venue,
        courts,
        pricingRules,
        coupon,
      };
    },

    async countActivePendingHolds({ userId, now }) {
      return db().booking.count({
        where: {
          userId,
          status: 'pending_payment',
          expiresAt: { gt: now },
        },
      });
    },

    async createHold({ booking, slotUnits, now = new Date() }) {
      return db().$transaction(async (tx) => {
        await expirePendingHolds(tx, now);

        const created = await tx.booking.create({
          data: booking,
        });

        await tx.bookingSlot.createMany({
          data: slotUnits.map((unit) => ({
            ...unit,
            bookingId: created.id,
          })),
        });

        return tx.booking.findUnique({
          where: { id: created.id },
          include: {
            slots: true,
          },
        });
      });
    },

    async findUnavailableUnits({ courtIds, slotDate, slotStartTimes, now }) {
      const rows = await db().bookingSlot.findMany({
        where: {
          courtId: { in: courtIds },
          slotDate: new Date(`${slotDate}T00:00:00.000Z`),
          slotStartTime: { in: slotTimeDates(slotStartTimes) },
          status: { in: activeSlotStatuses },
        },
        include: {
          court: { select: { id: true, name: true } },
          booking: { select: { expiresAt: true, status: true } },
        },
      });

      return rows
        .filter((row) => row.status !== 'pending_payment' || !row.booking?.expiresAt || row.booking.expiresAt > now)
        .map((row) => ({
          court_id: row.courtId,
          court_name: row.court?.name,
          slot_start_time: formatTime(row.slotStartTime),
        }));
    },

    async acceptWaiver({ userId, bookingId, acceptedAt, ipAddress }) {
      try {
        return await db().booking.update({
          where: {
            id: bookingId,
            userId,
          },
          data: {
            waiverAccepted: true,
            waiverAcceptedAt: acceptedAt,
            waiverIpAddress: ipAddress,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new NotFoundError('Booking not found');
        }
        throw error;
      }
    },

    async getBookingForPayment({ bookingId, userId }) {
      return db().booking.findFirst({
        where: {
          id: bookingId,
          userId,
        },
        include: bookingIncludeForPayment,
      });
    },

    async findReusableInitiatedPayment({ bookingId }) {
      return db().payment.findFirst({
        where: {
          bookingId,
          status: 'initiated',
        },
        orderBy: { createdAt: 'desc' },
      });
    },

    async confirmWalletOnlyPayment({ bookingId, userId, creditsApplied, now }) {
      return db().$transaction(async (tx) => {
        const booking = await tx.booking.findFirst({
          where: {
            id: bookingId,
            userId,
          },
        });

        if (!booking) throw new NotFoundError('Booking not found');
        if (booking.status === 'confirmed') {
          const payment = await tx.payment.findFirst({ where: { bookingId, gateway: 'wallet' } });
          return { booking, payment };
        }
        if (booking.status !== 'pending_payment') {
          throw new ConflictError('Booking is not payable', { code: 'INVALID_BOOKING_STATE' });
        }

        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { walletCredits: true },
        });
        const currentBalance = toMoney(user?.walletCredits);

        if (currentBalance < creditsApplied) {
          throw new ConflictError('Insufficient wallet balance', { code: 'INSUFFICIENT_WALLET_BALANCE' });
        }

        const balanceAfter = currentBalance - creditsApplied;
        if (creditsApplied > 0) {
          await tx.user.update({
            where: { id: userId },
            data: { walletCredits: { decrement: creditsApplied } },
          });
          await tx.walletTransaction.create({
            data: {
              userId,
              bookingId,
              type: 'credit_redeemed',
              amount: creditsApplied,
              balanceAfter,
              reason: 'Booking payment',
            },
          });
        }

        const payment = await tx.payment.create({
          data: {
            bookingId,
            gateway: 'wallet',
            amount: 0,
            currency: 'INR',
            status: 'success',
            idempotencyKey: `wallet:${bookingId}`,
            webhookReceivedAt: now,
          },
        });

        const confirmed = await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: 'confirmed',
            creditsApplied,
          },
        });

        await tx.bookingSlot.updateMany({
          where: { bookingId },
          data: { status: 'confirmed' },
        });

        return { booking: confirmed, payment };
      });
    },

    async initiateProviderPayment({ bookingId, userId, providerOrder, creditsApplied, providerAmount, now }) {
      return db().$transaction(async (tx) => {
        const booking = await tx.booking.findFirst({
          where: {
            id: bookingId,
            userId,
          },
          include: { user: true },
        });
        if (!booking) throw new NotFoundError('Booking not found');
        if (booking.status !== 'pending_payment') {
          throw new ConflictError('Booking is not payable', { code: 'INVALID_BOOKING_STATE' });
        }

        const currentBalance = toMoney(booking.user.walletCredits);
        if (creditsApplied > currentBalance) {
          throw new ConflictError('Insufficient wallet balance', { code: 'INSUFFICIENT_WALLET_BALANCE' });
        }

        if (creditsApplied > 0) {
          const balanceAfter = currentBalance - creditsApplied;
          await tx.user.update({
            where: { id: userId },
            data: { walletCredits: { decrement: creditsApplied } },
          });
          await tx.walletTransaction.create({
            data: {
              userId,
              bookingId,
              type: 'credit_redeemed',
              amount: creditsApplied,
              balanceAfter,
              reason: 'Booking payment reservation',
            },
          });
        }

        const payment = await tx.payment.create({
          data: {
            bookingId,
            gateway: providerOrder.gateway,
            merchantOrderId: providerOrder.merchant_order_id,
            gatewayOrderId: providerOrder.gateway_order_id || null,
            amount: providerAmount,
            currency: providerOrder.currency || 'INR',
            status: 'initiated',
            idempotencyKey: providerOrder.idempotency_key || `${providerOrder.gateway}:${bookingId}:${providerOrder.merchant_order_id}`,
            rawWebhookPayload: {
              redirect_url: providerOrder.redirect_url,
              created_at: now.toISOString(),
            },
          },
        });

        const updatedBooking = await tx.booking.update({
          where: { id: bookingId },
          data: { creditsApplied },
        });

        return { booking: updatedBooking, payment };
      });
    },

    async getPaymentWithBooking({ merchantOrderId }) {
      return db().payment.findUnique({
        where: { merchantOrderId },
        include: {
          booking: {
            include: {
              user: {
                select: {
                  id: true,
                  walletCredits: true,
                },
              },
            },
          },
        },
      });
    },

    async confirmProviderPayment({ paymentId, bookingId, payload, now }) {
      return db().$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({ where: { id: bookingId } });
        const payment = await tx.payment.findUnique({ where: { id: paymentId } });

        if (!booking || !payment) throw new NotFoundError('Payment not found');
        if (booking.status === 'confirmed' && payment.status === 'success') {
          return { booking, payment };
        }

        const updatedPayment = await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: 'success',
            webhookReceivedAt: now,
            rawWebhookPayload: payload,
          },
        });

        const updatedBooking = await tx.booking.update({
          where: { id: bookingId },
          data: { status: 'confirmed' },
        });

        await tx.bookingSlot.updateMany({
          where: { bookingId },
          data: { status: 'confirmed' },
        });

        return { booking: updatedBooking, payment: updatedPayment };
      });
    },

    async failProviderPayment({ paymentId, bookingId, rollbackCredits, payload, now }) {
      return db().$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { user: true },
        });
        const payment = await tx.payment.findUnique({ where: { id: paymentId } });

        if (!booking || !payment) throw new NotFoundError('Payment not found');
        if (payment.status === 'failed') {
          return { booking, payment };
        }

        if (rollbackCredits && toMoney(booking.creditsApplied) > 0) {
          const amount = toMoney(booking.creditsApplied);
          const balanceAfter = toMoney(booking.user.walletCredits) + amount;
          await tx.user.update({
            where: { id: booking.userId },
            data: { walletCredits: { increment: amount } },
          });
          await tx.walletTransaction.create({
            data: {
              userId: booking.userId,
              bookingId,
              type: 'credit_issued',
              amount,
              balanceAfter,
              reason: 'Booking payment failed',
            },
          });
        }

        const updatedPayment = await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: 'failed',
            webhookReceivedAt: now,
            rawWebhookPayload: payload,
          },
        });

        const updatedBooking = await tx.booking.update({
          where: { id: bookingId },
          data: { creditsApplied: 0 },
        });

        return { booking: updatedBooking, payment: updatedPayment };
      });
    },

    async expirePendingHolds({ now, limit = 100 }) {
      return db().$transaction(async (tx) => {
        const candidates = await tx.booking.findMany({
          where: {
            status: 'pending_payment',
            expiresAt: { lte: now },
          },
          orderBy: { expiresAt: 'asc' },
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                walletCredits: true,
              },
            },
          },
        });

        let expiredCount = 0;
        let walletCreditsRolledBack = 0;

        for (const booking of candidates) {
          const update = await tx.booking.updateMany({
            where: {
              id: booking.id,
              status: 'pending_payment',
              expiresAt: { lte: now },
            },
            data: {
              status: 'expired',
              creditsApplied: 0,
            },
          });

          if (update.count !== 1) {
            continue;
          }

          expiredCount += 1;

          await tx.bookingSlot.updateMany({
            where: {
              bookingId: booking.id,
              status: 'pending_payment',
            },
            data: { status: 'expired' },
          });

          await tx.payment.updateMany({
            where: {
              bookingId: booking.id,
              status: 'initiated',
            },
            data: {
              status: 'failed',
              webhookReceivedAt: now,
            },
          });

          const creditsApplied = toMoney(booking.creditsApplied);
          if (creditsApplied > 0) {
            const updatedUser = await tx.user.update({
              where: { id: booking.userId },
              data: { walletCredits: { increment: creditsApplied } },
              select: { walletCredits: true },
            });

            await tx.walletTransaction.create({
              data: {
                userId: booking.userId,
                bookingId: booking.id,
                type: 'credit_issued',
                amount: creditsApplied,
                balanceAfter: updatedUser.walletCredits,
                reason: 'Booking hold expired',
              },
            });

            walletCreditsRolledBack += creditsApplied;
          }
        }

        return {
          expired_count: expiredCount,
          wallet_credits_rolled_back: walletCreditsRolledBack,
        };
      });
    },

    async expireBooking({ bookingId, now }) {
      return db().$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: {
            user: {
              select: {
                id: true,
                walletCredits: true,
              },
            },
          },
        });

        if (!booking || booking.status !== 'pending_payment') {
          return null;
        }

        const update = await tx.booking.updateMany({
          where: {
            id: bookingId,
            status: 'pending_payment',
          },
          data: {
            status: 'expired',
            creditsApplied: 0,
          },
        });

        if (update.count !== 1) {
          return null;
        }

        await tx.bookingSlot.updateMany({
          where: {
            bookingId,
            status: 'pending_payment',
          },
          data: { status: 'expired' },
        });

        await tx.payment.updateMany({
          where: {
            bookingId,
            status: 'initiated',
          },
          data: {
            status: 'failed',
            webhookReceivedAt: now,
          },
        });

        const creditsApplied = toMoney(booking.creditsApplied);
        if (creditsApplied > 0) {
          const updatedUser = await tx.user.update({
            where: { id: booking.userId },
            data: { walletCredits: { increment: creditsApplied } },
            select: { walletCredits: true },
          });

          await tx.walletTransaction.create({
            data: {
              userId: booking.userId,
              bookingId,
              type: 'credit_issued',
              amount: creditsApplied,
              balanceAfter: updatedUser.walletCredits,
              reason: 'Booking hold expired',
            },
          });
        }

        return tx.booking.findUnique({
          where: { id: bookingId },
          include: {
            slots: true,
            payments: true,
          },
        });
      });
    },

    async getBooking({ userId, bookingId }) {
      return db().booking.findFirst({
        where: {
          id: bookingId,
          userId,
        },
        include: {
          venue: { select: { id: true, name: true } },
          slots: {
            orderBy: [
              { slotStartTime: 'asc' },
              { courtId: 'asc' },
            ],
            include: {
              court: { select: { id: true, name: true } },
            },
          },
          payments: { orderBy: { createdAt: 'desc' } },
        },
      });
    },
  };
};
