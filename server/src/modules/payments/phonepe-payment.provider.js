import crypto from 'node:crypto';

import { AppError } from '../../utils/api-error.js';
import logger from '../../utils/logger.js';
import { assertPaymentProvider } from './payment-provider.js';
import { createPhonePeAuth } from './phonepe-auth.js';

/**
 * PhonePe Payment Provider — PG v2 Standard Checkout.
 *
 * Implements the 3-method payment provider interface using raw fetch.
 * All PhonePe API calls include timeout, retry on 5xx, 401 token refresh,
 * correlation IDs, and structured logging.
 *
 * @see docs/integrations/02-PAYMENT-INTEGRATION.md
 */

const PG_BASE_URLS = {
  SANDBOX: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
  PRODUCTION: 'https://api.phonepe.com/apis/pg',
};

const API_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1_000;

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * Builds a per-attempt merchant order id: `PP-<booking prefix>-<entropy>`.
 *
 * PhonePe requires every merchantOrderId submitted to /checkout/v2/pay to be
 * globally unique — a retry after a FAILED/cancelled attempt must register a
 * NEW gateway order (docs §9.2), so each attempt carries fresh 64-bit
 * cryptographic entropy. The booking-derived prefix keeps ids
 * eyeball-traceable in dashboards; the authoritative linkage is the payments
 * ledger row plus metaInfo.udf1.
 * 34 chars — inside PhonePe's 35-char limit, alphanumeric + hyphen only.
 *
 * Concurrent double-initiation is arbitrated by the database, not this id:
 * the payments_one_initiated_payment_per_booking partial unique index rejects
 * the losing insert and the service returns the winning attempt instead.
 */
export const generateMerchantOrderId = (
  bookingId,
  random = () => crypto.randomBytes(8).toString('hex'),
) => `PP-${bookingId.replace(/-/g, '').slice(0, 14)}-${random()}`;

/**
 * Execute a fetch request with timeout, 5xx retry, and 401 token refresh.
 */
const phonePeFetch = async ({ url, method, headers, body, auth, correlationId, operation, retryCount = 0 }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const start = Date.now();

  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...headers,
        'X-Request-Id': correlationId,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const latencyMs = Date.now() - start;

    logger.info('[PhonePe API] Request completed', {
      correlationId,
      operation,
      method,
      url,
      httpStatus: response.status,
      latencyMs,
      retryCount,
    });

    // 401: Invalidate token cache and retry once with a fresh token.
    if (response.status === 401 && retryCount === 0) {
      logger.warn('[PhonePe API] 401 received, invalidating token and retrying', {
        correlationId,
        operation,
      });
      auth.invalidateToken();
      const freshToken = await auth.getAccessToken();
      return phonePeFetch({
        url,
        method,
        headers: { ...headers, Authorization: `O-Bearer ${freshToken}` },
        body,
        auth,
        correlationId,
        operation,
        retryCount: 1,
      });
    }

    // 5xx: Exponential backoff retry.
    if (response.status >= 500 && retryCount < MAX_RETRIES) {
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
      logger.warn('[PhonePe API] 5xx received, retrying with backoff', {
        correlationId,
        operation,
        httpStatus: response.status,
        retryCount: retryCount + 1,
        backoffMs: backoff,
      });
      await sleep(backoff);
      return phonePeFetch({
        url,
        method,
        headers,
        body,
        auth,
        correlationId,
        operation,
        retryCount: retryCount + 1,
      });
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new AppError(
        `PhonePe API error: ${operation} returned HTTP ${response.status}`,
        502,
        { code: 'PHONEPE_API_ERROR', httpStatus: response.status, errorBody, correlationId },
      );
    }

    return response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AppError(
        `PhonePe API timeout: ${operation} exceeded ${API_TIMEOUT_MS}ms`,
        504,
        { code: 'PHONEPE_API_TIMEOUT', operation, correlationId, latencyMs: Date.now() - start },
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const createPhonePePaymentProvider = ({
  clientId,
  clientSecret,
  clientVersion = 1,
  merchantId: _merchantId,
  env = 'SANDBOX',
  frontendBaseUrl = 'http://localhost:3000',
} = {}) => {
  const pgBaseUrl = PG_BASE_URLS[env] || PG_BASE_URLS.SANDBOX;

  const auth = createPhonePeAuth({
    clientId,
    clientSecret,
    clientVersion,
    env,
  });

  return assertPaymentProvider({
    name: 'phonepe',

    /**
     * Creates a PhonePe payment order via POST /checkout/v2/pay.
     *
     * @param {Object} params
     * @param {Object} params.booking - Booking record with id, userId, totalAmount, etc.
     * @param {number} params.amount  - Amount in rupees to charge via PhonePe.
     * @param {string} params.currency - Currency code (always 'INR').
     * @returns {Object} Provider order with redirect_url and merchant_order_id.
     */
    async createPaymentOrder({ booking, amount, currency = 'INR' }) {
      const correlationId = crypto.randomUUID();
      const merchantOrderId = generateMerchantOrderId(booking.id);
      const amountInPaisa = Math.round(amount * 100);

      const token = await auth.getAccessToken();

      const payload = {
        merchantOrderId,
        amount: amountInPaisa,
        expireAfter: 600,
        metaInfo: {
          udf1: booking.id,
          udf2: booking.userId,
        },
        paymentFlow: {
          type: 'PG_CHECKOUT',
          message: `Court booking — ${merchantOrderId}`,
          merchantUrls: {
            // The browser returns to the frontend domain — the /booking/redirect
            // page verifies server-side, keeping the backend origin out of the
            // customer's address bar (domain isolation).
            redirectUrl: `${frontendBaseUrl}/booking/redirect?orderId=${merchantOrderId}`,
          },
          paymentModeConfig: {
            enabledPaymentModes: [
              { type: 'UPI_INTENT' },
              { type: 'UPI_COLLECT' },
              { type: 'UPI_QR' },
            ],
          },
        },
      };

      logger.info('[PhonePe] Creating payment order', {
        correlationId,
        operation: 'phonepe:createOrder',
        merchantOrderId,
        amountInPaisa,
        bookingId: booking.id,
      });

      const data = await phonePeFetch({
        url: `${pgBaseUrl}/checkout/v2/pay`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `O-Bearer ${token}`,
        },
        body: payload,
        auth,
        correlationId,
        operation: 'phonepe:createOrder',
      });

      return {
        provider: 'phonepe',
        gateway: 'phonepe',
        merchant_order_id: merchantOrderId,
        gateway_order_id: data.orderId || null,
        redirect_url: data.redirectUrl,
        amount,
        currency,
        idempotency_key: `phonepe:${merchantOrderId}`,
      };
    },

    /**
     * Checks the current status of a PhonePe order.
     *
     * @param {Object} params
     * @param {Object} params.payment - Payment record with merchantOrderId.
     * @returns {string} 'COMPLETED' | 'FAILED' | 'PENDING' | 'CREATED'
     */
    async getPaymentStatus({ payment }) {
      const correlationId = crypto.randomUUID();
      const token = await auth.getAccessToken();

      logger.info('[PhonePe] Checking order status', {
        correlationId,
        operation: 'phonepe:checkStatus',
        merchantOrderId: payment.merchantOrderId,
      });

      const data = await phonePeFetch({
        url: `${pgBaseUrl}/checkout/v2/order/${payment.merchantOrderId}/status`,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `O-Bearer ${token}`,
        },
        auth,
        correlationId,
        operation: 'phonepe:checkStatus',
      });

      return data.state;
    },

    /**
     * Initiates a refund via POST /checkout/v2/order/refund.
     *
     * @param {Object} params
     * @param {string} params.merchantRefundId - Unique refund identifier.
     * @param {string} params.originalMerchantOrderId - Original payment order ID.
     * @param {number} params.amount - Refund amount in rupees.
     * @returns {Object} { status, merchant_refund_id, refund_amount }
     */
    async refundPayment({ merchantRefundId, originalMerchantOrderId, amount }) {
      const correlationId = crypto.randomUUID();
      const amountInPaisa = Math.round(amount * 100);
      const token = await auth.getAccessToken();

      logger.info('[PhonePe] Initiating refund', {
        correlationId,
        operation: 'phonepe:refund',
        merchantRefundId,
        originalMerchantOrderId,
        amountInPaisa,
      });

      const data = await phonePeFetch({
        url: `${pgBaseUrl}/checkout/v2/order/refund`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `O-Bearer ${token}`,
        },
        body: {
          merchantRefundId,
          originalMerchantOrderId,
          amount: amountInPaisa,
        },
        auth,
        correlationId,
        operation: 'phonepe:refund',
      });

      return {
        status: data.state === 'COMPLETED' ? 'SUCCESS' : data.state || 'PENDING',
        merchant_refund_id: merchantRefundId,
        refund_amount: amount,
      };
    },
  });
};
