import {
  NotFoundError,
  ConfigurationError,
  MissingVenueContextError,
  PermissionDeniedError,
} from '../../utils/api-error.js';
import { Permissions } from '../../shared/auth-constants.js';

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
  authorizationService,
} = {}) => {
  if (!repository) throw new ConfigurationError('repository is required');
  if (!bookingsService) throw new ConfigurationError('bookingsService is required');

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

    async refundPayment({ paymentId, amount, userId }) {
      if (!reconciliationService) {
        throw new ConfigurationError('reconciliationService is required for refunds');
      }

      const payment = await repository.getPayment(paymentId);
      if (!payment) {
        throw new NotFoundError('Payment not found');
      }

      const venueId = payment.booking?.venueId;
      if (!venueId) {
        throw new MissingVenueContextError('Venue association not found for payment');
      }

      if (!authorizationService) {
        throw new ConfigurationError('authorizationService is required for authorizing refunds');
      }

      const hasPerm = await authorizationService.hasPermission({
        userId,
        venueId,
        permission: Permissions.ISSUE_CREDITS,
      });

      if (!hasPerm) {
        throw new PermissionDeniedError('Missing required permissions');
      }

      return reconciliationService.initiateRefund({ paymentId, amount });
    },

    async retryRefund({ paymentId, userId }) {
      if (!reconciliationService) {
        throw new ConfigurationError('reconciliationService is required for retries');
      }

      const payment = await repository.getPayment(paymentId);
      if (!payment) {
        throw new NotFoundError('Payment not found');
      }

      const venueId = payment.booking?.venueId;
      if (!venueId) {
        throw new MissingVenueContextError('Venue association not found for payment');
      }

      if (!authorizationService) {
        throw new ConfigurationError('authorizationService is required for authorizing refunds');
      }

      const hasPerm = await authorizationService.hasPermission({
        userId,
        venueId,
        permission: Permissions.ISSUE_CREDITS,
      });

      if (!hasPerm) {
        throw new PermissionDeniedError('Missing required permissions');
      }

      return reconciliationService.retryRefund({ paymentId });
    },
  };
};
