import crypto from 'node:crypto';

import { assertPaymentProvider } from './payment-provider.js';

export const createSandboxPaymentProvider = ({
  frontendBaseUrl = 'http://localhost:3000',
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
      // The sandbox has no hosted pay page: "paying" navigates straight to the
      // post-payment return, mirroring the PhonePe merchantUrls.redirectUrl.
      redirect_url: `${frontendBaseUrl}/booking/redirect?orderId=${merchantOrderId}`,
      amount,
      currency,
    };
  },

  async getPaymentStatus({ payment }) {
    if (payment.status === 'success') return 'COMPLETED';
    if (payment.status === 'failed') return 'FAILED';
    return 'PENDING';
  },

  async refundPayment({ merchantRefundId, amount }) {
    return {
      status: 'SUCCESS',
      merchant_refund_id: merchantRefundId,
      refund_amount: amount,
    };
  },
});
