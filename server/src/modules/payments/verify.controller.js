import logger from '../../utils/logger.js';
import { ApiResponse } from '../../utils/api-response.js';
import { NotFoundError, asyncHandler } from '../../utils/api-error.js';

/**
 * Payment Verification Controller — PhonePe "Verify Payment Response" step.
 *
 * GET /api/v1/payments/verify?orderId=<merchantOrderId>
 *
 * JSON endpoint backing the frontend `/booking/redirect` page (the target of
 * PhonePe's `merchantUrls.redirectUrl`). PhonePe shares no transaction status
 * client-side, so the landing page calls this endpoint server-side to fetch
 * the authoritative state via the gateway Order Status API and process
 * terminal states idempotently — the same pipeline the webhook (the S2S
 * callback, PhonePe's primary confirmation) uses.
 *
 * Resolves the payment from the database first (404 for unknown orders — no
 * provider call is spent on garbage input). If the provider is unreachable the
 * endpoint still returns the booking reference with `state: "UNKNOWN"` so the
 * customer lands on the unified booking page, which polls until the webhook
 * or the missing-webhook recovery job resolves the order.
 *
 * Public: the gateway redirect carries no auth context, and the response
 * reveals nothing beyond booking_id and coarse statuses. The booking detail
 * page itself enforces session + ownership.
 *
 * @see docs/integrations/02-PAYMENT-INTEGRATION.md §3.3, §6
 */
export const createVerifyController = ({ bookingsService, paymentProvider } = {}) => {
  const handleVerify = asyncHandler(async (req, res) => {
    const { orderId } = req.validated.query;

    const knownBookingId = await bookingsService.getBookingIdByOrderId(orderId);
    if (!knownBookingId) {
      throw new NotFoundError('Payment not found');
    }

    logger.info('[Payment Verify] Verifying order', {
      operation: 'payments:verify',
      merchantOrderId: orderId,
    });

    try {
      const state = await paymentProvider.getPaymentStatus({
        payment: { merchantOrderId: orderId },
      });

      logger.info('[Payment Verify] Order status retrieved', {
        operation: 'payments:verify:status',
        merchantOrderId: orderId,
        state,
      });

      if (state === 'COMPLETED' || state === 'FAILED') {
        const result = await bookingsService.handleProviderPaymentEvent({
          merchantOrderId: orderId,
          state,
          payload: {
            provider: paymentProvider.name || 'phonepe',
            state,
            source: 'verify',
          },
        });
        return res.json(ApiResponse.success({
          merchant_order_id: orderId,
          booking_id: result.booking_id,
          booking_status: result.booking_status,
          payment_status: result.payment_status,
          state,
        }));
      }

      // PENDING / CREATED — nothing to process; the unified page polls.
      return res.json(ApiResponse.success({
        merchant_order_id: orderId,
        booking_id: knownBookingId,
        state,
      }));
    } catch (error) {
      logger.error('[Payment Verify] Verification failed — returning database truth', {
        operation: 'payments:verify:error',
        merchantOrderId: orderId,
        error,
      });
      // The webhook remains the primary confirmation mechanism; landing the
      // customer on the unified booking page beats a dead-end error screen.
      return res.json(ApiResponse.success({
        merchant_order_id: orderId,
        booking_id: knownBookingId,
        state: 'UNKNOWN',
      }));
    }
  });

  return { handleVerify };
};
