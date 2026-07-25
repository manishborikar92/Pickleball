import { createSandboxPaymentProvider } from './sandbox-payment.provider.js';
import { createPhonePePaymentProvider } from './phonepe-payment.provider.js';

/**
 * Shared payment provider factory.
 *
 * Returns the appropriate payment provider based on environment:
 * - NODE_ENV=test → sandbox provider (no real API calls, no credentials needed)
 * - Otherwise     → PhonePe provider (raw fetch, requires credentials)
 *
 * Called ONCE at boot in routes/index.js. The returned provider is shared
 * between bookingsService (for createPaymentOrder) and reconciliationService
 * (for refundPayment), eliminating the previous dual-instantiation.
 */
export const createPaymentProviderFromEnv = (config = {}) => {
  // Post-payment browser returns land on the frontend /booking/redirect page
  // for every provider — the backend origin never reaches the customer.
  const frontendBaseUrl = config.frontendBaseUrl || 'http://localhost:3000';

  if (config.env === 'test' || config.isTest) {
    return createSandboxPaymentProvider({ frontendBaseUrl });
  }

  return createPhonePePaymentProvider({
    clientId: config.phonepe?.clientId,
    clientSecret: config.phonepe?.clientSecret,
    clientVersion: config.phonepe?.clientVersion || 1,
    merchantId: config.phonepe?.merchantId,
    env: config.phonepe?.env || 'SANDBOX',
    frontendBaseUrl,
  });
};
