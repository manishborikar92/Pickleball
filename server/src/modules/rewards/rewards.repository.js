import { getPrisma } from '../../lib/prisma.js';

export const createRewardsRepository = ({ prisma } = {}) => {
  const db = () => prisma || getPrisma();

  return {
    // ── Issuance (runs inside the booking-confirmation transaction) ──────

    async findActiveMechanisms({ tx, venueId, triggerEvent, now }) {
      return (tx || db()).rewardMechanism.findMany({
        where: {
          venueId,
          triggerEvent,
          isActive: true,
          deletedAt: null,
          OR: [{ validFrom: null }, { validFrom: { lte: now } }],
          AND: [{ OR: [{ validUntil: null }, { validUntil: { gt: now } }] }],
        },
      });
    },

    async createInstance({ tx, data }) {
      return (tx || db()).rewardInstance.create({ data });
    },

    // ── Customer reads ────────────────────────────────────────────────────

    async getUserInstances({ userId, status }) {
      return db().rewardInstance.findMany({
        where: { userId, ...(status ? { status } : {}) },
        include: {
          mechanism: { select: { name: true } },
          booking: { select: { id: true, slotDate: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    },

    async getInstanceById({ instanceId }) {
      return db().rewardInstance.findUnique({
        where: { id: instanceId },
        include: {
          mechanism: { select: { name: true, venueId: true } },
          booking: { select: { id: true, slotDate: true } },
        },
      });
    },

    // ── Reveal (single transaction) ───────────────────────────────────────

    /**
     * Atomically reveals an instance and stamps voucher issuance data. The
     * status guard on `updateMany` is the concurrency gate: of two simultaneous
     * reveals only one observes `count === 1`; the loser sees 0 and is reported
     * as a conflict. Voucher-code assignment happens in the same transaction,
     * so a failure rolls everything back and the instance stays pending.
     */
    async revealInstance({ instanceId, now, voucher }) {
      return db().$transaction(async (tx) => {
        const claimed = await tx.rewardInstance.updateMany({
          where: { id: instanceId, status: 'pending' },
          data: { status: 'revealed', revealedAt: now },
        });
        if (claimed.count === 0) {
          return { claimed: false };
        }

        const instance = await tx.rewardInstance.update({
          where: { id: instanceId },
          data: voucher
            ? {
                voucherCode: voucher.code,
                voucherValidUntil: voucher.validUntil,
                outcome: voucher.outcome,
              }
            : {},
          include: { mechanism: { select: { name: true, venueId: true } } },
        });

        return { claimed: true, instance };
      });
    },

    // ── Voucher redemption (staff) ────────────────────────────────────────

    /**
     * Marks a revealed voucher redeemed. The `redeemedAt: null` guard makes
     * redemption first-wins under concurrency: a second stall scan sees
     * count 0 and reports "already redeemed" instead of double-honoring.
     */
    async redeemVoucher({ instanceId, now, note }) {
      return db().rewardInstance.updateMany({
        where: { id: instanceId, status: 'revealed', redeemedAt: null },
        data: { redeemedAt: now, redemptionNote: note ?? null },
      });
    },

    // ── Expiry ────────────────────────────────────────────────────────────

    async sweepExpiredInstances({ now, limit }) {
      const candidates = await db().rewardInstance.findMany({
        where: { status: 'pending', expiresAt: { lte: now } },
        select: { id: true },
        take: limit,
      });
      if (candidates.length === 0) return { count: 0 };

      return db().rewardInstance.updateMany({
        where: { id: { in: candidates.map((row) => row.id) }, status: 'pending' },
        data: { status: 'expired' },
      });
    },

    async expireInstance({ instanceId }) {
      return db().rewardInstance.updateMany({
        where: { id: instanceId, status: 'pending' },
        data: { status: 'expired' },
      });
    },

    // ── Mechanism management ──────────────────────────────────────────────

    async getVenueMechanisms({ venueId }) {
      return db().rewardMechanism.findMany({
        where: { venueId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    },

    async getMechanismById({ mechanismId }) {
      return db().rewardMechanism.findFirst({
        where: { id: mechanismId, deletedAt: null },
      });
    },

    async createMechanism({ data }) {
      return db().rewardMechanism.create({ data });
    },

    async updateMechanism({ mechanismId, data }) {
      return db().rewardMechanism.update({
        where: { id: mechanismId },
        data,
      });
    },

    async venueExists({ venueId }) {
      const venue = await db().venue.findUnique({ where: { id: venueId }, select: { id: true } });
      return Boolean(venue);
    },

    // ── Moderation listing ────────────────────────────────────────────────

    async getModerationInstances({ venueId, status, mechanismId, voucherCode, redeemed, page, limit }) {
      const where = {
        mechanism: { venueId },
        ...(status ? { status } : {}),
        ...(mechanismId ? { mechanismId } : {}),
        ...(voucherCode ? { voucherCode } : {}),
        ...(redeemed === true ? { redeemedAt: { not: null } } : {}),
        ...(redeemed === false ? { redeemedAt: null } : {}),
      };
      const skip = (page - 1) * limit;

      const [instances, total] = await Promise.all([
        db().rewardInstance.findMany({
          where,
          include: {
            mechanism: { select: { name: true } },
            user: { select: { id: true, name: true, phone: true } },
            booking: { select: { id: true, slotDate: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        db().rewardInstance.count({ where }),
      ]);

      return { instances, total };
    },
  };
};
