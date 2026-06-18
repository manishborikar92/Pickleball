import crypto from 'node:crypto';

import { assertPaymentProvider } from './payment-provider.js';

export const createSandboxPaymentProvider = ({
  baseUrl = 'http://localhost:5000',
  randomId = () => crypto.randomUUID(),
} = {}) => assertPaymentProvider({
  name: 'sandbox',

  async createPaymentOrder({
    amount,
    currency = 'INR',
  }) {
    const merchantOrderId = `SANDBOX-${randomId()}`;
    return {
      provider: 'sandbox',
      gateway: 'sandbox',
      merchant_order_id: merchantOrderId,
      redirect_url: `${baseUrl}/api/v1/payments/sandbox/${merchantOrderId}/complete`,
      amount,
      currency,
    };
  },

  async getPaymentStatus({ payment }) {
    if (payment.status === 'success') return 'COMPLETED';
    if (payment.status === 'failed') return 'FAILED';
    return 'PENDING';
  },
});
