import Joi from 'joi';

export const customerNameSchema = Joi.string()
  .trim()
  .replace(/\s+/g, ' ')
  .min(2)
  .max(100);

export const onboardingSchema = Joi.object({
  name: customerNameSchema.required(),
});

export const profileUpdateSchema = Joi.object({
  name: customerNameSchema.required(),
}).prefs({ stripUnknown: false });

export const myBookingsQuerySchema = Joi.object({
  status: Joi.string().valid('pending_payment', 'confirmed', 'completed', 'expired', 'cancelled').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
