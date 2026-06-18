import { NotFoundError } from '../../utils/api-error.js';

const serializePaymentStatus = (payment) => ({
  merchant_order_id: payment.merchantOrderId,
  booking_id: payment.booking.id,
  booking_status: payment.booking.status,
  payment_status: payment.status,
});

export const createPaymentsService = ({
  repository,
  bookingsService,
  reconciliationService,
} = {}) => {
  if (!repository) throw new Error('repository is required');
  if (!bookingsService) throw new Error('bookingsService is required');

  return {
    async getPaymentStatus({ userId, merchantOrderId }) {
      const payment = await repository.getPaymentForUser({
        userId,
        merchantOrderId,
      });

      if (!payment) {
        throw new NotFoundError('Payment not found');
      }

      return serializePaymentStatus(payment);
    },

    async completeSandboxPayment({ merchantOrderId, requestContext = {} }) {
      return bookingsService.handleProviderPaymentEvent({
        merchantOrderId,
        state: 'COMPLETED',
        payload: {
          provider: 'sandbox',
          state: 'COMPLETED',
        },
        requestContext,
      });
    },

    async failSandboxPayment({ merchantOrderId, requestContext = {} }) {
      return bookingsService.handleProviderPaymentEvent({
        merchantOrderId,
        state: 'FAILED',
        payload: {
          provider: 'sandbox',
          state: 'FAILED',
        },
        requestContext,
      });
    },

    async refundPayment({ paymentId, amount }) {
      if (!reconciliationService) {
        throw new Error('reconciliationService is required for refunds');
      }
      return reconciliationService.initiateRefund({ paymentId, amount });
    },

    async retryRefund({ paymentId }) {
      if (!reconciliationService) {
        throw new Error('reconciliationService is required for retries');
      }
      return reconciliationService.retryRefund({ paymentId });
    },
  };
};
