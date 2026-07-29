import Joi from 'joi';

import { NotificationStatus, NotificationType } from './notifications.constants.js';

const UUID = Joi.string().uuid({ version: 'uuidv4' });

/** GET /notifications/settings?venue_id= */
export const settingsQuerySchema = Joi.object({
  venue_id: UUID.required(),
});

/** PATCH /notifications/settings — both toggles optional, at least one required. */
export const updateSettingsSchema = Joi.object({
  venue_id: UUID.required(),
  reminders_enabled: Joi.boolean(),
  review_requests_enabled: Joi.boolean(),
}).or('reminders_enabled', 'review_requests_enabled').messages({
  'object.missing': 'At least one of reminders_enabled or review_requests_enabled must be provided',
});

/** GET /notifications/log?venue_id=&status=&type=&page=&limit= */
export const logQuerySchema = Joi.object({
  venue_id: UUID.required(),
  status: Joi.string().valid(...Object.values(NotificationStatus)),
  type: Joi.string().valid(...Object.values(NotificationType)),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
