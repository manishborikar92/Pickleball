import { createPaymentsRepository } from './payments.repository.js';
import { createPaymentsRouter } from './payments.routes.js';
import { createPaymentsService } from './payments.service.js';
import { createReconciliationService } from './reconciliation.service.js';
import { createSandboxPaymentProvider } from './sandbox-payment.provider.js';

export const createDefaultPaymentsService = ({ bookingsService, config } = {}) => {
  const repository = createPaymentsRepository();
  
  const paymentProvider = createSandboxPaymentProvider({
    baseUrl: `http://localhost:${config?.app?.port || 5000}`,
  });

  const reconciliationService = createReconciliationService({
    paymentsRepository: repository,
    bookingsService,
    paymentProvider,
  });

  // Register the late payment callback asynchronously to avoid circular coupling
  if (bookingsService) {
    bookingsService.onLatePayment = async ({ paymentId, bookingId, amount }) => {
      await reconciliationService.reconcileLatePayment({ paymentId, bookingId, amount });
    };
  }

  return createPaymentsService({
    repository,
    bookingsService,
    reconciliationService,
  });
};

export const createDefaultPaymentsRouter = ({ bookingsService, config } = {}) => {
  const paymentsService = createDefaultPaymentsService({ bookingsService, config });
  return createPaymentsRouter({ paymentsService });
};
