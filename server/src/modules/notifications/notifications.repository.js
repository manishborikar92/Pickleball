import { Prisma } from '@prisma/client';

import { getPrisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../utils/api-error.js';
import {
  DEFAULT_DISPATCH_LIMIT,
  DEFAULT_MAX_ATTEMPTS,
  NotificationStatus,
  NotificationType,
  RETRY_BACKOFF_MS,
  REVIEW_MAX_DELAY_MS,
} from './notifications.constants.js';

const isUniqueConflict = (error) => error?.code === 'P2002';

/**
 * Notifications outbox repository. The `tx`-accepting methods are called inside
 * the booking-confirmation transaction (atomic scheduling); the rest back the
 * dispatcher and admin surfaces. See docs/adrs/ADR-011.
 *
 * @param {{ prisma?: import('@prisma/client').PrismaClient }} deps
 */
export const createNotificationsRepository = ({ prisma } = {}) => {
  const db = () => prisma || getPrisma();

  // ── Scheduling (inside the confirm transaction) ──────────────────────────

  /**
   * Idempotently schedules a notification row. `UNIQUE (booking_id, type)`
   * absorbs duplicate confirm signals (P2002 → no-op). Past-target reminders
   * are never inserted by the planner, but this method is defensive: callers
   * pass already-computed `scheduledFor` values.
   * @returns {Promise<boolean>} true if a new row was created.
   */
  async function createScheduled({ tx, data }) {
    try {
      await tx.notification.create({ data });
      return true;
    } catch (error) {
      if (isUniqueConflict(error)) return false;
      throw error;
    }
  }

  /** The venue's notification toggles (or null if none configured). */
  async function getSettings({ tx, venueId }) {
    const client = tx || db();
    return client.notificationSetting.findUnique({ where: { venueId } });
  }

  // ── Dispatch (scheduler job) ─────────────────────────────────────────────

  /**
   * Atomically claims due outbox rows for dispatch: flips `scheduled → sending`
   * for rows whose `scheduledFor <= now` and whose retry window is open, bounded
   * by `limit`. The status-guarded update makes the claim safe under future
   * multi-instance dispatchers — only one claimant can flip each row.
   * @returns {Promise<object[]>} the claimed rows (with booking + venue + user).
   */
  async function claimDue({ now, limit = DEFAULT_DISPATCH_LIMIT } = {}) {
    const claimed = await db().notification.findMany({
      where: {
        status: NotificationStatus.SCHEDULED,
        scheduledFor: { lte: now },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      orderBy: { scheduledFor: 'asc' },
      take: limit,
      select: { id: true, bookingId: true, venueId: true, userId: true, type: true, scheduledFor: true, attempts: true },
    });

    if (claimed.length === 0) return [];

    const ids = claimed.map((row) => row.id);
    const result = await db().notification.updateMany({
      where: { id: { in: ids }, status: NotificationStatus.SCHEDULED },
      data: { status: NotificationStatus.SENDING },
    });

    if (result.count === 0) return [];

    // Only rows this caller actually claimed (a concurrent claimant may have
    // taken some between our select and update) proceed to dispatch.
    const claimedIds = new Set(
      result.count === ids.length ? ids : (await db().notification.findMany({
        where: { id: { in: ids }, status: NotificationStatus.SENDING },
        select: { id: true },
      })).map((r) => r.id),
    );

    return db().notification.findMany({
      where: { id: { in: [...claimedIds] } },
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            slotDate: true,
            sessionStartTime: true,
            sessionEndTime: true,
            venue: { select: { id: true, timezone: true, name: true, slug: true } },
            user: { select: { id: true, phone: true, name: true } },
          },
        },
      },
    });
  }

  /** Releases a claim back to `scheduled` (e.g. review_request awaiting completion). */
  async function releaseToScheduled({ id, nextRetryAt = null }) {
    await db().notification.update({
      where: { id },
      data: { status: NotificationStatus.SCHEDULED, nextRetryAt },
    });
  }

  /** Marks a notification successfully delivered. */
  async function markSent({ id, provider, now }) {
    await db().notification.update({
      where: { id },
      data: { status: NotificationStatus.SENT, sentAt: now, provider, lastError: null, nextRetryAt: null },
    });
  }

  /** Marks a notification no longer applicable (cancelled/expired booking, etc.). */
  async function markCancelled({ id, reason }) {
    await db().notification.update({
      where: { id, status: NotificationStatus.SENDING },
      data: { status: NotificationStatus.CANCELLED, lastError: reason, nextRetryAt: null },
    });
  }

  /** Marks a notification permanently skipped with a reason (too late, etc.). */
  async function markSkipped({ id, reason }) {
    await db().notification.update({
      where: { id, status: NotificationStatus.SENDING },
      data: { status: NotificationStatus.SKIPPED, lastError: reason, nextRetryAt: null },
    });
  }

  /**
   * Records a dispatch failure and schedules a retry with backoff, or dead-
   * letters the row once `maxAttempts` is reached. Returns the new status.
   */
  async function markFailed({ id, error, attempts, maxAttempts = DEFAULT_MAX_ATTEMPTS, now }) {
    const nextAttempts = attempts + 1;
    if (nextAttempts >= maxAttempts) {
      await db().notification.update({
        where: { id, status: NotificationStatus.SENDING },
        data: { status: NotificationStatus.FAILED, attempts: nextAttempts, lastError: error, nextRetryAt: null },
      });
      return NotificationStatus.FAILED;
    }

    const backoff = RETRY_BACKOFF_MS[Math.min(nextAttempts - 1, RETRY_BACKOFF_MS.length - 1)];
    await db().notification.update({
      where: { id, status: NotificationStatus.SENDING },
      data: {
        status: NotificationStatus.SCHEDULED,
        attempts: nextAttempts,
        lastError: error,
        nextRetryAt: new Date(now.getTime() + backoff),
      },
    });
    return NotificationStatus.SCHEDULED;
  }

  /** The max review-request wait before a still-uncompleted booking gives up. */
  const reviewMaxDelayMs = () => REVIEW_MAX_DELAY_MS;

  // ── Admin: settings ──────────────────────────────────────────────────────

  async function upsertSettings({ venueId, remindersEnabled, reviewRequestsEnabled, updatedBy }) {
    return db().notificationSetting.upsert({
      where: { venueId },
      update: {
        ...(remindersEnabled !== undefined ? { remindersEnabled } : {}),
        ...(reviewRequestsEnabled !== undefined ? { reviewRequestsEnabled } : {}),
        ...(updatedBy !== undefined ? { updatedBy } : {}),
      },
      create: {
        venueId,
        remindersEnabled: remindersEnabled ?? false,
        reviewRequestsEnabled: reviewRequestsEnabled ?? false,
        ...(updatedBy !== undefined ? { updatedBy } : {}),
      },
    });
  }

  // ── Admin: dispatch log (observability) ──────────────────────────────────

  async function findLog({ venueId, status, type, page = 1, limit = 20 }) {
    const where = {
      venueId,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    };
    const [rows, total] = await Promise.all([
      db().notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
        include: {
          booking: {
            select: {
              id: true,
              slotDate: true,
              sessionStartTime: true,
              sessionEndTime: true,
              user: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      }),
      db().notification.count({ where }),
    ]);
    return { rows, total };
  }

  /** Aggregate counts by status for the admin settings overview. */
  async function statusCounts({ venueId }) {
    const grouped = await db().notification.groupBy({
      by: ['status'],
      where: { venueId },
      _count: { _all: true },
    });
    const counts = {};
    for (const g of grouped) counts[g.status] = g._count._all;
    return counts;
  }

  // ── Helpers shared with the planner ──────────────────────────────────────

  /** Loads the venue timezone + notification settings for the planner, in-tx. */
  async function getPlannerContext({ tx, venueId }) {
    const [venue, settings] = await Promise.all([
      tx.venue.findUnique({
        where: { id: venueId },
        select: { id: true, timezone: true },
      }),
      getSettings({ tx, venueId }),
    ]);
    return { venue, settings };
  }

  return {
    // scheduling
    createScheduled,
    getSettings,
    getPlannerContext,
    // dispatch
    claimDue,
    releaseToScheduled,
    markSent,
    markCancelled,
    markSkipped,
    markFailed,
    reviewMaxDelayMs,
    // admin
    upsertSettings,
    findLog,
    statusCounts,
  };
};

export { NotificationType, NotificationStatus, Prisma, NotFoundError };
