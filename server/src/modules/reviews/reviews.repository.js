import { getPrisma } from '../../lib/prisma.js';

export const createReviewsRepository = ({ prisma } = {}) => {
  const db = () => prisma || getPrisma();

  return {
    async getBookingForReview({ bookingId, userId }) {
      return db().booking.findFirst({
        where: {
          id: bookingId,
          userId,
        },
        select: {
          id: true,
          userId: true,
          venueId: true,
          status: true,
          review: {
            select: { id: true },
          },
        },
      });
    },

    async createReview({ bookingId, userId, venueId, rating, comment }) {
      return db().review.create({
        data: {
          bookingId,
          userId,
          venueId,
          rating,
          comment: comment || null,
          isPublished: true,
        },
      });
    },

    async getReviewByBookingId({ bookingId }) {
      return db().review.findUnique({
        where: { bookingId },
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
      });
    },

    async getVenueReviews({ venueId, page, limit }) {
      const skip = (page - 1) * limit;

      const [reviews, total] = await Promise.all([
        db().review.findMany({
          where: {
            venueId,
            isPublished: true,
          },
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        db().review.count({
          where: {
            venueId,
            isPublished: true,
          },
        }),
      ]);

      return { reviews, total };
    },

    async getVenueReviewSummary({ venueId }) {
      const result = await db().review.aggregate({
        where: {
          venueId,
          isPublished: true,
        },
        _avg: { rating: true },
        _count: { id: true },
      });

      return {
        average_rating: result._avg.rating ? Number(result._avg.rating.toFixed(1)) : null,
        total_reviews: result._count.id,
      };
    },

    async getModerationReviews({ venueId, page, limit, isPublished }) {
      const skip = (page - 1) * limit;
      const where = { venueId };
      if (isPublished !== undefined) {
        where.isPublished = isPublished;
      }

      const [reviews, total] = await Promise.all([
        db().review.findMany({
          where,
          include: {
            user: {
              select: { id: true, name: true, phone: true },
            },
            booking: {
              select: {
                id: true,
                slotDate: true,
                sessionStartTime: true,
                sessionEndTime: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        db().review.count({ where }),
      ]);

      return { reviews, total };
    },

    async updateReviewPublishStatus({ reviewId, isPublished }) {
      return db().review.update({
        where: { id: reviewId },
        data: { isPublished },
      });
    },

    async getReviewById({ reviewId }) {
      return db().review.findUnique({
        where: { id: reviewId },
      });
    },
  };
};
