import { pathToFileURL } from 'url';
import createApp from './app.js';
import config from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { createShutdownManager } from './core/lifecycle.js';
import { createScheduler } from './core/scheduler.js';
import logger from './utils/logger.js';

// Module factories for the scheduler service graph.
import { createDefaultAuthService } from './modules/auth/index.js';
import { createDefaultBookingsService } from './modules/bookings/index.js';
import { createDefaultPaymentsService } from './modules/payments/index.js';
import { createDefaultVenuesService } from './modules/venues/index.js';
import { createDefaultRewardsService } from './modules/rewards/index.js';
import { createPaymentProviderFromEnv } from './modules/payments/provider-factory.js';

export const startServer = async () => {
  let shutdownManager;

  const handleFatalError = (type, error) => {
    logger.error(`Fatal ${type}`, { error });
    if (shutdownManager) {
      shutdownManager.shutdown(type);
    } else {
      process.exit(1);
    }
  };

  const handleSignal = (signal) => {
    logger.info(`Received ${signal}`);
    if (shutdownManager) {
      shutdownManager.shutdown(signal);
    } else {
      process.exit(0);
    }
  };

  process.once('uncaughtException', (error) => handleFatalError('uncaughtException', error));
  process.once('unhandledRejection', (reason) => handleFatalError('unhandledRejection', reason));
  process.once('SIGTERM', () => handleSignal('SIGTERM'));
  process.once('SIGINT', () => handleSignal('SIGINT'));

  await connectDatabase(config);

  const app = createApp();
  const server = app.listen(config.app.port, config.app.host);

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address();
  logger.info('HTTP server started', {
    service: config.app.name,
    env: config.env,
    host: typeof address === 'object' ? address.address : config.app.host,
    port: typeof address === 'object' ? address.port : config.app.port,
    apiPrefix: config.app.apiPrefix,
  });

  // ── Background Scheduler ──────────────────────────────────────────────
  // Isolated service graph — independent from the HTTP router's graph.
  // The Prisma client is a process-wide singleton, so the connection pool
  // is shared. Services are stateless factories, so duplication is safe.
  const venueService = createDefaultVenuesService();
  const authService = createDefaultAuthService({ config });
  const paymentProvider = createPaymentProviderFromEnv(config);
  const bookingsService = createDefaultBookingsService({ config, venueService, paymentProvider });
  const rewardsService = createDefaultRewardsService();
  const { reconciliationService } = createDefaultPaymentsService({
    bookingsService,
    config,
    authService,
    paymentProvider,
  });

  const scheduler = createScheduler({
    jobs: [
      { name: 'purge-expired-records', execute: () => authService.purgeExpiredRecords() },
      { name: 'expire-pending-holds', execute: () => bookingsService.expirePendingHolds() },
      { name: 'sweep-completed-bookings', execute: () => bookingsService.sweepCompletedBookings() },
      { name: 'sweep-expired-reward-instances', execute: () => rewardsService.sweepExpiredInstances() },
      { name: 'reconcile-stale-payments', execute: () => reconciliationService.reconcileStalePayments() },
    ],
    intervalMs: config.scheduler.intervalMs,
    disabled: config.isTest || config.scheduler.disabled,
    logger,
  });

  scheduler.start();

  shutdownManager = createShutdownManager({
    server,
    config,
    cleanup: [() => scheduler.stop(), disconnectDatabase],
  });

  return { app, server, shutdownManager, scheduler };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error) => {
    logger.error('Failed to start server', { error });
    process.exit(1);
  });
}

