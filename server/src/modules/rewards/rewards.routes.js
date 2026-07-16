import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.middleware.js';
import { requireOnboarding } from '../../middleware/require-onboarding.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createRewardsController } from './rewards.controller.js';
import {
  createMechanismSchema,
  instanceIdParamsSchema,
  listMechanismsQuerySchema,
  mechanismIdParamsSchema,
  moderationInstancesQuerySchema,
  myInstancesQuerySchema,
  redeemVoucherSchema,
  updateMechanismSchema,
} from './rewards.validators.js';

// All reward routes are owned by the rewards module and mounted under /rewards
// (ADR-010) — customer self-service, mechanism management, and moderation share
// the prefix with per-route authorization, mirroring the reviews module.
export const createRewardsRouter = ({
  rewardsService,
  requireVenuePermission,
  authMiddleware = authenticate(),
  onboardingMiddleware = requireOnboarding(),
} = {}) => {
  if (!rewardsService) {
    throw new Error('rewardsService is required');
  }
  if (!requireVenuePermission) {
    throw new Error('requireVenuePermission is required');
  }

  const router = Router();
  const controller = createRewardsController({ rewardsService });

  // ── Mechanism management (edit_pricing) ───────────────────────────────

  // GET /rewards/mechanisms?venue_id= - List a venue's mechanisms (active + inactive)
  router.get(
    '/mechanisms',
    authMiddleware,
    requireVenuePermission({
      permission: 'edit_pricing',
      venueResolver: (req) => req.query.venue_id,
    }),
    validate(listMechanismsQuerySchema, 'query'),
    controller.getVenueMechanisms
  );

  // POST /rewards/mechanisms - Create a mechanism for a venue
  router.post(
    '/mechanisms',
    authMiddleware,
    requireVenuePermission({
      permission: 'edit_pricing',
      venueResolver: (req) => req.body.venue_id,
    }),
    validate(createMechanismSchema),
    controller.createMechanism
  );

  // PATCH /rewards/mechanisms/:mechanismId - Edit config/state/validity
  router.patch(
    '/mechanisms/:mechanismId',
    authMiddleware,
    // Permission check handled in the service layer (needs the mechanism's venueId)
    validate(mechanismIdParamsSchema, 'params'),
    validate(updateMechanismSchema),
    controller.updateMechanism
  );

  // ── Instance moderation (manage_bookings) ─────────────────────────────

  // GET /rewards/instances/moderation?venue_id= - List venue instances with filters
  router.get(
    '/instances/moderation',
    authMiddleware,
    requireVenuePermission({
      permission: 'manage_bookings',
      venueResolver: (req) => req.query.venue_id,
    }),
    validate(moderationInstancesQuerySchema, 'query'),
    controller.getModerationInstances
  );

  // PATCH /rewards/instances/:instanceId/expire - Manually expire a pending instance
  router.patch(
    '/instances/:instanceId/expire',
    authMiddleware,
    // Permission check handled in the service layer (needs the instance's venueId)
    validate(instanceIdParamsSchema, 'params'),
    controller.expireInstance
  );

  // PATCH /rewards/instances/:instanceId/redeem - Staff marks a voucher redeemed at the stall
  router.patch(
    '/instances/:instanceId/redeem',
    authMiddleware,
    validate(instanceIdParamsSchema, 'params'),
    validate(redeemVoucherSchema),
    controller.redeemVoucher
  );

  // ── Customer self-service ──────────────────────────────────────────────

  // GET /rewards/instances - The authenticated user's reward instances
  router.get(
    '/instances',
    authMiddleware,
    onboardingMiddleware,
    validate(myInstancesQuerySchema, 'query'),
    controller.getMyInstances
  );

  // GET /rewards/instances/:instanceId - A single owned instance (outcome hidden while pending)
  router.get(
    '/instances/:instanceId',
    authMiddleware,
    onboardingMiddleware,
    validate(instanceIdParamsSchema, 'params'),
    controller.getInstance
  );

  // POST /rewards/instances/:instanceId/reveal - Reveal + fulfill atomically
  router.post(
    '/instances/:instanceId/reveal',
    authMiddleware,
    onboardingMiddleware,
    validate(instanceIdParamsSchema, 'params'),
    controller.revealInstance
  );

  return router;
};
