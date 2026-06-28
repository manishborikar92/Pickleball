# ADR-009: Reviews as an Independent Domain Under `/reviews`

## Status

Approved

## Context

The platform needed customer reviews for completed sessions. A review is created from a booking (the eligibility anchor), but its value — ratings, summaries, public listings, moderation — is aggregated and consumed at the **venue** level. An early implementation scattered review endpoints across other domains: submission under `POST /bookings/:bookingId/review` and moderation under `/admin/...`. This leaked review concerns into the bookings and admin namespaces and blurred module boundaries.

Key facts established during analysis:
- A `reviews` table already existed (unique `booking_id` for 1:1 with a booking, composite index `(venue_id, is_published, created_at)`, `CHECK (rating BETWEEN 1 AND 5)`, cascading FKs to `bookings`, `users`, `venues`).
- The dependency is strictly one-directional: reviews read a booking to gate eligibility; bookings have no knowledge of reviews.

## Decision

Model reviews as a **first-class, self-contained module** (`server/src/modules/reviews/`) that owns every review route under a single `/reviews` prefix. No other domain namespaces review endpoints.

RESTful surface (all under `/reviews`):

| Method & path | Purpose | Auth |
|---|---|---|
| `POST /reviews` | Create a review (`booking_id` in body) | user + onboarding |
| `GET /reviews?venue_id=` | Public published list + rating summary | public |
| `GET /reviews/me?booking_id=` | Caller's own review for a booking | user + onboarding |
| `GET /reviews/moderation?venue_id=` | All reviews for a managed venue | `manage_bookings` |
| `PATCH /reviews/{reviewId}` | Publish / unpublish (moderate) | `manage_bookings` (service-resolved) |

Supporting decisions:
- **Single router factory** with per-route middleware (mirrors `bookings.routes.js`, which mixes public and authenticated routes), since every route now shares the `/reviews` prefix.
- **Eligibility rules in the service**: a review is allowed only for a booking that is owned by the caller and has `status = 'completed'`, and only once per booking. Violations map to `404` (not found / not owner), `400 BOOKING_NOT_COMPLETED`, and `409 DUPLICATE_REVIEW`.
- **Moderation authorization in the service layer**, resolved against the review's own `venue_id`; unauthorized callers receive `404` rather than `403` to avoid leaking review existence.
- **"Moderation", not "admin"**, as the terminology for the privileged surface, since reviews are not owned by an admin module.

## Alternatives Considered

| Alternative | Tradeoff |
|---|---|
| Keep review routes under `/bookings` and `/admin` | Leaks review concerns into unrelated domains; inverts module boundaries; harder to evolve independently |
| Fold reviews into the bookings module | Bookings would absorb venue-level aggregation and moderation; breaks the clean one-way dependency |
| Single `GET /reviews` with optional auth returning richer data to managers | Identity-dependent response shapes complicate the contract, typing, and OpenAPI; explicit `/reviews/moderation` is clearer and safer |

## Consequences

- **Benefits**: Clear domain ownership and module boundary; consistent, predictable REST surface; authorization centralized where the venue context lives; independent evolution and testing of the reviews domain.
- **Trade-offs**: Two listing endpoints (public vs. moderation) instead of one overloaded route — accepted for explicit authorization boundaries and stable response contracts.
- **Follow-ups**: `photo_url` is reserved in the schema; review photo uploads are deferred until Cloudflare R2 integration lands.
