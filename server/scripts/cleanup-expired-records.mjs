import { getPrisma } from '../src/lib/prisma.js';

const prisma = getPrisma();
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
} catch (error) {
  console.error("Error running database cleanup:", error);
  process.exit(1);
} finally {
  process.exit(0);
}
