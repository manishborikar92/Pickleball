import assert from 'node:assert/strict';
import test from 'node:test';
import { getPrisma } from '../../src/lib/prisma.js';
import { createBookingsRepository } from '../../src/modules/bookings/bookings.repository.js';

test('BookingsRepository - confirmProviderPayment state transitions', async (t) => {
  const prisma = getPrisma();
  const repository = createBookingsRepository({ prisma });

  // Generate unique suffix for database integrity
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const phone = `+91999999${Math.floor(1000 + Math.random() * 9000)}`;

  // 1. Setup global prerequisites: User and Venue
  const user = await prisma.user.create({
    data: {
      name: 'Test Repo User',
      phone,
      isPhoneVerified: true,
      walletCredits: 500,
    },
  });

  const venue = await prisma.venue.create({
    data: {
      name: 'Test Repo Venue',
      slug: `test-repo-venue-${suffix}`,
      address: '123 Test St',
      city: 'Test City',
      timezone: 'Asia/Kolkata',
      rolloverTime: new Date('1970-01-01T08:00:00.000Z'),
    },
  });

  const court = await prisma.court.create({
    data: {
      venueId: venue.id,
      name: 'Court 1',
      environment: 'indoor',
      status: 'active',
    },
  });

  t.after(async () => {
    // Cleanup everything
    await prisma.payment.deleteMany({ where: { booking: { userId: user.id } } }).catch(() => {});
    await prisma.bookingSlot.deleteMany({ where: { courtId: court.id } }).catch(() => {});
    await prisma.booking.deleteMany({ where: { userId: user.id } }).catch(() => {});
    await prisma.court.delete({ where: { id: court.id } }).catch(() => {});
    await prisma.venue.delete({ where: { id: venue.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  });

  await t.test('Test 1 & Test 3: Late payment after expiry where cleanup has NOT executed, and wallet credit preservation', async () => {
    const now = new Date('2026-06-20T12:00:00.000Z');
    const expiresAt = new Date('2026-06-20T11:55:00.000Z'); // expired 5 mins ago

    // Create booking in pending_payment status but expired
    const booking = await prisma.booking.create({
      data: {
        venueId: venue.id,
        userId: user.id,
        slotDate: new Date('2026-06-20T00:00:00.000Z'),
        sessionStartTime: new Date('1970-01-01T09:00:00.000Z'),
        sessionEndTime: new Date('1970-01-01T10:00:00.000Z'),
        sessionDurationMins: 60,
        courtCount: 1,
        slotUnitCount: 1,
        status: 'pending_payment',
        baseAmount: 500,
        totalAmount: 500,
        creditsApplied: 100, // credits applied
        expiresAt,
        waiverAccepted: true,
      },
    });

    const slot = await prisma.bookingSlot.create({
      data: {
        bookingId: booking.id,
        courtId: court.id,
        slotDate: new Date('2026-06-20T00:00:00.000Z'),
        slotStartTime: new Date('1970-01-01T09:00:00.000Z'),
        slotEndTime: new Date('1970-01-01T10:00:00.000Z'),
        status: 'pending_payment',
        unitPrice: 500,
      },
    });

    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: 400,
        gateway: 'phonepe',
        merchantOrderId: `PP-LATE-${suffix}`,
        status: 'initiated',
      },
    });

    // Execute confirmProviderPayment (Case B: HAS expired)
    const result = await repository.confirmProviderPayment({
      paymentId: payment.id,
      bookingId: booking.id,
      payload: { mock: 'late' },
      now,
    });

    // Verify booking has transitioned to 'expired' and NOT 'confirmed'
    assert.equal(result.booking.status, 'expired');
    assert.equal(result.payment.status, 'success');

    // Verify database booking slot has transitioned to 'expired'
    const updatedSlot = await prisma.bookingSlot.findUnique({ where: { id: slot.id } });
    assert.equal(updatedSlot.status, 'expired');

    // Test 3 Verification: creditsApplied is preserved (NOT zeroed out) during repo transition
    assert.equal(Number(result.booking.creditsApplied), 100);

    // Verify database booking record status and preserved credits
    const dbBooking = await prisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(dbBooking.status, 'expired');
    assert.equal(Number(dbBooking.creditsApplied), 100);
  });

  await t.test('Test 2: On-time payment behavior is unchanged', async () => {
    const now = new Date('2026-06-20T12:00:00.000Z');
    const expiresAt = new Date('2026-06-20T12:05:00.000Z'); // expires in 5 mins (on-time)

    const booking = await prisma.booking.create({
      data: {
        venueId: venue.id,
        userId: user.id,
        slotDate: new Date('2026-06-20T00:00:00.000Z'),
        sessionStartTime: new Date('1970-01-01T09:00:00.000Z'),
        sessionEndTime: new Date('1970-01-01T10:00:00.000Z'),
        sessionDurationMins: 60,
        courtCount: 1,
        slotUnitCount: 1,
        status: 'pending_payment',
        baseAmount: 500,
        totalAmount: 500,
        creditsApplied: 0,
        expiresAt,
        waiverAccepted: true,
      },
    });

    const slot = await prisma.bookingSlot.create({
      data: {
        bookingId: booking.id,
        courtId: court.id,
        slotDate: new Date('2026-06-20T00:00:00.000Z'),
        slotStartTime: new Date('1970-01-01T09:00:00.000Z'),
        slotEndTime: new Date('1970-01-01T10:00:00.000Z'),
        status: 'pending_payment',
        unitPrice: 500,
      },
    });

    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: 500,
        gateway: 'phonepe',
        merchantOrderId: `PP-ONTIME-${suffix}`,
        status: 'initiated',
      },
    });

    // Execute confirmProviderPayment (Case A: NOT expired)
    const result = await repository.confirmProviderPayment({
      paymentId: payment.id,
      bookingId: booking.id,
      payload: { mock: 'ontime' },
      now,
    });

    // Verify booking transitions to 'confirmed'
    assert.equal(result.booking.status, 'confirmed');
    assert.equal(result.payment.status, 'success');

    // Verify slots transition to 'confirmed'
    const updatedSlot = await prisma.bookingSlot.findUnique({ where: { id: slot.id } });
    assert.equal(updatedSlot.status, 'confirmed');
  });
});
