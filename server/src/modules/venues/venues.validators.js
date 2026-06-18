import Joi from 'joi';

export const venueIdParamsSchema = Joi.object({
  venueId: Joi.string().guid({ version: ['uuidv4'] }).required(),
});

export const venueSlugParamsSchema = Joi.object({
  slug: Joi.string().trim().lowercase().pattern(/^[a-z0-9-]{2,100}$/).required(),
});

export const venueAvailabilityParamsSchema = Joi.object({
  venueId: Joi.string().guid({ version: ['uuidv4'] }).required(),
});

export const venueAvailabilityQuerySchema = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
});
