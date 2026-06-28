import Joi from 'joi';

const id = Joi.string().guid({ version: ['uuidv4'] }).required();

// POST /reviews
export const createReviewSchema = Joi.object({
  booking_id: id,
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().max(1000).allow('').optional(),
  // photo upload will be handled separately when R2 integration is ready
});

// GET /reviews/me
export const myReviewQuerySchema = Joi.object({
  booking_id: id,
});

// GET /reviews
export const venueReviewsQuerySchema = Joi.object({
  venue_id: id,
  limit: Joi.number().integer().min(1).max(50).default(10),
  page: Joi.number().integer().min(1).default(1),
});

// GET /reviews/moderation
export const moderationReviewsQuerySchema = Joi.object({
  venue_id: id,
  limit: Joi.number().integer().min(1).max(50).default(20),
  page: Joi.number().integer().min(1).default(1),
  is_published: Joi.boolean().optional(),
});

// PATCH /reviews/:reviewId
export const reviewIdParamsSchema = Joi.object({
  reviewId: id,
});

export const updateReviewPublishSchema = Joi.object({
  is_published: Joi.boolean().required(),
});
