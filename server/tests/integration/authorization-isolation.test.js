import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import createApp from '../../src/app.js';
import { getPrisma } from '../../src/lib/prisma.js';
import { Permissions } from '../../src/shared/auth-constants.js';

test('Multi-tenant isolation: user with permission in Venue A cannot refund payments of Venue B', async () => {
  const prisma = getPrisma();
  
  const rand1 = Math.floor(10000000 + Math.random() * 90000000);
  const rand2 = Math.floor(10000000 + Math.random() * 90000000);
  const staffPhone = `+919${rand1}`;
  const customerPhone = `+919${rand2}`;

  // 1. Create two test venues
  const venueA = await prisma.venue.create({
    data: {
      name: 'Test Venue A',
      slug: 'test-venue-a-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      address: 'Address A',
      city: 'City A',
      timezone: 'Asia/Kolkata',
      rolloverTime: new Date('1970-01-01T08:00:00.000Z'),
    },
  });

  const venueB = await prisma.venue.create({
    data: {
      name: 'Test Venue B',
      slug: 'test-venue-b-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      address: 'Address B',
      city: 'City B',
      timezone: 'Asia/Kolkata',
      rolloverTime: new Date('1970-01-01T08:00:00.000Z'),
    },
  });

  // 2. Create roles and permissions
  const permission = await prisma.permission.upsert({
    where: { key: Permissions.ISSUE_CREDITS },
    update: {},
    create: {
      key: Permissions.ISSUE_CREDITS,
      description: 'Issue wallet credits',
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: 'manager' },
    update: {},
    create: {
      name: 'manager',
      description: 'Manager role',
    },
  });

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: managerRole.id,
        permissionId: permission.id,
      },
    },
    update: {},
    create: {
      roleId: managerRole.id,
      permissionId: permission.id,
    },
  });

  // 3. Create users: staff user and customer user
  const staffUser = await prisma.user.create({
    data: {
      name: 'Venue A Manager',
      phone: staffPhone,
      isPhoneVerified: true,
      onboardingCompletedAt: new Date(),
    },
  });

  const customerUser = await prisma.user.create({
    data: {
      name: 'Customer User',
      phone: customerPhone,
      isPhoneVerified: true,
      onboardingCompletedAt: new Date(),
    },
  });

  let venueUserRole;
  let courtB;
  let bookingB;
  let paymentB;
  let session;

  try {
    // 4. Map staff user as a manager at Venue A (but NOT Venue B)
    venueUserRole = await prisma.venueUserRole.create({
      data: {
        userId: staffUser.id,
        venueId: venueA.id,
        roleId: managerRole.id,
      },
    });

    // 5. Create Court at Venue B, Booking at Venue B, and Payment at Venue B
    courtB = await prisma.court.create({
      data: {
        venueId: venueB.id,
        name: 'Court B1',
        environment: 'indoor',
        status: 'active',
      },
    });

    bookingB = await prisma.booking.create({
      data: {
        venueId: venueB.id,
        userId: customerUser.id,
        slotDate: new Date('2026-06-20T00:00:00.000Z'),
        sessionStartTime: new Date('1970-01-01T09:00:00.000Z'),
        sessionEndTime: new Date('1970-01-01T10:00:00.000Z'),
        sessionDurationMins: 60,
        courtCount: 1,
        slotUnitCount: 1,
        status: 'confirmed',
        baseAmount: 500,
        totalAmount: 500,
      },
    });

    paymentB = await prisma.payment.create({
      data: {
        bookingId: bookingB.id,
        amount: 500,
        status: 'success',
        gateway: 'sandbox',
        merchantOrderId: 'TEST-ORDER-B-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      },
    });

    // 6. Set up real App with secret override
    const secret = 'test-access-secret-with-at-least-32-characters';
    
    // Create an active DB session for the staff user to pass DB session validation
    session = await prisma.authSession.create({
      data: {
        userId: staffUser.id,
        status: 'active',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      },
    });

    const token = jwt.sign(
      { sub: staffUser.id, sid: session.id },
      secret,
      { expiresIn: '5m', issuer: 'baseline-api', audience: 'baseline-web' },
    );

    const app = createApp({
      configOverrides: {
        auth: { accessTokenSecret: secret },
        database: { enabled: true },
      },
    });

    // 7. Attempt to refund Payment B (Venue B) using Venue A staff token
    const response = await request(app)
      .post(`/api/v1/payments/${paymentB.id}/refund`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 500 });

    // 8. Assert that it is rejected with 403 Forbidden because User is only manager at Venue A
    assert.equal(response.status, 403);
    assert.equal(response.body.success, false);
    assert.match(response.body.message, /Missing required permissions/i);
  } finally {
    // 9. Cleanup database records
    if (paymentB) {
      await prisma.payment.delete({ where: { id: paymentB.id } }).catch(() => {});
    }
    if (bookingB) {
      await prisma.booking.delete({ where: { id: bookingB.id } }).catch(() => {});
    }
    if (courtB) {
      await prisma.court.delete({ where: { id: courtB.id } }).catch(() => {});
    }
    if (venueUserRole) {
      await prisma.venueUserRole.delete({
        where: {
          userId_venueId: {
            userId: staffUser.id,
            venueId: venueA.id,
          },
        },
      }).catch(() => {});
    }
    if (session) {
      await prisma.authSession.delete({ where: { id: session.id } }).catch(() => {});
    }
    await prisma.user.deleteMany({
      where: {
        id: { in: [staffUser.id, customerUser.id] },
      },
    }).catch(() => {});
    await prisma.venue.deleteMany({
      where: {
        id: { in: [venueA.id, venueB.id] },
      },
    }).catch(() => {});
  }
});
