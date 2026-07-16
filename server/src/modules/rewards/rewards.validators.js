import Joi from 'joi';

import { PROBABILITY_SUM_TOLERANCE } from './rewards.constants.js';

const id = Joi.string().guid({ version: ['uuidv4'] }).required();

// Enum values mirror prisma/schema.prisma. Launch supports the scratch_card and
// spinner experiences end-to-end; coupon_drop/points are reserved enum values
// with no frontend component yet, so mechanism creation rejects them.
const SUPPORTED_MECHANISM_TYPES = ['scratch_card', 'spinner'];
const TRIGGER_EVENTS = ['booking_confirmed'];
const INSTANCE_STATUSES = ['pending', 'revealed', 'expired'];
const PRIZE_TYPES = ['no_prize', 'voucher'];

// A single entry of `config.prizes`. A voucher is an external offer (e.g. the
// venue's F&B stall) redeemed outside the booking flow: the label names the
// offer, `terms` carries any smallprint shown to the customer, and
// `validity_days` bounds redemption after reveal.
const prizeSchema = Joi.object({
  id: Joi.string().trim().min(1).max(50).required(),
  label: Joi.string().trim().min(1).max(255).required(),
  type: Joi.string().valid(...PRIZE_TYPES).required(),
  probability: Joi.number().greater(0).max(1).required(),
  terms: Joi.string().trim().max(500).when('type', {
    is: 'voucher',
    then: Joi.optional(),
    otherwise: Joi.forbidden(),
  }),
  validity_days: Joi.number().integer().min(1).max(365).when('type', {
    is: 'voucher',
    then: Joi.optional(),
    otherwise: Joi.forbidden(),
  }),
});

const validatePrizePool = (prizes, helpers) => {
  const ids = new Set(prizes.map((prize) => prize.id));
  if (ids.size !== prizes.length) {
    return helpers.error('any.custom', { message: 'prize ids must be unique' });
  }

  const sum = prizes.reduce((total, prize) => total + prize.probability, 0);
  if (Math.abs(sum - 1) > PROBABILITY_SUM_TOLERANCE) {
    return helpers.error('any.custom', {
      message: `prize probabilities must sum to exactly 1.0 (got ${sum})`,
    });
  }

  return prizes;
};

const configSchema = Joi.object({
  card_theme: Joi.string().trim().max(50).optional(),
  segment_count: Joi.number().integer().min(2).max(12).optional(),
  prizes: Joi.array().items(prizeSchema).min(1).max(20).required().custom(validatePrizePool),
}).messages({ 'any.custom': '{{#message}}' });

// POST /rewards/mechanisms
export const createMechanismSchema = Joi.object({
  venue_id: id,
  name: Joi.string().trim().min(1).max(255).required(),
  type: Joi.string().valid(...SUPPORTED_MECHANISM_TYPES).required(),
  trigger_event: Joi.string().valid(...TRIGGER_EVENTS).default('booking_confirmed'),
  instance_expiry_days: Joi.number().integer().min(1).max(365).default(7),
  is_active: Joi.boolean().default(false),
  valid_from: Joi.date().iso().optional(),
  valid_until: Joi.date().iso().greater(Joi.ref('valid_from')).optional(),
  config: configSchema.required(),
});

// PATCH /rewards/mechanisms/:mechanismId — partial; config is revalidated in
// full whenever present so an edit can never save an invalid prize pool.
export const updateMechanismSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255),
  instance_expiry_days: Joi.number().integer().min(1).max(365),
  is_active: Joi.boolean(),
  valid_from: Joi.date().iso().allow(null),
  valid_until: Joi.date().iso().allow(null),
  config: configSchema,
}).min(1);

// GET /rewards/mechanisms
export const listMechanismsQuerySchema = Joi.object({
  venue_id: id,
});

// GET /rewards/instances
export const myInstancesQuerySchema = Joi.object({
  status: Joi.string().valid(...INSTANCE_STATUSES).optional(),
});

// GET /rewards/instances/moderation
export const moderationInstancesQuerySchema = Joi.object({
  venue_id: id,
  status: Joi.string().valid(...INSTANCE_STATUSES).optional(),
  mechanism_id: Joi.string().guid({ version: ['uuidv4'] }).optional(),
  voucher_code: Joi.string().trim().uppercase().max(20).optional(),
  redeemed: Joi.boolean().optional(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  page: Joi.number().integer().min(1).default(1),
});

export const instanceIdParamsSchema = Joi.object({
  instanceId: id,
});

export const mechanismIdParamsSchema = Joi.object({
  mechanismId: id,
});

// PATCH /rewards/instances/:instanceId/redeem
export const redeemVoucherSchema = Joi.object({
  note: Joi.string().trim().max(500).allow('').optional(),
});
