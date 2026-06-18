import { createSandboxPaymentProvider } from '../payments/sandbox-payment.provider.js';
import { createDefaultVenuesService } from '../venues/index.js';
import { createBookingPricingService } from './booking-pricing.service.js';
import { createBookingSelectionService } from './booking-selection.service.js';
import { createBookingsRepository } from './bookings.repository.js';
import { createBookingsRouter } from './bookings.routes.js';
import { createBookingsService } from './bookings.service.js';

const defaultApiBaseUrl = (config) => `http://localhost:${config?.app?.port || 5000}`;

export const createDefaultBookingsService = ({ config } = {}) => {
  const repository = createBookingsRepository();
  const availabilityService = createDefaultVenuesService();
  const selectionService = createBookingSelectionService();
  const pricingService = createBookingPricingService();
  const paymentProvider = createSandboxPaymentProvider({
    baseUrl: defaultApiBaseUrl(config),
  });

  return createBookingsService({
    repository,
    availabilityService,
    selectionService,
    pricingService,
    paymentProvider,
  });
};

export const createDefaultBookingsRouter = ({ config } = {}) => {
  const bookingsService = createDefaultBookingsService({ config });
  return createBookingsRouter({ bookingsService });
};
