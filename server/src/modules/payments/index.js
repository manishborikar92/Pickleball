import { createPaymentsRepository } from './payments.repository.js';
import { createPaymentsRouter } from './payments.routes.js';
import { createPaymentsService } from './payments.service.js';
import { createReconciliationService } from './reconciliation.service.js';
import { createPaymentsWebhookRouter } from './webhook.routes.js';

export const createDefaultPaymentsService = ({ bookingsService, config: _config, authService, paymentProvider } = {}) => {
  const repository = createPaymentsRepository();

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

  const paymentsService = createPaymentsService({
    repository,
    bookingsService,
    reconciliationService,
    authorizationService: authService,
  });

  return { paymentsService, reconciliationService, repository };
};

export const createDefaultPaymentsRouter = ({ bookingsService, config, authService, paymentProvider } = {}) => {
  const { paymentsService, reconciliationService, repository } = createDefaultPaymentsService({
    bookingsService,
    config,
    authService,
    paymentProvider,
  });
  const router = createPaymentsRouter({
    paymentsService,
    paymentProvider,
    bookingsService,
    reconciliationService,
    config,
  });
  return { router, paymentsService, reconciliationService, repository };
};

export {
  createPaymentsRepository,
  createPaymentsService,
  createPaymentsRouter,
  createPaymentsWebhookRouter,
};
