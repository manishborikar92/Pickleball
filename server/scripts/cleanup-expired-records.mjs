/* eslint-disable no-console */
import { getPrisma } from '../src/lib/prisma.js';
import { createDefaultBookingsService } from '../src/modules/bookings/index.js';
import { createDefaultVenuesService } from '../src/modules/venues/index.js';

const prisma = getPrisma();
const venueService = createDefaultVenuesService();
const bookingsService = createDefaultBookingsService({ venueService });
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

try {
  // Purge expired OTPs
  const deletedOtps = await prisma.otpRequest.deleteMany({
    where: { expiresAt: { lt: oneDayAgo } }
  });
  console.log(`Deleted ${deletedOtps.count} expired OTP requests.`);

  // Purge old revoked sessions
  const deletedSessions = await prisma.authSession.deleteMany({
    where: { status: 'revoked', revokedAt: { lt: thirtyDaysAgo } }
  });
  console.log(`Deleted ${deletedSessions.count} revoked sessions.`);

  // Purge old revoked refresh tokens
  const deletedTokens = await prisma.refreshToken.deleteMany({
    where: { revokedAt: { not: null, lt: thirtyDaysAgo } }
  });
  console.log(`Deleted ${deletedTokens.count} revoked refresh tokens.`);

  const expiredBookings = await bookingsService.expirePendingHolds({
    limit: 500,
    requestContext: { requestId: 'cleanup-expired-records' },
  });
  console.log(`Expired ${expiredBookings.expired_count} pending booking holds.`);
  console.log(`Rolled back ${expiredBookings.wallet_credits_rolled_back} wallet credits from expired holds.`);
} catch (error) {
  console.error("Error running database cleanup:", error);
  process.exit(1);
} finally {
  process.exit(0);
}
