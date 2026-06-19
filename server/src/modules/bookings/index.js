import { createSandboxPaymentProvider } from '../payments/sandbox-payment.provider.js';
import { createBookingPricingService } from './booking-pricing.service.js';
import { createBookingSelectionService } from './booking-selection.service.js';
import { createBookingsRepository } from './bookings.repository.js';
import { createBookingsService } from './bookings.service.js';

const defaultApiBaseUrl = (config) => `http://localhost:${config?.app?.port || 5000}`;

export const createDefaultBookingsService = ({ config, venueService } = {}) => {
  const repository = createBookingsRepository();
  const availabilityService = venueService;
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

