import { ApiResponse } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/api-error.js';

export const createRewardsController = ({ rewardsService }) => ({
  // ── Customer ──────────────────────────────────────────────────────────

  getMyInstances: asyncHandler(async (req, res) => {
    const result = await rewardsService.getUserInstances({
      userId: req.auth.subject,
      status: req.validated.query.status,
    });
    res.json(ApiResponse.success(result));
  }),

  getInstance: asyncHandler(async (req, res) => {
    const result = await rewardsService.getInstance({
      userId: req.auth.subject,
      instanceId: req.validated.params.instanceId,
    });
    res.json(ApiResponse.success(result));
  }),

  revealInstance: asyncHandler(async (req, res) => {
    const result = await rewardsService.revealInstance({
      userId: req.auth.subject,
      instanceId: req.validated.params.instanceId,
    });
    res.json(ApiResponse.success(result, 'Reward revealed'));
  }),

  // ── Mechanism management (edit_pricing) ──────────────────────────────

  getVenueMechanisms: asyncHandler(async (req, res) => {
    const result = await rewardsService.getVenueMechanisms({
      venueId: req.validated.query.venue_id,
    });
    res.json(ApiResponse.success(result));
  }),

  createMechanism: asyncHandler(async (req, res) => {
    const result = await rewardsService.createMechanism({
      input: req.validated.body,
    });
    res.status(201).json(ApiResponse.success(result, 'Reward mechanism created'));
  }),

  updateMechanism: asyncHandler(async (req, res) => {
    const result = await rewardsService.updateMechanism({
      userId: req.auth.subject,
      mechanismId: req.validated.params.mechanismId,
      input: req.validated.body,
    });
    res.json(ApiResponse.success(result, 'Reward mechanism updated'));
  }),

  // ── Instance moderation (manage_bookings) ────────────────────────────

  getModerationInstances: asyncHandler(async (req, res) => {
    const result = await rewardsService.getModerationInstances({
      venueId: req.validated.query.venue_id,
      status: req.validated.query.status,
      mechanismId: req.validated.query.mechanism_id,
      voucherCode: req.validated.query.voucher_code,
      redeemed: req.validated.query.redeemed,
      page: req.validated.query.page,
      limit: req.validated.query.limit,
    });
    res.json(ApiResponse.paginated(result.data, result.pagination, 'Reward instances retrieved'));
  }),

  expireInstance: asyncHandler(async (req, res) => {
    const result = await rewardsService.expireInstanceManually({
      userId: req.auth.subject,
      instanceId: req.validated.params.instanceId,
    });
    res.json(ApiResponse.success(result, 'Reward expired'));
  }),

  redeemVoucher: asyncHandler(async (req, res) => {
    const result = await rewardsService.redeemVoucher({
      userId: req.auth.subject,
      instanceId: req.validated.params.instanceId,
      note: req.validated.body.note,
    });
    res.json(ApiResponse.success(result, 'Voucher redeemed'));
  }),
});
