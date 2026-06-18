import Joi from 'joi';

export const paymentOrderParamsSchema = Joi.object({
  merchantOrderId: Joi.string().trim().min(6).max(255).required(),
});
