import defaultLogger from '../../utils/logger.js';
import { getBookingEndUtc, getBookingStartUtc } from '../bookings/booking-time.js';
import {
  NotificationType,
  reminderOffsetMs,
} from './notifications.constants.js';

const isUniqueConflict = (error) => error?.code === 'P2002';

/**
 * Notification scheduling service — the notifications counterpart of the
 * rewards issuance service (`createRewardIssuanceService`). It is injected into
 * the bookings repository and called inside ALL THREE booking-confirmation
 * transactions (`confirmWalletOnlyPayment`, `confirmProviderPayment`,
 * `confirmBooking`) so scheduling commits atomically with confirmation. A
 * rolled-back confirmation leaves no orphaned outbox rows; a duplicate confirm
 * signal is absorbed by `UNIQUE (booking_id, type)`.
 *
 * This service only INSERTS outbox rows — it never sends. Delivery is the
 * dispatcher's job (`createNotificationsService.dispatchDueNotifications`),
 * keeping scheduling and transport cleanly separated (ADR-011).
 *
 * `booking-time.js` is a pure leaf utility (no domain imports), so importing it
 * here introduces no module cycle.
 *
 * @param {{ repository: object, clock?: () => Date, logger?: object }} deps
 */
export const createNotificationPlannerService = ({
  repository,
  clock = () => new Date(),
  logger = defaultLogger,
} = {}) => {
  if (!repository) throw new Error('repository is required');

  /**
   * Resolves the per-type target time (UTC) for a booking, or null when the
   * venue timezone is unavailable. Reminders target the session start minus
   * their lead; the review request targets the session end (post-session).
   * @param {object} booking - Has slotDate + session times.
   * @param {string} timezone - The venue IANA timezone.
   * @param {string} type
   */
  const targetFor = (booking, timezone, type) => {
    if (!timezone) return null;
    if (type === NotificationType.REVIEW_REQUEST) {
      return getBookingEndUtc(booking, timezone);
    }
    const startUtc = getBookingStartUtc(booking, timezone);
    return new Date(startUtc.getTime() + reminderOffsetMs(type));
  };

  /**
   * Schedules notification outbox rows for a freshly-confirmed booking, inside
   * the caller's confirm transaction (`tx`). Respects the venue's toggles and
   * skips targets already in the past. Idempotent on duplicate confirm signals.
   *
   * @param {{ tx: import('@prisma/client').PrismaTransactionClient, booking: object, now?: Date }} args
   * @returns {Promise<{ scheduled: string[] }>} the types newly scheduled.
   */
  async function scheduleForBooking({ tx, booking, now = clock() }) {
    const { venue, settings } = await repository.getPlannerContext({
      tx,
      venueId: booking.venueId,
    });

    if (!venue || !settings) return { scheduled: [] };
    if (!settings.remindersEnabled && !settings.reviewRequestsEnabled) {
      return { scheduled: [] };
    }

    const desired = [];
    if (settings.remindersEnabled) {
      desired.push(NotificationType.REMINDER_T24, NotificationType.REMINDER_T2H);
    }
    if (settings.reviewRequestsEnabled) {
      desired.push(NotificationType.REVIEW_REQUEST);
    }

    const scheduled = [];
    for (const type of desired) {
      const scheduledFor = targetFor(booking, venue.timezone, type);
      if (!scheduledFor) continue; // no venue timezone — skip defensively
      if (scheduledFor <= now) continue; // target already passed — nothing to send

      try {
        const created = await repository.createScheduled({
          tx,
          data: {
            bookingId: booking.id,
            venueId: booking.venueId,
            userId: booking.userId,
            type,
            scheduledFor,
            status: 'scheduled',
          },
        });
        if (created) scheduled.push(type);
      } catch (error) {
        // Idempotent confirm: a UNIQUE (booking_id, type) collision means this
        // notification was already scheduled by an earlier confirm signal.
        if (isUniqueConflict(error)) continue;
        throw error;
      }
    }

    if (scheduled.length > 0) {
      logger.info('Notifications scheduled', {
        operation: 'notifications:plan',
        bookingId: booking.id,
        types: scheduled,
      });
    }

    return { scheduled };
  }

  return { scheduleForBooking };
};
