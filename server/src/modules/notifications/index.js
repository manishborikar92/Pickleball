import defaultConfig from '../../config/env.js';
import { createNotificationTransport } from './notifications.transport.js';
import { createNotificationPlannerService } from './notifications.planner.js';
import { createNotificationsRepository } from './notifications.repository.js';
import { createNotificationsService } from './notifications.service.js';

/**
 * Default notification planner — injected into the bookings repository so
 * scheduling runs inside the confirm transactions (mirrors the reward-issuance
 * injection in `modules/bookings/index.js`). Stateless factory; safe to build
 * its own repository like the rewards issuance service does.
 */
export const createDefaultNotificationPlanner = () => {
  const repository = createNotificationsRepository();
  return createNotificationPlannerService({ repository });
};

/**
 * Default notifications service — backs the dispatcher (scheduler job) and the
 * admin settings/log routes. The transport is built from config; it stays
 * dry-run until Meta is configured (`config.notifications.transportMode`).
 */
export const createDefaultNotificationsService = ({
  config = defaultConfig,
} = {}) => {
  const repository = createNotificationsRepository();
  const transport = createNotificationTransport({ config });
  return createNotificationsService({
    repository,
    transport,
    config,
  });
};

export { createNotificationTransport } from './notifications.transport.js';
export { createNotificationPlannerService } from './notifications.planner.js';
export { createNotificationsService } from './notifications.service.js';
export { createNotificationsRepository } from './notifications.repository.js';
export { createNotificationsRouter } from './notifications.routes.js';
