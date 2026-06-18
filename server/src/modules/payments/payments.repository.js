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
  };
};
