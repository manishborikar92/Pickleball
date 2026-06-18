import Joi from 'joi';

const id = Joi.string().guid({ version: ['uuidv4'] }).required();
const dateOnly = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required();
const timeOnly = Joi.string().pattern(/^\d{2}:\d{2}$/).required();

export const bookingSelectionSchema = Joi.object({
  venue_id: id,
  court_ids: Joi.array().items(id).min(1).max(8).unique().required(),
  slot_date: dateOnly,
  slot_start_times: Joi.array().items(timeOnly).min(1).max(12).unique().required(),
  coupon_code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]{3,50}$/).optional(),
});

export const bookingParamsSchema = Joi.object({
  bookingId: id,
});

export const waiverSchema = Joi.object({
  time_acknowledged: Joi.boolean().valid(true).required(),
  policy_accepted: Joi.boolean().valid(true).required(),
});

export const initiatePaymentSchema = Joi.object({
  use_wallet_credits: Joi.boolean().default(false),
});
