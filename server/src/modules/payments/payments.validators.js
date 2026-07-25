import Joi from 'joi';

export const paymentOrderParamsSchema = Joi.object({
  merchantOrderId: Joi.string().trim().min(6).max(255).required(),
});

export const paymentVerifyQuerySchema = Joi.object({
  orderId: Joi.string().trim().min(6).max(255).required(),
});

export const paymentIdParamsSchema = Joi.object({
  paymentId: Joi.string().uuid().required(),
});

export const refundBodySchema = Joi.object({
  amount: Joi.number().precision(2).positive().optional(),
});
