# Booking Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready, API-driven Booking module with transactional holds, server-authoritative pricing, sandbox payment abstraction, wallet support, waiver compliance evidence, observability, tests, and documentation.

**Architecture:** Add focused backend modules for venues, bookings, and payments using the existing Express controller/service/repository/Joi pattern. Venue availability remains inside the `venues` module because it is derived from venue courts, schedules, exceptions, pricing rules, and booking slots. Keep booking services provider-agnostic by using a payment provider interface. Replace frontend fixture-backed booking behavior with server APIs. Do not add audit-specific or lifecycle-logging infrastructure; waiver compliance is stored on bookings, request/error logging remains platform-level, and operational traceability comes from booking/payment/wallet records.

**Tech Stack:** Express 5, Prisma 7/PostgreSQL, Joi, native `node:test`, Supertest, Next.js App Router, React, server actions/fetch wrappers.

---

### Task 1: Venue Availability APIs

**Files:**
- Create: `server/src/modules/venues/*`
- Modify: `server/src/routes/index.js`
- Test: `server/tests/unit/availability-service.test.js`
- Test: `server/tests/integration/venue-availability-routes.test.js`

- [ ] Write failing tests for `GET /venues/:venueId`, `GET /venues/slug/:slug`, and `GET /venues/:venueId/availability?date=YYYY-MM-DD`.
- [ ] Write failing tests for date-window validation, closed exceptions, modified hours, active bookings subtraction, and price-per-unit output.
- [ ] Implement schedule slot generation and status mapping.
- [ ] Implement base price plus pricing-rule calculation for availability unit prices.
- [ ] Wire public routes.
- [ ] Run targeted unit/integration tests.

### Task 2: Booking Pricing and Selection Validation

**Files:**
- Create: `server/src/modules/bookings/booking-pricing.service.js`
- Create: `server/src/modules/bookings/booking-selection.service.js`
- Create: `server/src/modules/bookings/bookings.validators.js`
- Test: `server/tests/unit/booking-pricing.test.js`
- Test: `server/tests/unit/booking-selection.test.js`

- [ ] Write failing tests for consecutive slot validation, invalid courts, inactive courts, outside booking window, missing generated slots, and server-authoritative quote output.
- [ ] Write failing tests for flat/percentage coupon application and stale/client-manipulated price rejection by omission: client-provided totals are not accepted in schemas.
- [ ] Implement selection validation and pricing services.
- [ ] Run targeted unit tests.

### Task 3: Hold Creation, Concurrency, and Lifecycle

**Files:**
- Create: `server/src/modules/bookings/bookings.repository.js`
- Create: `server/src/modules/bookings/bookings.service.js`
- Create: `server/src/modules/bookings/bookings.controller.js`
- Create: `server/src/modules/bookings/bookings.routes.js`
- Create: `server/src/modules/bookings/index.js`
- Create: `server/src/middleware/require-onboarding.middleware.js`
- Modify: `server/src/routes/index.js`
- Test: `server/tests/unit/booking-lifecycle.test.js`
- Test: `server/tests/integration/booking-routes.test.js`

- [ ] Write failing tests for `POST /bookings/price-preview`.
- [ ] Write failing tests for `POST /bookings/hold` success and hold-limit rejection.
- [ ] Write failing tests for double-booking conflict mapping from partial unique index errors.
- [ ] Write failing concurrency test using simultaneous hold attempts against the same slot set.
- [ ] Implement lifecycle transition guard and atomic hold transaction.
- [ ] Persist hold state through booking and booking slot records; do not add booking-specific lifecycle logging infrastructure.
- [ ] Run targeted tests.

### Task 4: Expiry, Waiver, Wallet, and Payment Provider

**Files:**
- Create: `server/src/modules/payments/payment-provider.js`
- Create: `server/src/modules/payments/sandbox-payment.provider.js`
- Create: `server/src/modules/payments/payments.service.js`
- Create: `server/src/modules/payments/payments.routes.js`
- Modify: `server/src/modules/bookings/*`
- Modify: `server/scripts/cleanup-expired-records.mjs`
- Test: `server/tests/unit/payment-provider.test.js`
- Test: `server/tests/unit/wallet-flow.test.js`
- Test: `server/tests/integration/payment-booking-routes.test.js`

- [ ] Write failing tests for waiver required before payment.
- [ ] Write failing tests for wallet-only confirmation, partial wallet payment initiation, rollback on failure, duplicate success callback, and expired hold payment rejection.
- [ ] Write failing expiry tests ensuring concurrent expiry is idempotent.
- [ ] Implement sandbox provider and payment service.
- [ ] Implement `POST /bookings/:bookingId/waiver`, `POST /bookings/:bookingId/initiate-payment`, `GET /payments/status/:merchantOrderId`, sandbox callback route, and expiry script.
- [ ] Persist payment and wallet domain records; do not add booking-specific lifecycle logging infrastructure.
- [ ] Run targeted tests.

### Task 5: User Booking and Wallet APIs

**Files:**
- Modify: `server/src/modules/users/*`
- Test: `server/tests/integration/user-bookings-wallet-routes.test.js`

- [ ] Write failing tests for `GET /users/me/bookings` with status pagination and owner scoping.
- [ ] Write failing tests for `GET /users/me/wallet`.
- [ ] Implement repository/service/controller routes.
- [ ] Run targeted integration tests.

### Task 6: OpenAPI, Postman, and Backend Docs

**Files:**
- Modify: `server/src/modules/openapi/openapi.spec.js`
- Modify: `docs/specs/01-DATABASE-SCHEMA.md`
- Modify: `docs/specs/02-API-SPECIFICATION.md`
- Modify: `docs/ai/01-IMPLEMENTATION-OVERVIEW.md`
- Modify: `docs/ai/02-CODEBASE-MAP.md`
- Modify: `docs/ai/03-IMPLEMENTATION-STATUS.md`
- Modify: `docs/ai/04-ISSUES-AND-DEBT.md`
- Modify: `docs/ai/05-MAINTENANCE-RULES.md` if maintenance triggers change
- Create: `docs/adrs/ADR-004-booking-consistency-and-payment-provider.md`
- Modify: `docs/README.md`
- Modify: `README.md`
- Modify: `server/README.md`
- Modify: `llms.txt`

- [ ] Add OpenAPI schemas and paths for new APIs.
- [ ] Add route coverage test expectations.
- [ ] Update docs for architecture, lifecycle, concurrency strategy, payment abstraction, waiver compliance evidence, and operations.
- [ ] Run `npm run postman:generate` in `server`.

### Task 7: Frontend API-Driven Booking Flow

**Files:**
- Modify: `web/src/lib/api.js`
- Modify: `web/src/lib/booking-engine.js`
- Create: `web/src/services/bookingService.js`
- Modify: `web/src/components/features/booking/*`
- Modify: `web/src/app/(public)/venues/[slug]/book/page.js`
- Modify: `web/src/components/features/dashboard/DashboardViews.js`
- Test: `web/tests/core.test.js`

- [ ] Write failing frontend tests for server response normalization and no local final-price calculation.
- [ ] Replace fixture availability/venue calls with server APIs.
- [ ] Add loading, error, hold-expired, and payment-pending states.
- [ ] Use price preview from server.
- [ ] Create hold, record waiver, initiate sandbox payment, poll status, and route to confirmation.
- [ ] Replace dashboard bookings/wallet fixture calls with APIs.
- [ ] Run web unit tests.

### Task 8: Full Verification and Consistency Review

**Files:**
- All modified files

- [ ] Run `npm run test` in `server`.
- [ ] Run `npm run postman:generate` in `server`.
- [ ] Run `npm run test` in `web`.
- [ ] Run `npm run lint` in `web`.
- [ ] Run `npm run build` in `web`.
- [ ] Start backend and frontend dev servers if environment permits.
- [ ] Manually validate booking flow: venue load, date availability, price preview, OTP/auth gate, hold, waiver, sandbox payment, confirmation, dashboard bookings, wallet.
- [ ] Review `git diff` for TODOs, dead code, stale fixtures, broken references, and documentation consistency.
