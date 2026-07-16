import {
  AppError,
  ConflictError,
  NotFoundError,
} from '../../utils/api-error.js';
import defaultLogger from '../../utils/logger.js';
import {
  DEFAULT_SWEEP_LIMIT,
  DEFAULT_VOUCHER_VALIDITY_DAYS,
  REWARD_ERROR_CODES,
  VOUCHER_CODE_ALPHABET,
  VOUCHER_CODE_PREFIX,
  VOUCHER_CODE_RANDOM_LENGTH,
} from './rewards.constants.js';

const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const isUniqueConflict = (error) => error?.code === 'P2002';

/**
 * Weighted random draw over `config.prizes`. Probabilities are validated to sum
 * to 1.0 at save time; any residual float drift falls through to the last prize
 * so the draw can never come up empty.
 */
export const drawPrize = (prizes, rng) => {
  const roll = rng();
  let cumulative = 0;
  for (const prize of prizes) {
    cumulative += prize.probability;
    if (roll < cumulative) return prize;
  }
  return prizes[prizes.length - 1];
};

const generateVoucherCode = (rng) => {
  let suffix = '';
  for (let i = 0; i < VOUCHER_CODE_RANDOM_LENGTH; i++) {
    suffix += VOUCHER_CODE_ALPHABET[Math.floor(rng() * VOUCHER_CODE_ALPHABET.length)];
  }
  return `${VOUCHER_CODE_PREFIX}${suffix}`;
};

const serializeOutcome = (outcome) => ({
  prize_id: outcome.prize_id,
  label: outcome.label,
  type: outcome.type,
  ...(outcome.terms ? { terms: outcome.terms } : {}),
});

const serializeVoucher = (instance) => (
  instance.voucherCode
    ? {
        voucher: {
          code: instance.voucherCode,
          valid_until: instance.voucherValidUntil,
          redeemed: Boolean(instance.redeemedAt),
          ...(instance.redeemedAt ? { redeemed_at: instance.redeemedAt } : {}),
        },
      }
    : {}
);

// The outcome is only serialized once revealed — a pending or expired instance
// never leaks its pre-computed prize (spec §12.3).
const serializeInstance = (instance) => ({
  id: instance.id,
  mechanism_type: instance.mechanismType,
  mechanism_name: instance.mechanism?.name,
  status: instance.status,
  booking_id: instance.bookingId,
  booking_slot_date: instance.booking?.slotDate ?? undefined,
  card_theme: instance.configSnapshot?.card_theme ?? null,
  expires_at: instance.expiresAt,
  created_at: instance.createdAt,
  ...(instance.status === 'revealed'
    ? {
        revealed_at: instance.revealedAt,
        outcome: serializeOutcome(instance.outcome),
        ...serializeVoucher(instance),
      }
    : {}),
});

const serializeModerationInstance = (instance) => ({
  ...serializeInstance(instance),
  // Moderation is a staff surface — the outcome is visible regardless of
  // status so prize distribution can be audited before reveal.
  outcome: serializeOutcome(instance.outcome),
  ...serializeVoucher(instance),
  ...(instance.redemptionNote ? { redemption_note: instance.redemptionNote } : {}),
  user: instance.user
    ? { id: instance.user.id, name: instance.user.name, phone: instance.user.phone }
    : undefined,
});

const serializeMechanism = (mechanism) => ({
  id: mechanism.id,
  venue_id: mechanism.venueId,
  name: mechanism.name,
  type: mechanism.type,
  trigger_event: mechanism.triggerEvent,
  config: mechanism.config,
  instance_expiry_days: mechanism.instanceExpiryDays,
  is_active: mechanism.isActive,
  valid_from: mechanism.validFrom,
  valid_until: mechanism.validUntil,
  created_at: mechanism.createdAt,
  updated_at: mechanism.updatedAt,
});

/**
 * Issuance runs inside the booking-confirmation transaction (spec §12.2): a
 * booking is never confirmed without its instances, and a rolled-back
 * confirmation never leaves orphaned instances. Duplicate trigger signals
 * (webhook redelivery, redirect + webhook races) are absorbed by the
 * UNIQUE (booking_id, mechanism_id) constraint.
 */
export const createRewardIssuanceService = ({
  repository,
  rng = Math.random,
  logger = defaultLogger,
} = {}) => {
  if (!repository) throw new Error('repository is required');

  return {
    async issueForBooking({ tx, booking, now }) {
      const mechanisms = await repository.findActiveMechanisms({
        tx,
        venueId: booking.venueId,
        triggerEvent: 'booking_confirmed',
        now,
      });

      const issued = [];
      for (const mechanism of mechanisms) {
        const prize = drawPrize(mechanism.config.prizes, rng);
        const outcome = {
          prize_id: prize.id,
          label: prize.label,
          type: prize.type,
          ...(prize.terms ? { terms: prize.terms } : {}),
          ...(prize.validity_days !== undefined ? { validity_days: prize.validity_days } : {}),
        };

        try {
          const instance = await repository.createInstance({
            tx,
            data: {
              mechanismId: mechanism.id,
              mechanismType: mechanism.type,
              userId: booking.userId,
              bookingId: booking.id,
              status: 'pending',
              configSnapshot: mechanism.config,
              outcome,
              prizeType: prize.type,
              expiresAt: addDays(now, mechanism.instanceExpiryDays),
            },
          });
          issued.push(instance);
        } catch (error) {
          if (isUniqueConflict(error)) {
            // Instance already exists for (booking, mechanism) — idempotent confirm.
            continue;
          }
          throw error;
        }
      }

      if (issued.length > 0) {
        logger.info('Reward instances issued', {
          operation: 'rewards:issue',
          bookingId: booking.id,
          count: issued.length,
        });
      }

      return issued;
    },
  };
};

export const createRewardsService = ({
  repository,
  authorizationService,
  rng = Math.random,
  clock = () => new Date(),
  logger = defaultLogger,
} = {}) => {
  if (!repository) throw new Error('repository is required');

  return {
    // ── Customer surface ────────────────────────────────────────────────

    async getUserInstances({ userId, status }) {
      const instances = await repository.getUserInstances({ userId, status });
      return instances.map(serializeInstance);
    },

    async getInstance({ userId, instanceId }) {
      const instance = await repository.getInstanceById({ instanceId });
      if (!instance || instance.userId !== userId) {
        throw new NotFoundError('Reward not found', { code: REWARD_ERROR_CODES.NOT_FOUND });
      }
      return serializeInstance(instance);
    },

    async revealInstance({ userId, instanceId }) {
      const now = clock();
      const instance = await repository.getInstanceById({ instanceId });

      // Non-owners get the same 404 as a missing id — never leak existence.
      if (!instance || instance.userId !== userId) {
        throw new NotFoundError('Reward not found', { code: REWARD_ERROR_CODES.NOT_FOUND });
      }
      if (instance.status === 'revealed') {
        throw new ConflictError('Reward has already been revealed', {
          code: REWARD_ERROR_CODES.ALREADY_REVEALED,
        });
      }
      if (instance.status === 'expired') {
        throw new AppError('Reward has expired', 410, { code: REWARD_ERROR_CODES.EXPIRED });
      }
      // Lazily expire a pending instance the sweeper has not reached yet.
      if (instance.expiresAt <= now) {
        await repository.expireInstance({ instanceId });
        throw new AppError('Reward has expired', 410, { code: REWARD_ERROR_CODES.EXPIRED });
      }

      // A voucher prize materializes at reveal: unique code + redemption window
      // (prize-specific validity_days, or the platform default).
      const buildVoucher = () => {
        if (instance.outcome.type !== 'voucher') return null;
        const validityDays = instance.outcome.validity_days ?? DEFAULT_VOUCHER_VALIDITY_DAYS;
        return {
          code: generateVoucherCode(rng),
          validUntil: addDays(now, validityDays),
          outcome: instance.outcome,
        };
      };

      // Retry only on voucher-code collisions (globally unique column).
      let result;
      for (let attempt = 0; ; attempt++) {
        try {
          result = await repository.revealInstance({ instanceId, now, voucher: buildVoucher() });
          break;
        } catch (error) {
          if (isUniqueConflict(error) && attempt < 4) continue;
          logger.error('Reward reveal failed', {
            operation: 'rewards:reveal:error',
            instanceId,
            error,
          });
          throw error;
        }
      }

      if (!result.claimed) {
        // A concurrent reveal won the status-guard race.
        throw new ConflictError('Reward has already been revealed', {
          code: REWARD_ERROR_CODES.ALREADY_REVEALED,
        });
      }

      logger.info('Reward revealed', {
        operation: 'rewards:reveal',
        instanceId,
        prizeType: result.instance.prizeType,
      });

      return {
        instance_id: result.instance.id,
        mechanism_type: result.instance.mechanismType,
        status: 'revealed',
        revealed_at: result.instance.revealedAt,
        outcome: serializeOutcome(result.instance.outcome),
        ...serializeVoucher(result.instance),
      };
    },

    // ── Voucher redemption (manage_bookings) ────────────────────────────

    async redeemVoucher({ userId, instanceId, note }) {
      const now = clock();
      const instance = await repository.getInstanceById({ instanceId });
      if (!instance) {
        throw new NotFoundError('Reward not found', { code: REWARD_ERROR_CODES.NOT_FOUND });
      }
      await this.assertModerationAccess({ userId, venueId: instance.mechanism.venueId });

      if (instance.status !== 'revealed' || instance.prizeType !== 'voucher' || !instance.voucherCode) {
        throw new ConflictError('Only revealed vouchers can be redeemed', {
          code: REWARD_ERROR_CODES.VOUCHER_NOT_REDEEMABLE,
        });
      }
      if (instance.redeemedAt) {
        throw new ConflictError('Voucher has already been redeemed', {
          code: REWARD_ERROR_CODES.VOUCHER_ALREADY_REDEEMED,
        });
      }
      if (instance.voucherValidUntil && instance.voucherValidUntil <= now) {
        throw new AppError('Voucher validity period has passed', 410, {
          code: REWARD_ERROR_CODES.VOUCHER_EXPIRED,
        });
      }

      const result = await repository.redeemVoucher({ instanceId, now, note });
      if (result.count === 0) {
        // A concurrent redemption won the redeemedAt-null guard.
        throw new ConflictError('Voucher has already been redeemed', {
          code: REWARD_ERROR_CODES.VOUCHER_ALREADY_REDEEMED,
        });
      }

      logger.info('Voucher redeemed', {
        operation: 'rewards:redeem',
        instanceId,
        voucherCode: instance.voucherCode,
      });

      return {
        instance_id: instanceId,
        voucher_code: instance.voucherCode,
        redeemed_at: now,
        ...(note ? { redemption_note: note } : {}),
      };
    },

    // ── Expiry sweeper (scheduler job) ──────────────────────────────────

    async sweepExpiredInstances({ limit = DEFAULT_SWEEP_LIMIT } = {}) {
      const now = clock();
      const result = await repository.sweepExpiredInstances({ now, limit });
      return { expired_count: result.count };
    },

    // ── Mechanism management (edit_pricing) ─────────────────────────────

    async getVenueMechanisms({ venueId }) {
      const mechanisms = await repository.getVenueMechanisms({ venueId });
      return mechanisms.map(serializeMechanism);
    },

    async createMechanism({ input }) {
      const venueOk = await repository.venueExists({ venueId: input.venue_id });
      if (!venueOk) {
        throw new NotFoundError('Venue not found');
      }

      const mechanism = await repository.createMechanism({
        data: {
          venueId: input.venue_id,
          name: input.name,
          type: input.type,
          triggerEvent: input.trigger_event,
          config: input.config,
          instanceExpiryDays: input.instance_expiry_days,
          isActive: input.is_active,
          validFrom: input.valid_from ?? null,
          validUntil: input.valid_until ?? null,
        },
      });
      return serializeMechanism(mechanism);
    },

    async updateMechanism({ userId, mechanismId, input }) {
      const mechanism = await repository.getMechanismById({ mechanismId });
      if (!mechanism) {
        throw new NotFoundError('Reward mechanism not found');
      }

      // Authorization resolved against the mechanism's own venue (the route
      // cannot know it) — mirrors the reviews moderation pattern. Unauthorized
      // callers receive 404 to avoid leaking mechanism existence.
      if (authorizationService) {
        const hasPerm = await authorizationService.hasPermission({
          userId,
          venueId: mechanism.venueId,
          permission: 'edit_pricing',
        });
        if (!hasPerm) {
          throw new NotFoundError('Reward mechanism not found');
        }
      }

      const updated = await repository.updateMechanism({
        mechanismId,
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.config !== undefined ? { config: input.config } : {}),
          ...(input.instance_expiry_days !== undefined
            ? { instanceExpiryDays: input.instance_expiry_days }
            : {}),
          ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
          ...(input.valid_from !== undefined ? { validFrom: input.valid_from } : {}),
          ...(input.valid_until !== undefined ? { validUntil: input.valid_until } : {}),
        },
      });
      return serializeMechanism(updated);
    },

    // ── Instance moderation (manage_bookings) ───────────────────────────

    async getModerationInstances({ venueId, status, mechanismId, voucherCode, redeemed, page = 1, limit = 20 }) {
      const { instances, total } = await repository.getModerationInstances({
        venueId,
        status,
        mechanismId,
        voucherCode,
        redeemed,
        page,
        limit,
      });
      return {
        data: instances.map(serializeModerationInstance),
        pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
      };
    },

    async expireInstanceManually({ userId, instanceId }) {
      const instance = await repository.getInstanceById({ instanceId });
      if (!instance) {
        throw new NotFoundError('Reward not found', { code: REWARD_ERROR_CODES.NOT_FOUND });
      }
      await this.assertModerationAccess({ userId, venueId: instance.mechanism.venueId });

      const result = await repository.expireInstance({ instanceId });
      if (result.count === 0) {
        throw new ConflictError('Only pending rewards can be expired', {
          code: instance.status === 'revealed'
            ? REWARD_ERROR_CODES.ALREADY_REVEALED
            : REWARD_ERROR_CODES.EXPIRED,
        });
      }
      return { instance_id: instanceId, status: 'expired' };
    },

    async assertModerationAccess({ userId, venueId }) {
      if (!authorizationService) return;
      const hasPerm = await authorizationService.hasPermission({
        userId,
        venueId,
        permission: 'manage_bookings',
      });
      if (!hasPerm) {
        throw new NotFoundError('Reward not found', { code: REWARD_ERROR_CODES.NOT_FOUND });
      }
    },
  };
};
