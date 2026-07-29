// Notification domain constants — types, statuses, timing offsets, and error
// codes shared across the planner (scheduling) and dispatcher (delivery).
// See docs/adrs/ADR-011-notifications-module.md and
// docs/product/02-BUSINESS-LOGIC.md §8 ("Automated Notification Matrix").

/** A scheduled notification kind. Drives the template + the dispatch-time offset. */
export const NotificationType = Object.freeze({
  REMINDER_T24: 'reminder_t24',
  REMINDER_T2H: 'reminder_t2h',
  REVIEW_REQUEST: 'review_request',
});

/** Outbox row lifecycle. `sending` is the in-flight claim (dispatch-safety). */
export const NotificationStatus = Object.freeze({
  SCHEDULED: 'scheduled',
  SENDING: 'sending',
  SENT: 'sent',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  SKIPPED: 'skipped',
});

/** Lead time for each reminder, in hours before the session start. */
export const REMINDER_LEAD_HOURS = Object.freeze({
  [NotificationType.REMINDER_T24]: 24,
  [NotificationType.REMINDER_T2H]: 2,
});

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** Scheduled-fire offset from the session start (reminders) — negative = before. */
export const reminderOffsetMs = (type) => -REMINDER_LEAD_HOURS[type] * HOUR_MS;

/** Dispatcher backoff schedule (ms) by attempt count — 1m, 5m, 15m, 30m, 60m. */
export const RETRY_BACKOFF_MS = Object.freeze([1 * MINUTE_MS, 5 * MINUTE_MS, 15 * MINUTE_MS, 30 * MINUTE_MS, 60 * MINUTE_MS]);

export const DEFAULT_MAX_ATTEMPTS = 5;
export const DEFAULT_DISPATCH_LIMIT = 100;

/**
 * Max delay after a review_request's scheduled time before a still-uncompleted
 * booking gives up (the completion sweeper should have transitioned it by then).
 */
export const REVIEW_MAX_DELAY_MS = 48 * HOUR_MS;

export const NOTIFICATION_ERROR_CODES = Object.freeze({
  NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  TRANSPORT_NOT_CONFIGURED: 'NOTIFICATION_TRANSPORT_NOT_CONFIGURED',
  INVALID_SETTING: 'INVALID_NOTIFICATION_SETTING',
});

/** Default WhatsApp template language for the notification templates. */
export const DEFAULT_TEMPLATE_LANGUAGE = 'en_US';

/**
 * Maps a notification type to its Meta template config key on `config.notifications`
 * (`{ name, language }`). The names are empty until Meta templates are approved
 * (ADR-011) — the transport stays dry-run until then.
 */
export const TEMPLATE_CONFIG_KEY = Object.freeze({
  [NotificationType.REMINDER_T24]: 'reminderT24Template',
  [NotificationType.REMINDER_T2H]: 'reminderT2hTemplate',
  [NotificationType.REVIEW_REQUEST]: 'reviewTemplate',
});

/** Transport provider tag recorded on each sent notification (`dry_run` | `whatsapp`). */
export const TRANSPORT_PROVIDER = Object.freeze({
  DRY_RUN: 'dry_run',
  WHATSAPP: 'whatsapp',
});
