import assert from 'node:assert/strict';
import test from 'node:test';
import { getPrisma } from '../../src/lib/prisma.js';
import { createBookingsRepository } from '../../src/modules/bookings/bookings.repository.js';
import { createNotificationsRepository } from '../../src/modules/notifications/notifications.repository.js';
import { NotificationType } from '../../src/modules/notifications/notifications.constants.js';

/**
 * Proves the notification-scheduling injection: a genuinely-confirmed booking
 * schedules notification outbox rows inside the confirm transaction, while the
 * phantom/late-payment (forceExpire) branch does not. Uses the real test DB and
 * the real planner + repository (toggles are enabled directly on the venue's
 * notification_settings row), so this exercises the full scheduling path.
 */
test('Notifications schedule on genuine confirm, not on phantom force-expire', async (t) => {
  const prisma = getPrisma();
  const notificationsRepository = createNotificationsRepository({ prisma });
  // Planner wired exactly as createDefaultBookingsService does.
  const { createNotificationPlannerService } = await import('../../src/modules/notifications/notifications.planner.js');
  const planner = createNotificationPlannerService({ repository: notificationsRepository });
  const repository = createBookingsRepository({ prisma, notificationPlanner: planner });

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const phone = `+91888888${Math.floor(1000 + Math.random() * 9000)}`;

  const user = await prisma.user.create({
    data: { name: 'Notif Test User', phone, isPhoneVerified: true, walletCredits: 2000 },
  });
  const venue = await prisma.venue.create({
    data: {
      name: 'Notif Test Venue',
      slug: `notif-venue-${suffix}`,
      address: '123 Test St',
      city: 'Test City',
      timezone: 'Asia/Kolkata',
      rolloverTime: new Date('1970-01-01T08:00:00.000Z'),
    },
  });
  const court = await prisma.court.create({
    data: { venueId: venue.id, name: 'Court 1', environment: 'indoor', status: 'active' },
  });
  // Enable both toggles for this venue.
  await prisma.notificationSetting.upsert({
    where: { venueId: venue.id },
    update: { remindersEnabled: true, reviewRequestsEnabled: true },
    create: { venueId: venue.id, remindersEnabled: true, reviewRequestsEnabled: true },
  });

  t.after(async () => {
    await prisma.notification.deleteMany({ where: { venueId: venue.id } }).catch(() => {});
    await prisma.notificationSetting.deleteMany({ where: { venueId: venue.id } }).catch(() => {});
    await prisma.payment.deleteMany({ where: { booking: { userId: user.id } } }).catch(() => {});
    await prisma.bookingSlot.deleteMany({ where: { courtId: court.id } }).catch(() => {});
    await prisma.booking.deleteMany({ where: { userId: user.id } }).catch(() => {});
    await prisma.court.delete({ where: { id: court.id } }).catch(() => {});
    await prisma.venue.delete({ where: { id: venue.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  });

  const makeBooking = async ({ offsetDays }) => {
    const slotDate = new Date('2026-12-25T00:00:00.000Z');
    slotDate.setUTCDate(slotDate.getUTCDate() + offsetDays);
    const booking = await prisma.booking.create({
      data: {
        venueId: venue.id,
        userId: user.id,
        slotDate,
        sessionStartTime: new Date('1970-01-01T09:00:00.000Z'),
        sessionEndTime: new Date('1970-01-01T10:00:00.000Z'),
        sessionDurationMins: 60,
        courtCount: 1,
        slotUnitCount: 1,
        status: 'pending_payment',
        baseAmount: 500,
        totalAmount: 500,
        creditsApplied: 0,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        waiverAccepted: true,
      },
    });
    return booking;
  };

  await t.test('confirmBooking schedules reminders + review request', async () => {
    const booking = await makeBooking({ offsetDays: 30 });
    const confirmed = await repository.confirmBooking({ bookingId: booking.id });

    assert.equal(confirmed.status, 'confirmed');

    const notifications = await prisma.notification.findMany({ where: { bookingId: booking.id } });
    const types = notifications.map((n) => n.type).sort();
    assert.deepEqual(
      types,
      [NotificationType.REMINDER_T24, NotificationType.REMINDER_T2H, NotificationType.REVIEW_REQUEST].sort(),
    );
    for (const n of notifications) {
      assert.equal(n.status, 'scheduled');
      assert.ok(n.scheduledFor.getTime() > Date.now(), 'scheduledFor should be in the future');
    }
  });

  await t.test('duplicate confirm (already confirmed) does not double-schedule', async () => {
    const booking = await makeBooking({ offsetDays: 31 });
    await repository.confirmBooking({ bookingId: booking.id });
    // Second call — booking already confirmed; confirmBooking returns early, so
    // no new scheduling. Assert exactly one set of rows exists (idempotency).
    await repository.confirmBooking({ bookingId: booking.id });

    const notifications = await prisma.notification.findMany({ where: { bookingId: booking.id } });
    assert.equal(notifications.length, 3);
  });

  await t.test('phantom force-expire confirm schedules nothing', async () => {
    const booking = await makeBooking({ offsetDays: 0 });
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: 500,
        gateway: 'phonepe',
        merchantOrderId: `PP-NOTIF-${suffix}`,
        status: 'initiated',
      },
    });

    // Session already ended → forceExpire: the booking expires, NOT confirms.
    const result = await repository.confirmProviderPayment({
      paymentId: payment.id,
      bookingId: booking.id,
      payload: { mock: 'phantom' },
      now: new Date(),
      forceExpire: true,
    });

    assert.equal(result.booking.status, 'expired');

    const notifications = await prisma.notification.findMany({ where: { bookingId: booking.id } });
    assert.equal(notifications.length, 0, 'phantom/force-expired bookings must not schedule notifications');
  });

  await t.test('schedules nothing when both toggles are off', async () => {
    await prisma.notificationSetting.update({
      where: { venueId: venue.id },
      data: { remindersEnabled: false, reviewRequestsEnabled: false },
    });
    const booking = await makeBooking({ offsetDays: 32 });
    await repository.confirmBooking({ bookingId: booking.id });

    const notifications = await prisma.notification.findMany({ where: { bookingId: booking.id } });
    assert.equal(notifications.length, 0);

    // Restore toggles for subsequent subtests.
    await prisma.notificationSetting.update({
      where: { venueId: venue.id },
      data: { remindersEnabled: true, reviewRequestsEnabled: true },
    });
  });

  await t.test('wallet-only confirm path also schedules notifications', async () => {
    const booking = await makeBooking({ offsetDays: 33 });
    // Wallet-only: providerAmount 0 → confirmWalletOnlyPayment.
    await repository.confirmWalletOnlyPayment({
      bookingId: booking.id,
      userId: user.id,
      creditsApplied: 500,
      now: new Date(),
    });

    const notifications = await prisma.notification.findMany({ where: { bookingId: booking.id } });
    assert.equal(notifications.length, 3);
  });
});
