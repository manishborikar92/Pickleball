import crypto from 'node:crypto';
import { ConflictError, NotFoundError, AppError } from '../../utils/api-error.js';

export const createReconciliationService = ({
  paymentsRepository,
  bookingsService,
  paymentProvider = null,
  clock = () => new Date(),
} = {}) => {
  if (!paymentsRepository) throw new Error('paymentsRepository is required');
  if (!bookingsService) throw new Error('bookingsService is required');

  return {
    async reconcileLatePayment({ paymentId, bookingId, amount }) {
      console.log(`[Reconciliation] Triggering auto-refund for late payment: ${paymentId}, booking: ${bookingId}`);

      // 1. Restore applied wallet credits back to user's wallet
      try {
        const creditRestore = await bookingsService.restoreWalletCredits({ bookingId });
        console.log(`[Reconciliation] Restored wallet credits: ${creditRestore.restoredAmount}`);
      } catch (err) {
        console.error(`[Reconciliation] Failed to restore wallet credits for booking ${bookingId}`, err);
      }

      // 2. Initiate auto-refund of the gateway transaction amount
      if (amount > 0) {
        try {
          await this.initiateRefund({ paymentId, amount });
          console.log(`[Reconciliation] Auto-refund initiated for payment ${paymentId}`);
        } catch (err) {
          console.error(`[Reconciliation] Auto-refund initiation failed for payment ${paymentId}`, err);
        }
      }
    },

    async initiateRefund({ paymentId, amount }) {
      const now = clock();
      const payment = await paymentsRepository.getPayment(paymentId);
      if (!payment) {
        throw new NotFoundError('Payment not found');
      }

      // Domain Invariant: Refunds may only originate from success (or retry of refund_failed)
      if (payment.status !== 'success' && payment.status !== 'refund_failed') {
        throw new ConflictError(`Refund cannot originate from payment status: ${payment.status}`, { code: 'INVALID_PAYMENT_STATE' });
      }

      if (!paymentProvider) {
        throw new AppError('Payment provider not configured for refunds', 503, { code: 'PAYMENT_PROVIDER_UNAVAILABLE' });
      }

      const merchantRefundId = `REFUND-${crypto.randomUUID()}`;

      // Update status to refund_pending
      await paymentsRepository.updatePaymentRefundInitiated({
        paymentId,
        merchantRefundId,
        amount,
        now,
      });

      try {
        const response = await paymentProvider.refundPayment({
          merchantRefundId,
          amount,
        });

        if (response && response.status === 'SUCCESS') {
          // Automatic refund completion (Mock Sandbox behavior)
          await this.completeRefund({ merchantRefundId });
          return { status: 'refunded', merchantRefundId };
        } else {
          await this.failRefund({ merchantRefundId });
          return { status: 'refund_failed', merchantRefundId };
        }
      } catch (error) {
        console.error(`[Reconciliation] Refund API call failed for payment ${paymentId}`, error);
        await this.failRefund({ merchantRefundId });
        return { status: 'refund_failed', merchantRefundId };
      }
    },

    async completeRefund({ merchantRefundId }) {
      const payment = await paymentsRepository.getPaymentByRefundId(merchantRefundId);
      if (!payment) {
        throw new NotFoundError('Payment not found for refund ID');
      }

      if (payment.status !== 'refund_pending') {
        return payment; // Idempotent no-op
      }

      return paymentsRepository.updatePaymentRefundSuccess({
        paymentId: payment.id,
        completedAt: clock(),
      });
    },

    async failRefund({ merchantRefundId }) {
      const payment = await paymentsRepository.getPaymentByRefundId(merchantRefundId);
      if (!payment) {
        throw new NotFoundError('Payment not found for refund ID');
      }

      if (payment.status !== 'refund_pending') {
        return payment; // Idempotent no-op
      }

      return paymentsRepository.updatePaymentRefundFailed({
        paymentId: payment.id,
      });
    },

    async retryRefund({ paymentId }) {
      const payment = await paymentsRepository.getPayment(paymentId);
      if (!payment) {
        throw new NotFoundError('Payment not found');
      }

      if (payment.status !== 'refund_failed') {
        throw new ConflictError(`Cannot retry refund in status: ${payment.status}`, { code: 'INVALID_PAYMENT_STATE' });
      }

      const refundAmount = Number(payment.refundAmount || payment.amount);
      return this.initiateRefund({ paymentId, amount: refundAmount });
    },
  };
};
