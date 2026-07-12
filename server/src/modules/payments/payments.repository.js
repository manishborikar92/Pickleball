import { getPrisma } from '../../lib/prisma.js';

export const createPaymentsRepository = ({ prisma } = {}) => {
  const db = () => prisma || getPrisma();

  return {
    async getPaymentForUser({ userId, merchantOrderId }) {
      return db().payment.findFirst({
        where: {
          merchantOrderId,
          booking: { userId },
        },
        include: {
          booking: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });
    },

    async getPayment(paymentId) {
      return db().payment.findUnique({
        where: { id: paymentId },
        include: {
          booking: true,
        },
      });
    },

    async getPaymentByRefundId(merchantRefundId) {
      return db().payment.findUnique({
        where: { merchantRefundId },
        include: {
          booking: true,
        },
      });
    },

    async updatePaymentRefundInitiated({ paymentId, merchantRefundId, amount, now }) {
      return db().payment.update({
        where: { id: paymentId },
        data: {
          status: 'refund_pending',
          merchantRefundId,
          refundAmount: amount,
          refundInitiatedAt: now,
        },
      });
    },

    async updatePaymentRefundSuccess({ paymentId, completedAt }) {
      return db().payment.update({
        where: { id: paymentId },
        data: {
          status: 'refunded',
          refundCompletedAt: completedAt,
        },
      });
    },

    async updatePaymentRefundFailed({ paymentId }) {
      return db().payment.update({
        where: { id: paymentId },
        data: {
          status: 'refund_failed',
        },
      });
    },

    async findStalePayments({ cutoff, limit = 50 }) {
      return db().payment.findMany({
        where: {
          status: 'initiated',
          createdAt: { lt: cutoff },
        },
        include: {
          booking: {
            select: {
              id: true,
              status: true,
              userId: true,
            },
          },
        },
        take: limit,
      });
    },
  };
};
