# Booking Module Design

## Goal

Implement an end-to-end Booking module where the Express server is the single source of truth for availability, pricing, holds, payments, wallet application, and booking lifecycle transitions. The Next.js app will consume those APIs and stop using fixture-backed booking behavior for replaced flows.

## Current State

The database schema already includes venue, court, schedule, pricing, coupon, booking, booking slot, payment, wallet, review, and reward entities. The migration history includes the partial unique index `booking_slots_no_double_book`, which prevents active booking slots from sharing the same `(court_id, slot_date, slot_start_time)` for statuses `pending_payment`, `confirmed`, `walk_in`, and `admin_block`.

The live backend currently exposes health, auth, onboarding, current-user, OpenAPI, and Swagger routes. Booking, scheduling, availability, payment, wallet, and admin booking APIs are not implemented. The booking frontend uses fixture data and local price calculations.

## Architecture

The Booking module will follow the existing backend pattern:

- `routes` define HTTP endpoints and middleware.
- `validators` define Joi request schemas.
- `controllers` translate HTTP requests to service calls.
- `services` own business rules and state transitions.
- `repositories` own Prisma and raw SQL access.
- shared helpers serialize dates, times, decimals, and API payloads.

New module boundaries:

- `venues`: public venue/court lookup plus venue-scoped availability generation from schedules, exceptions, pricing rules, and booking slots.
- `bookings`: selection validation, server pricing, hold, waiver, payment initiation, confirmation, expiry, history.
- `payments`: provider interface plus sandbox/manual provider.

No PhonePe-specific logic will be placed in booking services. Booking services call a provider interface that can return a sandbox/manual redirect/status now and a PhonePe implementation later.

## Booking Lifecycle

Allowed transitions:

- `available -> pending_payment` through atomic hold creation.
- `pending_payment -> confirmed` through wallet-only confirmation or successful payment provider event.
- `pending_payment -> expired` through expiry workflow.
- `pending_payment -> cancelled` only by admin cancellation.
- `confirmed -> cancelled` only by admin cancellation.
- `walk_in` and `admin_block` are terminal operational records except admin cancellation for `walk_in`.

Invalid transitions are rejected by the service layer. Parent `bookings.status` and child `booking_slots.status` are updated in the same transaction.

## Consistency and Concurrency

The server never relies on frontend slot state for correctness. Hold creation validates venue, active courts, date window, generated slots, consecutive slot times, user hold velocity, and current slot availability.

Hold creation is a single transaction. It computes the authoritative quote, creates one `bookings` row, then inserts all child `booking_slots` rows. The existing partial unique index is the final concurrency guard. Unique violations are converted to `SLOTS_UNAVAILABLE` responses with the conflicting slot units.

Expiry is idempotent and safe under concurrent access: only `pending_payment` bookings with `expires_at <= now` are updated, wallet credits are rolled back once, and child slots move to `expired` in the same transaction.

Confirmation is idempotent: confirming an already confirmed booking returns the confirmed state without duplicating payment rows, wallet transactions, booking slots, or reward events.

Payment events are idempotent through `payments.idempotency_key` and payment status checks.

## Server-Authoritative Pricing

The frontend never calculates final pricing. It renders server-provided availability unit prices and server price previews. At hold time, the server recomputes the quote and stores the final amounts on `bookings` and `booking_slots`. At payment initiation and confirmation, the server reloads the booking and validates that the booking is still pending and unexpired.

Pricing waterfall for this implementation:

1. Base price per court.
2. Active pricing rules ordered by priority.
3. Optional coupon validation and discount.
4. Tax calculation using configurable default rate.
5. Optional wallet credits at payment initiation.

The first slice supports documented rule shapes already present in specs: `time_modifier`, `court_modifier`, and `flash_sale`, with flat or percentage adjustments.

## Payment Architecture

Payment provider interface:

- `createPaymentOrder({ booking, amount, currency, idempotencyKey })`
- `getPaymentStatus({ merchantOrderId })`
- `normalizeWebhookEvent({ headers, body })`

Initial provider:

- `sandbox`: deterministic manual/sandbox provider for local and tests.
- It creates a payment row and returns a local confirmation/status URL shape.
- It supports success/failure callbacks without external credentials.

Future provider:

- `phonepe`: implements the same interface using PhonePe OAuth, checkout, status, and webhook APIs.
- Provider code is isolated under `payments`; booking services remain provider-agnostic.

## Compliance Evidence and Observability

The current documented business requirement for compliance logging is waiver acceptance evidence. This is satisfied by durable columns already present on `bookings`: `waiver_accepted`, `waiver_accepted_at`, and `waiver_ip_address`; the verified phone is available through the booking's `user_id` relation. No new audit-specific table, model, service, or workflow is introduced.

Operational troubleshooting uses the existing platform request/error logging and first-class domain records already required for correctness: `bookings`, `booking_slots`, `payments`, and `wallet_transactions`. The Booking module does not introduce lifecycle-specific logging infrastructure.

## Frontend Integration

The booking page will be API-driven:

- Fetch venue by slug from the server.
- Fetch availability by venue/date from the server.
- Request price preview after valid selections.
- Authenticate with existing auth context.
- Create hold through `/bookings/hold`.
- Record waiver through `/bookings/:bookingId/waiver`.
- Initiate sandbox payment through `/bookings/:bookingId/initiate-payment`.
- Poll payment status or route to confirmation using server state.

Fixture-based booking data is removed where real APIs replace it. Dashboard booking and wallet views use `/users/me/bookings` and `/users/me/wallet`.

## Test Strategy

Required test coverage:

- Unit tests for slot generation, pricing, state transitions, payment provider behavior, wallet application and rollback.
- Service tests for hold creation, invalid selections, hold limits, expiry, idempotent confirmation, stale payment recovery, and invalid transitions.
- API tests for venue, availability, price preview, hold, waiver, payment initiation/status, user bookings, and wallet routes.
- Concurrency tests for simultaneous hold attempts and partial unique index conflict mapping.
- Failure recovery tests for payment failure, expiry after wallet reservation, duplicate callbacks, and expired hold payment attempts.
- Frontend unit tests for server-shape transformations and removal of local final pricing.

## Documentation

Update affected documentation:

- `docs/ai/*`
- `docs/adrs/*`
- `docs/specs/02-API-SPECIFICATION.md`
- `docs/specs/01-DATABASE-SCHEMA.md`
- `README.md`, `server/README.md`, `web/README.md`, `llms.txt`
- OpenAPI spec and generated Postman collections

Add an ADR for the payment provider abstraction, booking consistency strategy, and the decision to use existing booking/payment/wallet records instead of a separate audit event store or lifecycle logging layer.
