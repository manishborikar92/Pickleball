import logger from '../../utils/logger.js';

/**
 * PhonePe Redirect Controller.
 *
 * Handles the browser redirect from PhonePe after payment.
 * Verifies payment status with the provider, processes the result
 * idempotently via bookingsService, and redirects to the appropriate
 * frontend page.
 *
 * GET /api/v1/payments/redirect?orderId=<merchantOrderId>
 *
 * @see docs/integrations/02-PAYMENT-INTEGRATION.md §6
 */
export const createRedirectController = ({ bookingsService, paymentProvider, config } = {}) => {
  const frontendBaseUrl = config?.frontendBaseUrl || 'http://localhost:3000';

  const handleRedirect = async (req, res) => {
    const { orderId } = req.query;

    if (!orderId) {
      logger.warn('[PhonePe Redirect] Missing orderId query parameter');
      return res.redirect(`${frontendBaseUrl}/booking/failed?error=missing_order_id`);
    }

    logger.info('[PhonePe Redirect] Processing redirect', {
      operation: 'phonepe:redirect',
      merchantOrderId: orderId,
    });

    try {
      // Verify status with PhonePe Order Status API.
      const state = await paymentProvider.getPaymentStatus({
        payment: { merchantOrderId: orderId },
      });

      logger.info('[PhonePe Redirect] Order status retrieved', {
        operation: 'phonepe:redirect:status',
        merchantOrderId: orderId,
        state,
      });

      if (state === 'COMPLETED') {
        // Process completion (idempotent — may already be processed by webhook).
        await bookingsService.handleProviderPaymentEvent({
          merchantOrderId: orderId,
          state: 'COMPLETED',
          payload: {
            provider: 'phonepe',
            state: 'COMPLETED',
            source: 'redirect',
          },
        });
        return res.redirect(`${frontendBaseUrl}/booking/confirmed?orderId=${orderId}`);
      }

      if (state === 'FAILED') {
        await bookingsService.handleProviderPaymentEvent({
          merchantOrderId: orderId,
          state: 'FAILED',
          payload: {
            provider: 'phonepe',
            state: 'FAILED',
            source: 'redirect',
          },
        });
        return res.redirect(`${frontendBaseUrl}/booking/failed?orderId=${orderId}`);
      }

      // PENDING, CREATED, or any other state — show pending page.
      return res.redirect(`${frontendBaseUrl}/booking/pending?orderId=${orderId}`);
    } catch (error) {
      logger.error('[PhonePe Redirect] Error processing redirect', {
        operation: 'phonepe:redirect:error',
        merchantOrderId: orderId,
        error,
      });

      // Redirect to pending page on error — webhook will eventually process.
      return res.redirect(`${frontendBaseUrl}/booking/pending?orderId=${orderId}`);
    }
  };

  return { handleRedirect };
};
