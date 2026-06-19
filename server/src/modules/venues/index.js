import { createBookingPricingService } from '../bookings/booking-pricing.service.js';
import { createVenuesRepository } from './venues.repository.js';
import { createVenuesRouter } from './venues.routes.js';
import { createVenuesService } from './venues.service.js';

export const createDefaultVenuesService = () => {
  const repository = createVenuesRepository();
  const pricingService = createBookingPricingService();
  return createVenuesService({ repository, pricingService });
};

export const createDefaultVenuesRouter = ({ venueService } = {}) => createVenuesRouter({
  venueService,
});
