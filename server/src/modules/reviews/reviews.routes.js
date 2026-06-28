import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.middleware.js';
import { requireOnboarding } from '../../middleware/require-onboarding.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createReviewsController } from './reviews.controller.js';
import {
  createReviewSchema,
  myReviewQuerySchema,
  venueReviewsQuerySchema,
  moderationReviewsQuerySchema,
  reviewIdParamsSchema,
  updateReviewPublishSchema,
} from './reviews.validators.js';

// All review routes are owned by the reviews module and mounted under /reviews.
export const createReviewsRouter = ({
  reviewsService,
  requireVenuePermission,
  authMiddleware = authenticate(),
  onboardingMiddleware = requireOnboarding(),
} = {}) => {
  if (!reviewsService) {
    throw new Error('reviewsService is required');
  }
  if (!requireVenuePermission) {
    throw new Error('requireVenuePermission is required');
  }

  const router = Router();
  const controller = createReviewsController({ reviewsService });

  // POST /reviews - Submit a review for a completed booking
  router.post(
    '/',
    authMiddleware,
    onboardingMiddleware,
    validate(createReviewSchema),
    controller.createReview
  );

  // GET /reviews/me - Get the authenticated user's review for a booking
  router.get(
    '/me',
    authMiddleware,
    onboardingMiddleware,
    validate(myReviewQuerySchema, 'query'),
    controller.getMyReview
  );

  // GET /reviews/moderation - List all reviews (published + unpublished) for a managed venue
  router.get(
    '/moderation',
    authMiddleware,
    requireVenuePermission({
      permission: 'manage_bookings',
      venueResolver: (req) => req.query.venue_id,
    }),
    validate(moderationReviewsQuerySchema, 'query'),
    controller.getModerationReviews
  );

  // PATCH /reviews/:reviewId - Moderate a review (publish/unpublish)
  router.patch(
    '/:reviewId',
    authMiddleware,
    // Permission check handled in the service layer (needs the review's venueId)
    validate(reviewIdParamsSchema, 'params'),
    validate(updateReviewPublishSchema),
    controller.moderateReview
  );

  // GET /reviews - List published reviews for a venue (public)
  router.get(
    '/',
    validate(venueReviewsQuerySchema, 'query'),
    controller.getVenueReviews
  );

  return router;
};
