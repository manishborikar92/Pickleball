#!/usr/bin/env node

/**
 * Missing Webhook Recovery Job.
 *
 * Finds payments stuck in 'initiated' status beyond 15 minutes,
 * checks their status with PhonePe Order Status API, and processes
 * COMPLETED/FAILED results through the standard booking service flow.
 *
 * Designed to run every 5 minutes via external scheduler (cron, systemd timer, etc.).
 *
 * Usage:
 *   node server/scripts/reconcile-stale-payments.mjs
 *
 * @see docs/integrations/02-PAYMENT-INTEGRATION.md §9.3
 */

import { buildConfig } from '../src/config/env.js';
import { getPrisma, disconnectPrisma } from '../src/lib/prisma.js';
import { createPaymentProviderFromEnv } from '../src/modules/payments/provider-factory.js';
import logger from '../src/utils/logger.js';

import { createDefaultVenuesService } from '../src/modules/venues/index.js';
import { createDefaultAuthService } from '../src/modules/auth/index.js';
import { createDefaultBookingsService } from '../src/modules/bookings/index.js';
import { createDefaultPaymentsService } from '../src/modules/payments/index.js';

const STALE_THRESHOLD_MINUTES = 15;

async function reconcileStalePayments() {
  const config = buildConfig();
  const prisma = getPrisma();
  const paymentProvider = createPaymentProviderFromEnv(config);

  const venueService = createDefaultVenuesService();
  const authorizationService = createDefaultAuthService({ config });
  const bookingsService = createDefaultBookingsService({ config, venueService, paymentProvider });

  const { reconciliationService } = createDefaultPaymentsService({
    bookingsService,
    config,
    authService: authorizationService,
    paymentProvider,
  });

  // Assign reconciliation callback to bookingsService to handle late payments properly
  bookingsService.onLatePayment = async ({ paymentId, bookingId, amount }) => {
    await reconciliationService.reconcileLatePayment({ paymentId, bookingId, amount });
  };

  try {
    const cutoff = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);

    const stalePayments = await prisma.payment.findMany({
      where: {
        status: 'initiated',
        createdAt: { lt: cutoff },
      },
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            userId: true,
          },
        },
      },
      take: 50, // Process in batches to avoid overloading the API.
    });

    logger.info(`[Reconciliation Job] Found ${stalePayments.length} stale payments`, {
      operation: 'reconciliation:scan',
      count: stalePayments.length,
      cutoff: cutoff.toISOString(),
    });

    let completed = 0;
    let failed = 0;
    let pending = 0;
    let errors = 0;

    for (const payment of stalePayments) {
      try {
        const state = await paymentProvider.getPaymentStatus({ payment });

        logger.info(`[Reconciliation Job] Payment ${payment.merchantOrderId}: ${state}`, {
          operation: 'reconciliation:check',
          merchantOrderId: payment.merchantOrderId,
          state,
        });

        if (state === 'COMPLETED' || state === 'FAILED') {
          await bookingsService.handleProviderPaymentEvent({
            merchantOrderId: payment.merchantOrderId,
            state,
            payload: {
              provider: payment.gateway,
              state,
              source: 'reconciliation_job',
            },
          });

          if (state === 'COMPLETED') {
            completed++;
          } else {
            failed++;
          }
        } else {
          // PENDING or CREATED — leave for next cycle.
          pending++;
        }
      } catch (error) {
        errors++;
        logger.error(`[Reconciliation Job] Error processing payment ${payment.merchantOrderId}`, {
          operation: 'reconciliation:error',
          merchantOrderId: payment.merchantOrderId,
          error,
        });
      }
    }

    logger.info('[Reconciliation Job] Complete', {
      operation: 'reconciliation:complete',
      completed,
      failed,
      pending,
      errors,
      total: stalePayments.length,
    });
  } finally {
    await disconnectPrisma();
  }
}

reconcileStalePayments().catch((error) => {
  logger.error('[Reconciliation Job] Fatal error', { error });
  process.exit(1);
});
