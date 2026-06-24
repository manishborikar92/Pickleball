import crypto from 'node:crypto';

import logger from '../../utils/logger.js';

/**
 * PhonePe Webhook Controller.
 *
 * Handles S2S callbacks from PhonePe for payment and refund events.
 * Verifies SHA256-based authentication, responds 200 immediately,
 * then processes the event asynchronously.
 *
 * @see docs/integrations/02-PAYMENT-INTEGRATION.md §7
 */
export const createWebhookController = ({ bookingsService, reconciliationService, config } = {}) => {
  const webhookUsername = config?.phonepe?.webhookUsername || '';
  const webhookPassword = config?.phonepe?.webhookPassword || '';

  /**
   * Verify SHA256(username:password) matches the Authorization header.
   * PhonePe sends: Authorization: SHA256(username + ":" + password)
   */
  const verifyWebhookAuth = (authHeader) => {
    if (!webhookUsername || !webhookPassword) {
      logger.warn('[PhonePe Webhook] Webhook credentials not configured — skipping auth verification');
      return false;
    }

    const expectedHash = crypto
      .createHash('sha256')
      .update(`${webhookUsername}:${webhookPassword}`)
      .digest('hex');

    return authHeader === expectedHash;
  };

  /**
   * POST /webhooks/phonepe
   *
   * Responds 200 immediately, then processes the event asynchronously.
   * PhonePe retries on delayed or non-200 responses.
   */
  const handleWebhook = async (req, res) => {
    const authHeader = req.headers['authorization'] || '';

    if (!verifyWebhookAuth(authHeader)) {
      logger.warn('[PhonePe Webhook] Auth verification failed', {
        operation: 'phonepe:webhook:authFailed',
      });
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Respond 200 immediately — PhonePe expects fast acknowledgment.
    res.status(200).json({ success: true });

    // Process asynchronously after response is sent.
    const payload = req.body;
    const eventType = payload?.type;
    const merchantOrderId = payload?.payload?.merchantOrderId;
    const state = payload?.payload?.state;

    logger.info('[PhonePe Webhook] Event received', {
      operation: 'phonepe:webhook:received',
      eventType,
      merchantOrderId,
      state,
    });

    try {
      if (eventType === 'checkout.order.completed' || (eventType === 'checkout.order.status' && state === 'COMPLETED')) {
        await bookingsService.handleProviderPaymentEvent({
          merchantOrderId,
          state: 'COMPLETED',
          payload: {
            provider: 'phonepe',
            state: 'COMPLETED',
            ...payload?.payload,
            rawWebhookPayload: payload,
          },
        });
        logger.info('[PhonePe Webhook] Payment completion processed', {
          operation: 'phonepe:webhook:completed',
          merchantOrderId,
        });
      } else if (eventType === 'checkout.order.failed' || (eventType === 'checkout.order.status' && state === 'FAILED')) {
        await bookingsService.handleProviderPaymentEvent({
          merchantOrderId,
          state: 'FAILED',
          payload: {
            provider: 'phonepe',
            state: 'FAILED',
            ...payload?.payload,
            rawWebhookPayload: payload,
          },
        });
        logger.info('[PhonePe Webhook] Payment failure processed', {
          operation: 'phonepe:webhook:failed',
          merchantOrderId,
        });
      } else if (eventType === 'pg.refund.completed') {
        const merchantRefundId = payload?.payload?.merchantRefundId;
        if (reconciliationService && merchantRefundId) {
          await reconciliationService.completeRefund({ merchantRefundId });
          logger.info('[PhonePe Webhook] Refund completion processed', {
            operation: 'phonepe:webhook:refundCompleted',
            merchantRefundId,
          });
        }
      } else if (eventType === 'pg.refund.failed') {
        const merchantRefundId = payload?.payload?.merchantRefundId;
        if (reconciliationService && merchantRefundId) {
          await reconciliationService.failRefund({ merchantRefundId });
          logger.info('[PhonePe Webhook] Refund failure processed', {
            operation: 'phonepe:webhook:refundFailed',
            merchantRefundId,
          });
        }
      } else {
        logger.info('[PhonePe Webhook] Unhandled event type', {
          operation: 'phonepe:webhook:unhandled',
          eventType,
          state,
        });
      }
    } catch (error) {
      // Errors after 200 must be logged but never surfaced to PhonePe.
      logger.error('[PhonePe Webhook] Processing error (post-200)', {
        operation: 'phonepe:webhook:error',
        eventType,
        merchantOrderId,
        error,
      });
    }
  };

  return { handleWebhook };
};
