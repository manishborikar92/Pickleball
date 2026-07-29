import defaultLogger from '../../utils/logger.js';
import {
  DEFAULT_DISPATCH_LIMIT,
  DEFAULT_MAX_ATTEMPTS,
  NotificationStatus,
  NotificationType,
  TRANSPORT_PROVIDER,
} from './notifications.constants.js';

const HOUR_MS = 60 * 60 * 1000;

/** Booking statuses that mean the session is still upcoming (reminders are valid). */
const UPCOMING_STATUSES = new Set(['confirmed', 'walk_in']);
/** Booking statuses that mean the session is over and reviewed-out (review is valid). */
const COMPLETED = 'completed';
/** Booking statuses that void any pending notification (no message should ever go out). */
const VOID_STATUSES = new Set(['cancelled', 'expired', 'admin_block', 'pending_payment']);

const serializeSettings = (settings) => ({
  id: settings.id,
  venue_id: settings.venueId,
  reminders_enabled: settings.remindersEnabled,
  review_requests_enabled: settings.reviewRequestsEnabled,
  updated_at: settings.updatedAt,
});

const serializeNotification = (row) => ({
  id: row.id,
  booking_id: row.bookingId,
  type: row.type,
  status: row.status,
  scheduled_for: row.scheduledFor,
  attempts: row.attempts,
  sent_at: row.sentAt,
  provider: row.provider,
  last_error: row.lastError,
  created_at: row.createdAt,
  booking: row.booking
    ? {
        id: row.booking.id,
        slot_date: row.booking.slotDate,
        session_start_time: row.booking.sessionStartTime,
        session_end_time: row.booking.sessionEndTime,
        user: row.booking.user
          ? { id: row.booking.user.id, name: row.booking.user.name, phone: row.booking.user.phone }
          : undefined,
      }
    : undefined,
});

/**
 * Notifications service — backs the scheduler's `dispatch-due-notifications` job
 * and the admin settings/log routes.
 *
 * The dispatcher is the delivery half of the system (the planner is the
 * scheduling half). It claims due outbox rows, re-checks booking eligibility at
 * dispatch time (the core correctness guard against state changes between
 * scheduling and delivery), and sends via the transport — dry-run until Meta is
 * configured. Failures retry with backoff and dead-letter at `maxAttempts`.
 *
 * Admin routes supply `venue_id` in the query/body, so permission enforcement
 * lives at the route layer via `requireVenuePermission` (mirrors the reviews and
 * rewards list endpoints). The service does not re-authorize.
 *
 * See docs/adrs/ADR-011-notifications-module.md.
 *
 * @param {{ repository: object, transport: object, config: object, clock?: () => Date, logger?: object, maxAttempts?: number, dispatchLimit?: number }} deps
 */
export const createNotificationsService = ({
  repository,
  transport,
  config,
  clock = () => new Date(),
  logger = defaultLogger,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  dispatchLimit = DEFAULT_DISPATCH_LIMIT,
} = {}) => {
  if (!repository) throw new Error('repository is required');
  if (!transport) throw new Error('transport is required');

  const frontendBaseUrl = config?.frontendBaseUrl || '';

  // ── Dispatcher (scheduler job) ───────────────────────────────────────────

  /**
   * Builds the absolute review link for a post-session review request.
   * @param {string} bookingId
   */
  const reviewLink = (bookingId) => `${frontendBaseUrl}/review/${bookingId}`;

  /**
   * Resolves the WhatsApp template body parameters for a notification type,
   * from the claimed row's booking context.
   */
  const templateParams = (row, type) => {
    if (type === NotificationType.REVIEW_REQUEST) {
      return { link: reviewLink(row.bookingId) };
    }
    // Reminders carry the session time + venue name for context.
    const booking = row.booking;
    if (!booking) return {};
    const sessionStart = booking.sessionStartTime instanceof Date
      ? booking.sessionStartTime.toISOString().slice(11, 16)
      : String(booking.sessionStartTime);
    return {
      venue: booking.venue?.name ?? '',
      time: sessionStart,
    };
  };

  /**
   * Decides an outcome for a claimed notification given the booking's current
   * status. Returns one of: 'send' | 'skip' | 'cancel' | 'wait'.
   *  - send:   deliver now.
   *  - skip:   mark skipped (permanently not applicable, e.g. reminder after session ended).
   *  - cancel: mark cancelled (booking voided).
   *  - wait:   release back to scheduled (review_request awaiting completion transition).
   */
  const eligibility = (row, now) => {
    const status = row.booking?.status;
    const type = row.type;

    if (VOID_STATUSES.has(status)) {
      return { action: 'cancel', reason: `booking ${status}` };
    }

    if (type === NotificationType.REVIEW_REQUEST) {
      if (status === COMPLETED) return { action: 'send' };
      if (UPCOMING_STATUSES.has(status)) {
        // The completion sweeper (every ~5m) hasn't transitioned yet. Wait,
        // but give up once the review is far overdue (booking never completed).
        if (now.getTime() - row.scheduledFor.getTime() > repository.reviewMaxDelayMs()) {
          return { action: 'skip', reason: 'booking never transitioned to completed' };
        }
        return { action: 'wait' };
      }
      return { action: 'cancel', reason: `booking ${status}` };
    }

    // Reminders: only valid while the session is still upcoming.
    if (UPCOMING_STATUSES.has(status)) return { action: 'send' };
    if (status === COMPLETED) return { action: 'skip', reason: 'session already ended' };
    return { action: 'cancel', reason: `booking ${status}` };
  };

  /**
   * Dispatches all due notifications. Idempotent and concurrency-safe via the
   * repository's status-guarded claim. Intended to run on the scheduler interval.
   * @returns {Promise<object>} per-outcome counts for observability.
   */
  async function dispatchDueNotifications({ now = clock(), limit = dispatchLimit } = {}) {
    const claimed = await repository.claimDue({ now, limit });
    if (claimed.length === 0) {
      return { claimed: 0, sent: 0, skipped: 0, cancelled: 0, failed: 0, waiting: 0 };
    }

    const result = { claimed: claimed.length, sent: 0, skipped: 0, cancelled: 0, failed: 0, waiting: 0 };

    for (const row of claimed) {
      try {
        const decision = eligibility(row, now);

        if (decision.action === 'wait') {
          await repository.releaseToScheduled({ id: row.id, nextRetryAt: now });
          result.waiting += 1;
          continue;
        }
        if (decision.action === 'skip') {
          await repository.markSkipped({ id: row.id, reason: decision.reason });
          result.skipped += 1;
          logger.info('Notification skipped', {
            operation: 'notifications:dispatch:skip',
            notificationId: row.id,
            type: row.type,
            reason: decision.reason,
          });
          continue;
        }
        if (decision.action === 'cancel') {
          await repository.markCancelled({ id: row.id, reason: decision.reason });
          result.cancelled += 1;
          logger.info('Notification cancelled', {
            operation: 'notifications:dispatch:cancel',
            notificationId: row.id,
            type: row.type,
            reason: decision.reason,
          });
          continue;
        }

        // action === 'send'
        const { provider, delivered } = await transport.send({
          to: row.booking?.user?.phone,
          type: row.type,
          params: templateParams(row, row.type),
        });

        if (!delivered) {
          throw new Error('Transport reported non-delivery');
        }

        await repository.markSent({ id: row.id, provider, now });
        result.sent += 1;
        logger.info('Notification sent', {
          operation: 'notifications:dispatch:sent',
          notificationId: row.id,
          type: row.type,
          provider,
        });
      } catch (error) {
        const newStatus = await repository.markFailed({
          id: row.id,
          error: error.message || String(error),
          attempts: row.attempts,
          maxAttempts,
          now,
        });
        if (newStatus === NotificationStatus.FAILED) {
          result.failed += 1;
          logger.error('Notification dead-lettered after max attempts', {
            operation: 'notifications:dispatch:dead-letter',
            notificationId: row.id,
            type: row.type,
            error,
          });
        } else {
          result.failed += 1;
          logger.warn('Notification dispatch failed — retry scheduled', {
            operation: 'notifications:dispatch:retry',
            notificationId: row.id,
            type: row.type,
            error,
          });
        }
      }
    }

    logger.info('Notification dispatch cycle complete', {
      operation: 'notifications:dispatch:complete',
      ...result,
    });
    return result;
  }

  // ── Admin: settings (manage_venues) ──────────────────────────────────────

  async function getNotificationSettings({ venueId }) {
    const settings = await repository.getSettings({ venueId });
    if (!settings) {
      // Return defaults (toggles off) when no row exists yet, rather than 404 —
      // the settings page is readable before any toggle has been touched.
      return serializeSettings({
        id: null,
        venueId,
        remindersEnabled: false,
        reviewRequestsEnabled: false,
        updatedAt: null,
      });
    }
    return serializeSettings(settings);
  }

  async function updateNotificationSettings({ userId, venueId, input }) {
    const updated = await repository.upsertSettings({
      venueId,
      remindersEnabled: input.reminders_enabled,
      reviewRequestsEnabled: input.review_requests_enabled,
      updatedBy: userId,
    });
    logger.info('Notification settings updated', {
      operation: 'notifications:settings:update',
      venueId,
      userId,
      remindersEnabled: updated.remindersEnabled,
      reviewRequestsEnabled: updated.reviewRequestsEnabled,
    });
    return serializeSettings(updated);
  }

  // ── Admin: dispatch log (manage_bookings) ────────────────────────────────

  async function getNotificationLog({ venueId, status, type, page = 1, limit = 20 }) {
    const { rows, total } = await repository.findLog({ venueId, status, type, page, limit });
    return {
      data: rows.map(serializeNotification),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
      summary: await repository.statusCounts({ venueId }),
    };
  }

  return {
    dispatchDueNotifications,
    getNotificationSettings,
    updateNotificationSettings,
    getNotificationLog,
  };
};

export { NotificationType, NotificationStatus, TRANSPORT_PROVIDER, HOUR_MS };
