import { createPaymentsRepository } from './payments.repository.js';
import { createPaymentsRouter } from './payments.routes.js';
import { createPaymentsService } from './payments.service.js';

export const createDefaultPaymentsService = ({ bookingsService } = {}) => {
  const repository = createPaymentsRepository();
  return createPaymentsService({ repository, bookingsService });
};

export const createDefaultPaymentsRouter = ({ bookingsService } = {}) => {
  const paymentsService = createDefaultPaymentsService({ bookingsService });
  return createPaymentsRouter({ paymentsService });
};
