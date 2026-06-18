import Joi from 'joi';

export const onboardingSchema = Joi.object({
  name: Joi.string().trim().replace(/\s+/g, ' ').min(2).max(100).required(),
});

export const myBookingsQuerySchema = Joi.object({
  status: Joi.string().valid('pending_payment', 'confirmed', 'expired', 'cancelled').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
