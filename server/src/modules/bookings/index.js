import { createBookingPricingService } from './booking-pricing.service.js';
import { createBookingSelectionService } from './booking-selection.service.js';
import { createBookingsRepository } from './bookings.repository.js';
import { createBookingsService } from './bookings.service.js';

export const createDefaultBookingsService = ({ config, venueService, paymentProvider } = {}) => {
  const repository = createBookingsRepository();
  const availabilityService = venueService;
  const selectionService = createBookingSelectionService();
  const pricingService = createBookingPricingService();

  return createBookingsService({
    repository,
    availabilityService,
    selectionService,
    pricingService,
    paymentProvider,
  });
};

