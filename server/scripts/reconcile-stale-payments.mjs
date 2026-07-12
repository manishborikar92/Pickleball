#!/usr/bin/env node

/**
 * Missing Webhook Recovery Job.
 *
 * Finds payments stuck in 'initiated' status beyond 15 minutes,
 * checks their status with PhonePe Order Status API, and processes
 * COMPLETED/FAILED results through the standard booking service flow.
 *
 * Designed to run every 5 minutes via external scheduler (cron, systemd timer, etc.)
 * or automatically via the in-process scheduler.
 *
 * Usage:
 *   node server/scripts/reconcile-stale-payments.mjs
 *
 * @see docs/integrations/02-PAYMENT-INTEGRATION.md §9.3
 */

import { buildConfig } from '../src/config/env.js';
import { disconnectPrisma } from '../src/lib/prisma.js';
import logger from '../src/utils/logger.js';

import { createDefaultVenuesService } from '../src/modules/venues/index.js';
import { createDefaultAuthService } from '../src/modules/auth/index.js';
import { createDefaultBookingsService } from '../src/modules/bookings/index.js';
import { createDefaultPaymentsService } from '../src/modules/payments/index.js';
import { createPaymentProviderFromEnv } from '../src/modules/payments/provider-factory.js';

async function main() {
  const config = buildConfig();
  const paymentProvider = createPaymentProviderFromEnv(config);

  const venueService = createDefaultVenuesService();
  const authService = createDefaultAuthService({ config });
  const bookingsService = createDefaultBookingsService({ config, venueService, paymentProvider });

  const { reconciliationService } = createDefaultPaymentsService({
    bookingsService,
    config,
    authService,
    paymentProvider,
  });

  try {
    const result = await reconciliationService.reconcileStalePayments();

    logger.info('[Reconciliation Job] Complete', {
      operation: 'reconciliation:complete',
      ...result,
    });
  } finally {
    await disconnectPrisma();
  }
}

main().catch((error) => {
  logger.error('[Reconciliation Job] Fatal error', { error });
  process.exit(1);
});
