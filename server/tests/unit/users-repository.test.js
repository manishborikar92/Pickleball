import assert from 'node:assert/strict';
import test from 'node:test';
import { getPrisma } from '../../src/lib/prisma.js';
import { createUsersRepository } from '../../src/modules/users/users.repository.js';

test('UsersRepository - getMyBookings multi-court serialization regression tests', async (t) => {
  const prisma = getPrisma();
  const repository = createUsersRepository({ prisma });

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const phone = `+91999999${Math.floor(1000 + Math.random() * 9000)}`;

  // Create prerequisite User
  const user = await prisma.user.create({
    data: {
      name: 'Multi-Court Repo User',
      phone,
      isPhoneVerified: true,
    },
  });

  // Create prerequisite Venue
  const venue = await prisma.venue.create({
    data: {
      name: 'Multi-Court Venue',
      slug: `multi-court-venue-${suffix}`,
      address: '123 Test St',
      city: 'Test City',
      timezone: 'Asia/Kolkata',
      rolloverTime: new Date('1970-01-01T08:00:00.000Z'),
    },
  });

  // Create two courts
  const court1 = await prisma.court.create({
    data: {
      venueId: venue.id,
      name: 'Court A',
      environment: 'outdoor',
      status: 'active',
    },
  });

  const court2 = await prisma.court.create({
    data: {
      venueId: venue.id,
      name: 'Court B',
      environment: 'outdoor',
      status: 'active',
    },
  });

  t.after(async () => {
    // Cleanup in reverse order of creation
    await prisma.bookingSlot.deleteMany({ where: { courtId: { in: [court1.id, court2.id] } } }).catch(() => {});
    await prisma.booking.deleteMany({ where: { userId: user.id } }).catch(() => {});
    await prisma.court.deleteMany({ where: { id: { in: [court1.id, court2.id] } } }).catch(() => {});
    await prisma.venue.delete({ where: { id: venue.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  });

  await t.test('Verify getMyBookings serializes multiple court names deterministically and exactly once', async () => {
    // Create a booking with 3 slots spanning 2 courts (2 slots on Court B, 1 slot on Court A)
    const booking = await prisma.booking.create({
      data: {
        venueId: venue.id,
        userId: user.id,
        slotDate: new Date('2026-06-25T00:00:00.000Z'),
        sessionStartTime: new Date('1970-01-01T09:00:00.000Z'),
        sessionEndTime: new Date('1970-01-01T10:00:00.000Z'),
        sessionDurationMins: 60,
        courtCount: 2,
        slotUnitCount: 3,
        status: 'confirmed',
        baseAmount: 1500,
        totalAmount: 1500,
        waiverAccepted: true,
      },
    });

    // Slot 1: Court B (9:00 - 9:30)
    await prisma.bookingSlot.create({
      data: {
        bookingId: booking.id,
        courtId: court2.id,
        slotDate: new Date('2026-06-25T00:00:00.000Z'),
        slotStartTime: new Date('1970-01-01T09:00:00.000Z'),
        slotEndTime: new Date('1970-01-01T09:30:00.000Z'),
        status: 'confirmed',
        unitPrice: 500,
      },
    });

    // Slot 2: Court B (9:30 - 10:00)
    await prisma.bookingSlot.create({
      data: {
        bookingId: booking.id,
        courtId: court2.id,
        slotDate: new Date('2026-06-25T00:00:00.000Z'),
        slotStartTime: new Date('1970-01-01T09:30:00.000Z'),
        slotEndTime: new Date('1970-01-01T10:00:00.000Z'),
        status: 'confirmed',
        unitPrice: 500,
      },
    });

    // Slot 3: Court A (9:00 - 9:30)
    await prisma.bookingSlot.create({
      data: {
        bookingId: booking.id,
        courtId: court1.id,
        slotDate: new Date('2026-06-25T00:00:00.000Z'),
        slotStartTime: new Date('1970-01-01T09:00:00.000Z'),
        slotEndTime: new Date('1970-01-01T09:30:00.000Z'),
        status: 'confirmed',
        unitPrice: 500,
      },
    });

    const result = await repository.getMyBookings({ userId: user.id });
    assert.equal(result.data.length, 1);
    
    const serialized = result.data[0];
    
    // Verify court_names array exists
    assert.ok(serialized.court_names);
    
    // Verify it contains exactly 2 items (Court A and Court B)
    assert.equal(serialized.court_names.length, 2);
    
    // Verify both unique courts are present exactly once and sorted alphabetically
    assert.equal(serialized.court_names[0], 'Court A');
    assert.equal(serialized.court_names[1], 'Court B');
  });
});
