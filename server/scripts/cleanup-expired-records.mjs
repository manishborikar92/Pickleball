/* eslint-disable no-console */
import { buildConfig } from '../src/config/env.js';
import { disconnectPrisma } from '../src/lib/prisma.js';
import { createDefaultAuthService } from '../src/modules/auth/index.js';
import { createDefaultBookingsService } from '../src/modules/bookings/index.js';
import { createDefaultVenuesService } from '../src/modules/venues/index.js';

const config = buildConfig();
const venueService = createDefaultVenuesService();
const authService = createDefaultAuthService({ config });
const bookingsService = createDefaultBookingsService({ venueService });

try {
  // Purge expired OTPs, revoked sessions, and revoked refresh tokens.
  const purgeResult = await authService.purgeExpiredRecords();
  console.log(`Deleted ${purgeResult.deletedOtps} expired OTP requests.`);
  console.log(`Deleted ${purgeResult.deletedSessions} revoked sessions.`);
  console.log(`Deleted ${purgeResult.deletedTokens} revoked refresh tokens.`);

  // Expire pending booking holds (higher limit for manual backfill).
  const expiredBookings = await bookingsService.expirePendingHolds({
    limit: 500,
    requestContext: { requestId: 'cleanup-expired-records' },
  });
  console.log(`Expired ${expiredBookings.expired_count} pending booking holds.`);
  console.log(`Rolled back ${expiredBookings.wallet_credits_rolled_back} wallet credits from expired holds.`);

  // Sweep completed bookings.
  const sweepLimit = parseInt(process.env.COMPLETION_SWEEP_LIMIT || '100', 10);
  const sweptBookings = await bookingsService.sweepCompletedBookings({
    limit: sweepLimit,
  });
  console.log(`Swept ${sweptBookings.swept_count} bookings to completed status (updated ${sweptBookings.updated_count} records).`);
} catch (error) {
  console.error("Error running database cleanup:", error);
  process.exit(1);
} finally {
  await disconnectPrisma();
  process.exit(0);
}
