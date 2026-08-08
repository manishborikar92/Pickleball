# Coupon Usage Tracking and Limit Enforcement — Design

Date: 2026-08-08

## Context and current-state findings

The repository is a two-application monorepo:

- `server/` is the Express 5 REST API, Prisma/PostgreSQL data layer, booking domain, payment orchestration, scheduler, and external integration boundary.
- `web/` is the Next.js App Router client. It uses server-side DAL functions and Server Actions for API calls; it does not calculate authoritative prices or booking state.

The current coupon flow is:

1. `POST /api/v1/bookings/price-preview` validates a selection and asks the bookings service to build a server-side quote.
2. `bookings.repository.getHoldContext()` loads an active, date-valid coupon scoped to the venue or platform.
3. `booking-pricing.service.js` applies the coupon after dynamic unit pricing and before tax.
4. `POST /api/v1/bookings/hold` recalculates the quote and persists `booking.couponId` in a `pending_payment` booking.
5. The checkout flow accepts the waiver and then either confirms a wallet-only payment or initiates a provider payment.
6. Provider callbacks confirm the booking in `confirmProviderPayment()`; scheduled jobs and administrative/test paths can also call `confirmBooking()`.

The schema already contains `coupons` and `coupon_usages`, including the `(coupon_id, phone)` index. No runtime path currently counts usages or writes a usage row. The existing documentation also contains a reference mismatch: the audit cites product document §6.2 as “Usage Limits”, while the current product document §6.2 is the duplicate-payment-webhook rule. The usage-limit rule is nevertheless explicit in the audit, database specification, API error catalog, and implementation-status document.

The baseline is clean before this feature: server 258/258 tests pass and web 94/94 tests pass.

## Requirements and invariants

- A successful coupon redemption creates exactly one `coupon_usages` row with `coupon_id`, `booking_id`, `user_id`, `phone`, and `used_at`.
- The row is created only when the booking becomes genuinely `confirmed`; expired, failed, cancelled, and late-payment bookings never consume a coupon.
- `max_uses_total = NULL` means no global cap.
- `max_uses_per_phone` is enforced for the user’s normalized phone. The value is required by the existing schema and CLI defaults to one.
- Limits are inclusive: a quote is allowed while `current_count < limit` and rejected when `current_count >= limit`.
- A confirmation transaction must re-check limits even if the earlier quote was allowed. Quote-time checks are advisory and cannot alone protect against concurrent confirmations.
- Repeated confirmation signals are idempotent and cannot create a second usage for the same booking.
- Coupon-limit failures use the existing API error envelope and the documented stable code `COUPON_LIMIT_REACHED`, with a non-sensitive scope (`total` or `phone`).
- No new coupon CRUD/admin API is part of this feature. Existing admin route documentation is a separate partial/missing feature and remains deferred.

## API design review decision

The current API has a few intentionally action-oriented routes (`/price-preview`, `/hold`, `/waiver`, `/initiate-payment`) and historical documentation for an `/admin/...` namespace that is not implemented. The codebase’s newer modules (reviews, rewards, notifications) establish the stronger convention: domain-owned routes with venue-scoped authorization, rather than an admin namespace that duplicates resource ownership.

For this feature:

- Preserve the existing booking routes for backward compatibility.
- Do not add a parallel `/admin/coupons` endpoint or refactor unrelated APIs.
- Treat coupon usage enforcement as a booking-domain invariant, not as a client or admin concern.
- Return `COUPON_LIMIT_REACHED` from the existing quote/hold/confirmation workflow. This is a behavior extension of existing contracts, not a route change.
- Update OpenAPI and API documentation to describe the new error behavior. Defer coupon CRUD and pricing-rule APIs to a separately scoped venue/pricing module decision.

## Alternatives considered

### A. Recommended — quote checks plus transactional confirmation write

Load usage counts as part of the existing hold context, pass them into the pure pricing service, and check them again inside each confirmation transaction. Lock the coupon row with PostgreSQL `FOR UPDATE`, then count and insert the usage row. Add a unique `(coupon_id, booking_id)` constraint for idempotency.

Pros:

- Fits the existing repository/service/transaction architecture.
- Keeps pricing calculations pure and database access in the repository.
- Protects total and per-phone caps under concurrent confirmations.
- Does not reserve usage during abandoned holds.
- Requires no new public endpoint.

Cons:

- A coupon row becomes the serialization point for concurrent redemptions of that coupon.
- An unauthenticated public preview cannot evaluate a per-phone limit; the authenticated hold and confirmation checks remain authoritative.

### B. Reserve usage during hold creation

Create a provisional usage/reservation record when a hold is created and finalize or release it during payment.

Rejected because it changes the documented meaning of `coupon_usages` (a redemption audit), adds cleanup/recovery states, consumes limited coupons during abandoned holds, and creates more race/reconciliation paths than the existing hold lifecycle needs.

### C. Database trigger or stored procedure

Move all count, lock, and insert logic into a PostgreSQL trigger/procedure.

Rejected because the application currently centralizes booking transitions in repository transactions, Prisma migrations are the schema source of truth, and trigger behavior would be harder to exercise through the project’s existing unit/integration test conventions.

## Recommended architecture and data flow

### Quote calculation

`bookings.service.buildValidatedQuote()` passes the authenticated `userId` when available to `getHoldContext()`.

`bookings.repository.getHoldContext()`:

- continues to filter coupons by active state, deletion state, venue scope, and validity window;
- loads total usage count for the coupon;
- loads per-phone count when a user is available;
- returns the counts as a small `couponUsage` context object.

`booking-pricing.service.buildQuote()` calls a pure coupon-limit assertion before applying the discount. Public unauthenticated previews enforce the global cap and leave the per-phone assertion to the authenticated hold/confirmation path. The API route remains public, so existing anonymous browsing still works.

The hold path always passes `userId`, so it performs both checks before creating the pending booking. The booking stores only `couponId`; the discount and the eventual usage audit remain tied to the server-calculated booking.

### Confirmation transaction

Create a small bookings-domain coupon-usage policy module with pure limit/error logic. The repository owns persistence:

1. In the same transaction that changes the booking to `confirmed`, lock the referenced coupon row with `FOR UPDATE`.
2. Check whether this booking already has a usage row; if so, treat the operation as idempotent.
3. Count total and phone usages and apply the pure policy assertion.
4. Insert `coupon_usages` with the booking’s user phone and current timestamp.
5. Continue the existing slot confirmation, reward issuance, and notification outbox work.

The usage insert is performed before the booking/slot confirmation side effects so any limit or data-integrity error rolls back the complete confirmation transaction.

This helper is called from wallet-only confirmation, provider confirmation, and the existing generic `confirmBooking()` path. It is deliberately not called by expiry or payment-failure paths.

For a provider callback that has already been paid but loses a coupon-limit race, the transaction marks the payment successful, expires the booking and slots without inserting a usage row, and returns a typed result. The existing late-payment reconciliation callback is invoked for that result so wallet credits are restored and the gateway amount is refunded through the existing idempotent reconciliation flow.

### Database integrity

- Add Prisma `@@unique([couponId, bookingId])` to `CouponUsage`.
- Add a forward-only migration creating the matching unique index.
- Keep the existing `(coupon_id, phone)` index for per-phone counts.
- No table recreation or destructive data cleanup is required. Deployment documentation will include a duplicate preflight query for environments that may contain manually inserted legacy rows.

### Frontend behavior

The existing quote and checkout UI already displays backend messages and blocks checkout on quote errors. The web transport will preserve a backend `data.code` when present, so the stable coupon error is not reduced to generic `bad_request`. Checkout error mapping will provide a coupon-specific message. When quote-time enforcement rejects an applied coupon, the user can remove/reapply it without a stale success state; no new route or component is necessary.

### Observability and security

- Never trust a client-supplied price, phone, count, or usage result.
- Derive the phone from the authenticated `User` row and store the same server value in the usage record.
- Scope coupon lookup to the requested venue or a platform-wide coupon; do not expose usage counts in public responses.
- Emit structured warning information for limit rejection without logging the customer phone.
- Preserve current ownership checks, onboarding checks, and payment idempotency behavior.
- Keep usage creation and booking confirmation atomic with rewards and notifications, as required by the existing transaction design.

## Testing strategy

1. Pure policy unit tests: unlimited caps, total cap boundaries, per-phone cap boundaries, and error scope.
2. Pricing unit tests: total and per-phone usage rejection before discount application.
3. Repository integration tests with PostgreSQL: usage creation for wallet/provider/generic confirmation, no row for expiry/failure, duplicate confirmation idempotency, phone and global cap enforcement, and concurrent confirmations.
4. Booking service/API tests: user identity is threaded into quote context, stable error envelope/code is returned, and a rejected wallet confirmation does not leave a charged or confirmed booking.
5. Provider reconciliation tests: coupon-limit races expire the booking and trigger the existing late-payment refund path.
6. Web tests: transport preserves backend error codes and checkout maps the coupon-limit error to the user-facing state.
7. Run the complete existing server and web suites, Prisma generation, lint/build checks available in the repository, and targeted integration/concurrency tests.

## Documentation impact

After implementation, update only documentation supported by the final code:

- database schema and migration notes;
- API specification/OpenAPI error behavior;
- business logic usage-limit wording, correcting the stale section reference;
- AI implementation status and codebase map/maintenance notes;
- audit item 4.3 and end-user gap analysis status;
- an ADR if the final locking/idempotency decision adds a durable architectural precedent;
- `llms.txt` and any support/runbook sections that describe coupon behavior;
- Postman generation inputs only if the API contract changes (no new route is expected).

No frontend coupon-admin documentation will be marked complete because coupon CRUD remains outside this feature.

## Decision requested

Proceed with Alternative A, preserving the existing APIs and adding transactional usage enforcement, or select a different alternative before implementation begins.
