import Joi from 'joi';

export const onboardingSchema = Joi.object({
  name: Joi.string().trim().replace(/\s+/g, ' ').min(2).max(100).required(),
});
