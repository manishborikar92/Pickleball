/**
 * services/paymentRedirect.js — Post-payment redirect routing for `/booking/redirect`.
 *
 * PhonePe (and the sandbox provider) redirect the customer's browser back to
 * the frontend `/booking/redirect?orderId=...` route after payment — the
 * target of PhonePe's `merchantUrls.redirectUrl`. PhonePe shares no status
 * client-side, so the page verifies the order through `verifyPaymentAction`
 * (which reconciles it on the backend via the gateway Order Status API) and
 * then forwards the customer to their booking. These helpers hold the pure
 * routing decisions so `node:test` can exercise every branch without a network
 * or Next runtime (same pattern as checkout.js).
 *
 * Every returned path is an internal, whitelisted destination — the orderId
 * from the URL is never reflected into a path, so a crafted redirect link
 * cannot turn this route into an open redirect.
 */

// Merchant order ids are provider-generated (`PP-<hex>`, `SANDBOX-<uuid>`).
// Mirror of the backend Joi constraint (6–255 chars), restricted to the
// URL-safe charset the providers actually emit.
const MERCHANT_ORDER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{5,254}$/;

/**
 * Whether a redirect `orderId` query value plausibly names a payment order.
 * @param {unknown} orderId
 * @returns {boolean}
 */
export function isLikelyMerchantOrderId(orderId) {
  return typeof orderId === "string" && MERCHANT_ORDER_ID_PATTERN.test(orderId);
}

/**
 * Maps a `verifyPaymentAction` result to the destination the redirect page
 * should replace itself with.
 *
 * Any verified order — COMPLETED, FAILED, or still PENDING — lands on the
 * unified `/booking/[bookingId]` page, which already renders the right view
 * (confirmation, failure + retry, or polling) from the payment ledger. The
 * error page is reserved for orders that cannot be resolved to a booking.
 *
 * @param {{ ok: boolean, data?: { bookingId?: string }, error?: { code?: string } }} result
 * @returns {string} Internal path to navigate to.
 */
export function resolvePaymentRedirectPath(result) {
  if (result?.ok && result.data?.bookingId) {
    return `/booking/${encodeURIComponent(result.data.bookingId)}`;
  }
  const code = result?.error?.code;
  if (code === "bad_request") {
    return "/booking/error?type=missing_order_id";
  }
  if (code === "not_found") {
    return "/booking/error?type=notFound";
  }
  return "/booking/error?type=api_failure";
}
