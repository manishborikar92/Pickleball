import Joi from 'joi';

export const uuid = Joi.string().guid({ version: ['uuidv4'] });

export const uuidParamSchema = Joi.object({
  id: uuid.required(),
});

export const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
