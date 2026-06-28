import assert from 'node:assert/strict';
import test from 'node:test';

import { createReviewsService } from '../../src/modules/reviews/reviews.service.js';

const userId = '33333333-3333-4333-8333-333333333333';
const otherUserId = '99999999-9999-4999-8999-999999999999';
const bookingId = '44444444-4444-4444-8444-444444444444';
const venueId = '11111111-1111-4111-8111-111111111111';
const reviewId = '55555555-5555-4555-8555-555555555555';

// Minimal stub repository; individual tests override the methods they exercise.
const stubRepository = (overrides = {}) => ({
  getBookingForReview: async () => null,
  createReview: async () => ({}),
  getReviewByBookingId: async () => null,
  getVenueReviews: async () => ({ reviews: [], total: 0 }),
  getVenueReviewSummary: async () => ({ average_rating: null, total_reviews: 0 }),
  getModerationReviews: async () => ({ reviews: [], total: 0 }),
  getReviewById: async () => null,
  updateReviewPublishStatus: async () => ({}),
  ...overrides,
});

test('reviews service requires a repository', () => {
  assert.throws(() => createReviewsService({}), /repository is required/);
});

test('createReview persists a review for a completed, unreviewed, owned booking', async () => {
  const created = [];
  const repository = stubRepository({
    getBookingForReview: async (args) => {
      assert.deepEqual(args, { bookingId, userId });
      return { id: bookingId, userId, venueId, status: 'completed', review: null };
    },
    createReview: async (payload) => {
      created.push(payload);
      return {
        id: reviewId,
        bookingId,
        venueId,
        rating: payload.rating,
        comment: payload.comment,
        photoUrl: null,
        isPublished: true,
        createdAt: '2026-06-28T10:00:00.000Z',
      };
    },
  });
  const service = createReviewsService({ repository });

  const result = await service.createReview({
    userId,
    bookingId,
    input: { rating: 5, comment: 'Great surface' },
  });

  assert.deepEqual(created, [{ bookingId, userId, venueId, rating: 5, comment: 'Great surface' }]);
  assert.equal(result.id, reviewId);
  assert.equal(result.rating, 5);
  assert.equal(result.is_published, true);
  assert.equal(result.booking_id, bookingId);
  assert.equal(result.venue_id, venueId);
  // Public serialization must not leak moderation-only fields.
  assert.equal(result.user, undefined);
});

test('createReview rejects a missing booking with NotFound (404)', async () => {
  const service = createReviewsService({ repository: stubRepository() });
  await assert.rejects(
    service.createReview({ userId, bookingId, input: { rating: 4 } }),
    (err) => err.statusCode === 404,
  );
});

test('createReview hides bookings owned by another user as NotFound (404)', async () => {
  const repository = stubRepository({
    getBookingForReview: async () => ({ id: bookingId, userId: otherUserId, venueId, status: 'completed', review: null }),
  });
  const service = createReviewsService({ repository });
  await assert.rejects(
    service.createReview({ userId, bookingId, input: { rating: 4 } }),
    (err) => err.statusCode === 404,
  );
});

test('createReview blocks non-completed bookings with a 400 BOOKING_NOT_COMPLETED', async () => {
  const repository = stubRepository({
    getBookingForReview: async () => ({ id: bookingId, userId, venueId, status: 'confirmed', review: null }),
  });
  const service = createReviewsService({ repository });
  await assert.rejects(
    service.createReview({ userId, bookingId, input: { rating: 4 } }),
    (err) => err.statusCode === 400 && err.details?.code === 'BOOKING_NOT_COMPLETED',
  );
});

test('createReview rejects a duplicate review with a 409 DUPLICATE_REVIEW', async () => {
  const repository = stubRepository({
    getBookingForReview: async () => ({ id: bookingId, userId, venueId, status: 'completed', review: { id: reviewId } }),
  });
  const service = createReviewsService({ repository });
  await assert.rejects(
    service.createReview({ userId, bookingId, input: { rating: 4 } }),
    (err) => err.statusCode === 409 && err.details?.code === 'DUPLICATE_REVIEW',
  );
});

test('getBookingReview returns the caller-owned review', async () => {
  const repository = stubRepository({
    getReviewByBookingId: async (args) => {
      assert.deepEqual(args, { bookingId });
      return {
        id: reviewId, bookingId, venueId, userId, rating: 3, comment: null,
        photoUrl: null, isPublished: true, createdAt: '2026-06-28T10:00:00.000Z',
        user: { id: userId, name: 'Asha' },
      };
    },
  });
  const service = createReviewsService({ repository });
  const result = await service.getBookingReview({ userId, bookingId });
  assert.equal(result.id, reviewId);
  assert.deepEqual(result.user, { id: userId, name: 'Asha' });
});

test('getBookingReview hides another user\'s review as NotFound (404)', async () => {
  const repository = stubRepository({
    getReviewByBookingId: async () => ({ id: reviewId, bookingId, userId: otherUserId, rating: 3 }),
  });
  const service = createReviewsService({ repository });
  await assert.rejects(
    service.getBookingReview({ userId, bookingId }),
    (err) => err.statusCode === 404,
  );
});

test('getVenueReviews returns paginated published reviews with a summary', async () => {
  const repository = stubRepository({
    getVenueReviews: async ({ venueId: v, page, limit }) => {
      assert.equal(v, venueId);
      assert.equal(page, 2);
      assert.equal(limit, 10);
      return {
        reviews: [{
          id: reviewId, bookingId, venueId, rating: 5, comment: 'Nice',
          photoUrl: null, isPublished: true, createdAt: '2026-06-28T10:00:00.000Z',
          user: { id: userId, name: 'Asha' },
        }],
        total: 11,
      };
    },
    getVenueReviewSummary: async () => ({ average_rating: 4.5, total_reviews: 11 }),
  });
  const service = createReviewsService({ repository });

  const result = await service.getVenueReviews({ venueId, page: 2, limit: 10 });

  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].user.name, 'Asha');
  assert.equal(result.data[0].user.phone, undefined); // public view never exposes phone
  assert.deepEqual(result.pagination, { page: 2, limit: 10, total: 11, total_pages: 2 });
  assert.deepEqual(result.summary, { average_rating: 4.5, total_reviews: 11 });
});

test('getModerationReviews exposes moderation-only fields (phone, booking)', async () => {
  const repository = stubRepository({
    getModerationReviews: async ({ venueId: v, isPublished }) => {
      assert.equal(v, venueId);
      assert.equal(isPublished, false);
      return {
        reviews: [{
          id: reviewId, bookingId, venueId, rating: 2, comment: 'Hidden',
          photoUrl: null, isPublished: false, createdAt: '2026-06-28T10:00:00.000Z',
          user: { id: userId, name: 'Asha', phone: '+919876543210' },
          booking: { id: bookingId, slotDate: '2026-06-20', sessionStartTime: '09:00', sessionEndTime: '10:00' },
        }],
        total: 1,
      };
    },
  });
  const service = createReviewsService({ repository });

  const result = await service.getModerationReviews({ venueId, page: 1, limit: 20, isPublished: false });

  assert.equal(result.data[0].user.phone, '+919876543210');
  assert.equal(result.data[0].booking.slot_date, '2026-06-20');
  assert.deepEqual(result.pagination, { page: 1, limit: 20, total: 1, total_pages: 1 });
});

test('moderateReview updates publish status when the caller has permission', async () => {
  const updates = [];
  const repository = stubRepository({
    getReviewById: async () => ({ id: reviewId, venueId, isPublished: true }),
    updateReviewPublishStatus: async (args) => {
      updates.push(args);
      return { id: reviewId, bookingId, venueId, rating: 4, comment: null, photoUrl: null, isPublished: false, createdAt: '2026-06-28T10:00:00.000Z' };
    },
  });
  const authorizationService = {
    hasPermission: async ({ userId: u, venueId: v, permission }) => {
      assert.equal(u, userId);
      assert.equal(v, venueId);
      assert.equal(permission, 'manage_bookings');
      return true;
    },
  };
  const service = createReviewsService({ repository, authorizationService });

  const result = await service.moderateReview({ userId, reviewId, isPublished: false });

  assert.deepEqual(updates, [{ reviewId, isPublished: false }]);
  assert.equal(result.is_published, false);
});

test('moderateReview hides reviews the caller cannot manage as NotFound (404)', async () => {
  const repository = stubRepository({
    getReviewById: async () => ({ id: reviewId, venueId, isPublished: true }),
  });
  const authorizationService = { hasPermission: async () => false };
  const service = createReviewsService({ repository, authorizationService });
  await assert.rejects(
    service.moderateReview({ userId, reviewId, isPublished: false }),
    (err) => err.statusCode === 404,
  );
});

test('moderateReview rejects an unknown review with NotFound (404)', async () => {
  const service = createReviewsService({ repository: stubRepository(), authorizationService: { hasPermission: async () => true } });
  await assert.rejects(
    service.moderateReview({ userId, reviewId, isPublished: true }),
    (err) => err.statusCode === 404,
  );
});
