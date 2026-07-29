import defaultConfig from '../../config/env.js';
import { createDefaultRewardIssuanceService } from '../rewards/index.js';
import { createDefaultNotificationPlanner } from '../notifications/index.js';
import { createBookingPricingService } from './booking-pricing.service.js';
import { createBookingSelectionService } from './booking-selection.service.js';
import { createBookingsRepository } from './bookings.repository.js';
import { createBookingsService } from './bookings.service.js';

export const createDefaultBookingsService = ({
  config = defaultConfig,
  venueService,
  paymentProvider,
  rewardIssuance,
  notificationPlanner,
} = {}) => {
  const repository = createBookingsRepository({
    rewardIssuance: rewardIssuance ?? createDefaultRewardIssuanceService(),
    notificationPlanner: notificationPlanner ?? createDefaultNotificationPlanner(),
  });
  const availabilityService = venueService;
  const selectionService = createBookingSelectionService();
  const pricingService = createBookingPricingService({
    taxRate: config.bookings.taxRate,
  });

  return createBookingsService({
    repository,
    availabilityService,
    selectionService,
    pricingService,
    paymentProvider,
  });
};

