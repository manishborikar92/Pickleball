/* eslint-disable no-console */
import 'dotenv/config';
import { getPrisma } from '../src/lib/prisma.js';
import { createPasswordHash, normalizeIndianPhone } from '../src/modules/auth/auth.utils.js';

const prisma = getPrisma();

const permissions = [
  ['manage_courts', 'Create, update, and retire courts'],
  ['edit_pricing', 'Manage base prices, pricing rules, and coupons'],
  ['edit_schedule', 'Manage schedules and exceptions'],
  ['manage_bookings', 'View and manage venue bookings'],
  ['issue_credits', 'Issue wallet credits'],
  ['walk_in_entry', 'Create walk-in and admin-block bookings'],
  ['view_own_bookings', 'View own bookings and wallet'],
  ['manage_venues', 'Manage venue-level settings'],
];

const rolePermissions = {
  super_admin: permissions.map(([key]) => key),
  manager: ['edit_pricing', 'edit_schedule', 'manage_bookings', 'issue_credits', 'walk_in_entry', 'view_own_bookings'],
  staff: ['manage_bookings', 'walk_in_entry', 'view_own_bookings'],
  customer: ['view_own_bookings'],
};

const time = (value) => new Date(`1970-01-01T${value}.000Z`);

async function upsertCourt({ venueId, name, displayOrder, amount }) {
  const existing = await prisma.court.findFirst({ where: { venueId, name } });
  const court = existing
    ? await prisma.court.update({
      where: { id: existing.id },
      data: {
        surfaceType: 'Pro Cushion',
        environment: 'outdoor',
        status: 'active',
        displayOrder,
      },
    })
    : await prisma.court.create({
      data: {
        venueId,
        name,
        surfaceType: 'Pro Cushion',
        environment: 'outdoor',
        status: 'active',
        displayOrder,
      },
    });

  await prisma.basePrice.upsert({
    where: { courtId: court.id },
    update: { amount },
    create: { courtId: court.id, amount },
  });

  return court;
}

async function seedRolesAndPermissions() {
  const permissionRecords = new Map();
  for (const [key, description] of permissions) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
    permissionRecords.set(key, permission);
  }

  for (const [roleName, permissionKeys] of Object.entries(rolePermissions)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: { description: `${roleName.replaceAll('_', ' ')} role` },
      create: { name: roleName, description: `${roleName.replaceAll('_', ' ')} role` },
    });

    for (const key of permissionKeys) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permissionRecords.get(key).id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permissionRecords.get(key).id,
        },
      });
    }
  }
}

async function seedVenue() {
  const venue = await prisma.venue.upsert({
    where: { slug: 'besa-nagpur' },
    update: {
      name: 'Besa, Nagpur',
      address: 'Baseline Arena, Plot No. 78, Sanskriti Society, Behind Puma Outlet, Besa-Manish Nagar Road, Nagpur',
      city: 'Nagpur',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      rolloverTime: time('08:00:00'),
      advanceBookingDays: 7,
      phone: '+919970409410',
      secondaryPhone: '+919096030362',
      email: 'support@baselinearena.in',
      isActive: true,
    },
    create: {
      slug: 'besa-nagpur',
      name: 'Besa, Nagpur',
      address: 'Baseline Arena, Plot No. 78, Sanskriti Society, Behind Puma Outlet, Besa-Manish Nagar Road, Nagpur',
      city: 'Nagpur',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      rolloverTime: time('08:00:00'),
      advanceBookingDays: 7,
      phone: '+919970409410',
      secondaryPhone: '+919096030362',
      email: 'support@baselinearena.in',
    },
  });

  const courts = [
    await upsertCourt({ venueId: venue.id, name: 'Court 1', displayOrder: 1, amount: 500 }),
    await upsertCourt({ venueId: venue.id, name: 'Court 2', displayOrder: 2, amount: 550 }),
  ];

  await prisma.schedule.deleteMany({ where: { venueId: venue.id } });
  for (const court of courts) {
    await prisma.schedule.create({
      data: {
        venueId: venue.id,
        courtId: court.id,
        dayOfWeek: [0, 1, 2, 3, 4, 5, 6],
        openTime: time('07:00:00'),
        closeTime: time('23:59:00'),
        slotDurationMins: 60,
        isActive: true,
      },
    });
  }

  return venue;
}

async function seedAdmin(venue) {
  const args = process.argv.slice(2);
  const getArg = (flag, defaultValue) => {
    const index = args.indexOf(flag);
    if (index !== -1 && args[index + 1]) {
      return args[index + 1];
    }
    return defaultValue;
  };

  const email = getArg('--email', 'admin@baselinearena.in').trim().toLowerCase();
  const password = getArg('--password', 'SecurePass123!');
  const name = getArg('--name', 'Platform Admin');
  const rawPhone = getArg('--phone', '+919970409410');
  const phone = normalizeIndianPhone(rawPhone) || null;

  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'super_admin' } });
  const existingCredential = await prisma.adminCredential.findUnique({ where: { email } });
  const user = existingCredential
    ? await prisma.user.update({
      where: { id: existingCredential.userId },
      data: {
        name,
        phone,
        isPhoneVerified: Boolean(phone),
        onboardingCompletedAt: new Date(),
      },
    })
    : await prisma.user.create({
      data: {
        name,
        phone,
        isPhoneVerified: Boolean(phone),
        onboardingCompletedAt: new Date(),
      },
    });

  await prisma.adminCredential.upsert({
    where: { email },
    update: {
      passwordHash: await createPasswordHash(password),
      status: 'active',
      forcePasswordChange: false,
    },
    create: {
      userId: user.id,
      email,
      passwordHash: await createPasswordHash(password),
      status: 'active',
      forcePasswordChange: false,
    },
  });

  await prisma.venueUserRole.upsert({
    where: {
      userId_venueId: {
        userId: user.id,
        venueId: venue.id,
      },
    },
    update: { roleId: role.id },
    create: {
      userId: user.id,
      venueId: venue.id,
      roleId: role.id,
    },
  });

  console.log(`Seeded admin user: ${email}`);
}

async function seedRewardMechanism(venue) {
  // Post-booking scratch card, seeded ACTIVE so the reward flow works
  // end-to-end out of the box. Admins can pause or edit it (prize pool,
  // expiry, validity window) from /admin/rewards.
  const existing = await prisma.rewardMechanism.findFirst({
    where: { venueId: venue.id, type: 'scratch_card', deletedAt: null },
  });

  const config = {
    card_theme: 'court_green',
    prizes: [
      { id: 'p1', label: 'Better luck next time!', type: 'no_prize', probability: 0.7 },
      { id: 'p2', label: 'Free Iced Coffee at the Baseline Café', type: 'voucher', terms: 'Show this voucher at the café counter. One per visit.', validity_days: 14, probability: 0.2 },
      { id: 'p3', label: '20% Off Any Snack Combo', type: 'voucher', terms: 'Valid on snack combos at the venue stall.', validity_days: 30, probability: 0.1 },
    ],
  };

  if (existing) {
    await prisma.rewardMechanism.update({
      where: { id: existing.id },
      data: { config, isActive: true },
    });
  } else {
    await prisma.rewardMechanism.create({
      data: {
        venueId: venue.id,
        name: 'Post-Booking Scratch Card',
        type: 'scratch_card',
        triggerEvent: 'booking_confirmed',
        config,
        instanceExpiryDays: 7,
        isActive: true,
      },
    });
  }

  console.log('Seeded reward mechanism: Post-Booking Scratch Card (active)');
}

async function seedNotificationSettings(venue) {
  // Notification toggles default OFF — an admin opts in at /admin/settings.
  // Delivery is additionally inert until Meta WhatsApp is configured
  // (NOTIFICATIONS_TRANSPORT_MODE=live) — see docs/adrs/ADR-011.
  await prisma.notificationSetting.upsert({
    where: { venueId: venue.id },
    update: {},
    create: {
      venueId: venue.id,
      remindersEnabled: false,
      reviewRequestsEnabled: false,
    },
  });

  console.log('Seeded notification settings (reminders + review requests off)');
}

try {
  await seedRolesAndPermissions();
  const venue = await seedVenue();
  await seedAdmin(venue);
  await seedRewardMechanism(venue);
  await seedNotificationSettings(venue);
} finally {
  await prisma.$disconnect();
}
