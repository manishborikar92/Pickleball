import { ApiResponse } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/api-error.js';

export const createReviewsController = ({ reviewsService }) => ({
  createReview: asyncHandler(async (req, res) => {
    const { booking_id: bookingId, ...input } = req.validated.body;
    const result = await reviewsService.createReview({
      userId: req.auth.subject,
      bookingId,
      input,
    });
    res.status(201).json(ApiResponse.success(result, 'Review submitted'));
  }),

  getMyReview: asyncHandler(async (req, res) => {
    const result = await reviewsService.getBookingReview({
      userId: req.auth.subject,
      bookingId: req.validated.query.booking_id,
    });
    res.json(ApiResponse.success(result));
  }),

  getVenueReviews: asyncHandler(async (req, res) => {
    const result = await reviewsService.getVenueReviews({
      venueId: req.validated.query.venue_id,
      page: req.validated.query.page,
      limit: req.validated.query.limit,
    });
    res.json(ApiResponse.paginated(result.data, result.pagination, 'Reviews retrieved', {
      summary: result.summary,
    }));
  }),

  getModerationReviews: asyncHandler(async (req, res) => {
    const result = await reviewsService.getModerationReviews({
      venueId: req.validated.query.venue_id,
      page: req.validated.query.page,
      limit: req.validated.query.limit,
      isPublished: req.validated.query.is_published,
    });
    res.json(ApiResponse.paginated(result.data, result.pagination, 'Reviews retrieved'));
  }),

  moderateReview: asyncHandler(async (req, res) => {
    const result = await reviewsService.moderateReview({
      userId: req.auth.subject,
      reviewId: req.validated.params.reviewId,
      isPublished: req.validated.body.is_published,
    });
    res.json(ApiResponse.success(result, 'Review updated'));
  }),
});
