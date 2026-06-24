import defaultConfig from '../../config/env.js';
import { createBookingPricingService } from '../bookings/booking-pricing.service.js';
import { createVenuesRepository } from './venues.repository.js';
import { createVenuesRouter } from './venues.routes.js';
import { createVenuesService } from './venues.service.js';

export const createDefaultVenuesService = () => {
  const repository = createVenuesRepository();
  const pricingService = createBookingPricingService({
    taxRate: defaultConfig.bookings.taxRate,
  });
  return createVenuesService({ repository, pricingService });
};

export const createDefaultVenuesRouter = ({ venueService } = {}) => createVenuesRouter({
  venueService,
});
