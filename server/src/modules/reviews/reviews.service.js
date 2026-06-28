import { ConflictError, NotFoundError, AppError } from '../../utils/api-error.js';

const serializeReview = (review) => ({
  id: review.id,
  booking_id: review.bookingId,
  venue_id: review.venueId,
  rating: review.rating,
  comment: review.comment || null,
  photo_url: review.photoUrl || null,
  is_published: review.isPublished,
  created_at: review.createdAt,
  user: review.user ? {
    id: review.user.id,
    name: review.user.name,
  } : undefined,
});

const serializeModerationReview = (review) => ({
  ...serializeReview(review),
  user: review.user ? {
    id: review.user.id,
    name: review.user.name,
    phone: review.user.phone,
  } : undefined,
  booking: review.booking ? {
    id: review.booking.id,
    slot_date: review.booking.slotDate,
    session_start_time: review.booking.sessionStartTime,
    session_end_time: review.booking.sessionEndTime,
  } : undefined,
});

export const createReviewsService = ({ repository, authorizationService } = {}) => {
  if (!repository) throw new Error('repository is required');

  return {
    async createReview({ userId, bookingId, input }) {
      const booking = await repository.getBookingForReview({ bookingId, userId });

      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      if (booking.userId !== userId) {
        throw new NotFoundError('Booking not found');
      }

      if (booking.status !== 'completed') {
        throw new AppError('Reviews can only be submitted for completed bookings', 400, {
          code: 'BOOKING_NOT_COMPLETED',
        });
      }

      if (booking.review) {
        throw new ConflictError('A review already exists for this booking', {
          code: 'DUPLICATE_REVIEW',
        });
      }

      const review = await repository.createReview({
        bookingId,
        userId,
        venueId: booking.venueId,
        rating: input.rating,
        comment: input.comment,
      });

      return serializeReview(review);
    },

    async getBookingReview({ userId, bookingId }) {
      const review = await repository.getReviewByBookingId({ bookingId });

      if (!review) {
        throw new NotFoundError('Review not found');
      }

      if (review.userId !== userId) {
        throw new NotFoundError('Review not found');
      }

      return serializeReview(review);
    },

    async getVenueReviews({ venueId, page = 1, limit = 10 }) {
      const { reviews, total } = await repository.getVenueReviews({
        venueId,
        page,
        limit,
      });

      const summary = await repository.getVenueReviewSummary({ venueId });

      return {
        data: reviews.map(serializeReview),
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
        summary,
      };
    },

    async getModerationReviews({ venueId, page = 1, limit = 20, isPublished }) {
      const { reviews, total } = await repository.getModerationReviews({
        venueId,
        page,
        limit,
        isPublished,
      });

      return {
        data: reviews.map(serializeModerationReview),
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      };
    },

    async moderateReview({ userId, reviewId, isPublished }) {
      const review = await repository.getReviewById({ reviewId });

      if (!review) {
        throw new NotFoundError('Review not found');
      }

      // Check if user has permission to manage bookings for this review's venue
      if (authorizationService) {
        const hasPerm = await authorizationService.hasPermission({
          userId,
          venueId: review.venueId,
          permission: 'manage_bookings',
        });

        if (!hasPerm) {
          throw new NotFoundError('Review not found');
        }
      }

      const updated = await repository.updateReviewPublishStatus({
        reviewId,
        isPublished,
      });

      return serializeReview(updated);
    },
  };
};
