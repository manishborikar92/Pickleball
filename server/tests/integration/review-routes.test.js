import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import createApp from '../../src/app.js';
import { createReviewsRouter } from '../../src/modules/reviews/reviews.routes.js';

const userId = '33333333-3333-4333-8333-333333333333';
const venueId = '11111111-1111-4111-8111-111111111111';
const bookingId = '44444444-4444-4444-8444-444444444444';
const reviewId = '55555555-5555-4555-8555-555555555555';

const authMiddleware = (req, _res, next) => {
  req.auth = { subject: userId, permissions: ['manage_bookings'] };
  next();
};

const onboardingMiddleware = (_req, _res, next) => next();

// Records every permission guard the router builds so tests can assert wiring.
const createPermissionRecorder = () => {
  const calls = [];
  const factory = ({ permission, venueResolver }) => (req, _res, next) => {
    calls.push({ permission, venueId: venueResolver(req) });
    next();
  };
  return { factory, calls };
};

const mountReviews = ({ reviewsService, requireVenuePermission }) => createApp({
  configureRoutes(router) {
    router.use('/reviews', createReviewsRouter({
      reviewsService,
      requireVenuePermission,
      authMiddleware,
      onboardingMiddleware,
    }));
  },
});

test('POST /reviews submits a review with a 201 envelope', async () => {
  const calls = [];
  const reviewsService = {
    async createReview(args) {
      calls.push(args);
      return { id: reviewId, booking_id: args.bookingId, rating: args.input.rating, is_published: true };
    },
  };
  const { factory } = createPermissionRecorder();
  const app = mountReviews({ reviewsService, requireVenuePermission: factory });

  const response = await request(app)
    .post('/api/v1/reviews')
    .send({ booking_id: bookingId, rating: 5, comment: 'Excellent' });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.id, reviewId);
  assert.deepEqual(calls, [{ userId, bookingId, input: { rating: 5, comment: 'Excellent' } }]);
});

test('POST /reviews rejects a missing booking_id with 400', async () => {
  const reviewsService = { async createReview() { throw new Error('should not be called'); } };
  const { factory } = createPermissionRecorder();
  const app = mountReviews({ reviewsService, requireVenuePermission: factory });

  const response = await request(app)
    .post('/api/v1/reviews')
    .send({ rating: 5 });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
});

test('POST /reviews rejects an out-of-range rating with 400', async () => {
  const reviewsService = { async createReview() { throw new Error('should not be called'); } };
  const { factory } = createPermissionRecorder();
  const app = mountReviews({ reviewsService, requireVenuePermission: factory });

  const response = await request(app)
    .post('/api/v1/reviews')
    .send({ booking_id: bookingId, rating: 9 });

  assert.equal(response.status, 400);
});

test('GET /reviews returns a public paginated list without authentication', async () => {
  const calls = [];
  const reviewsService = {
    async getVenueReviews(args) {
      calls.push(args);
      return {
        data: [{ id: reviewId, rating: 5 }],
        pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
        summary: { average_rating: 5, total_reviews: 1 },
      };
    },
  };
  const { factory } = createPermissionRecorder();
  const app = mountReviews({ reviewsService, requireVenuePermission: factory });

  const response = await request(app).get(`/api/v1/reviews?venue_id=${venueId}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.length, 1);
  assert.deepEqual(response.body.meta.pagination, { page: 1, limit: 10, total: 1, total_pages: 1 });
  assert.deepEqual(response.body.meta.summary, { average_rating: 5, total_reviews: 1 });
  assert.deepEqual(calls, [{ venueId, page: 1, limit: 10 }]);
});

test('GET /reviews rejects a missing venue_id with 400', async () => {
  const reviewsService = { async getVenueReviews() { throw new Error('should not be called'); } };
  const { factory } = createPermissionRecorder();
  const app = mountReviews({ reviewsService, requireVenuePermission: factory });

  const response = await request(app).get('/api/v1/reviews');

  assert.equal(response.status, 400);
});

test('GET /reviews/me returns the caller-owned review', async () => {
  const calls = [];
  const reviewsService = {
    async getBookingReview(args) {
      calls.push(args);
      return { id: reviewId, booking_id: bookingId, rating: 4 };
    },
  };
  const { factory } = createPermissionRecorder();
  const app = mountReviews({ reviewsService, requireVenuePermission: factory });

  const response = await request(app).get(`/api/v1/reviews/me?booking_id=${bookingId}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.id, reviewId);
  assert.deepEqual(calls, [{ userId, bookingId }]);
});

test('GET /reviews/moderation enforces the manage_bookings venue permission', async () => {
  const reviewsService = {
    async getModerationReviews(args) {
      return {
        data: [{ id: reviewId, rating: 2, is_published: false }],
        pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
        _args: args,
      };
    },
  };
  const { factory, calls } = createPermissionRecorder();
  const app = mountReviews({ reviewsService, requireVenuePermission: factory });

  const response = await request(app)
    .get(`/api/v1/reviews/moderation?venue_id=${venueId}&is_published=false`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 1);
  assert.deepEqual(calls, [{ permission: 'manage_bookings', venueId }]);
});

test('PATCH /reviews/:reviewId moderates the publish status', async () => {
  const calls = [];
  const reviewsService = {
    async moderateReview(args) {
      calls.push(args);
      return { id: reviewId, is_published: false };
    },
  };
  const { factory } = createPermissionRecorder();
  const app = mountReviews({ reviewsService, requireVenuePermission: factory });

  const response = await request(app)
    .patch(`/api/v1/reviews/${reviewId}`)
    .send({ is_published: false });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.is_published, false);
  assert.deepEqual(calls, [{ userId, reviewId, isPublished: false }]);
});

test('PATCH /reviews/:reviewId rejects a non-boolean is_published with 400', async () => {
  const reviewsService = { async moderateReview() { throw new Error('should not be called'); } };
  const { factory } = createPermissionRecorder();
  const app = mountReviews({ reviewsService, requireVenuePermission: factory });

  const response = await request(app)
    .patch(`/api/v1/reviews/${reviewId}`)
    .send({ is_published: 'nope' });

  assert.equal(response.status, 400);
});

test('createReviewsRouter requires its dependencies', () => {
  assert.throws(() => createReviewsRouter({}), /reviewsService is required/);
  assert.throws(
    () => createReviewsRouter({ reviewsService: {} }),
    /requireVenuePermission is required/,
  );
});
