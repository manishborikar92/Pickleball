# 03-IMPLEMENTATION-STATUS

This document tracks the actual implementation status of all features defined in the product specifications.

---

## 1. Feature Status Summary

We classify codebase features using the following lifecycle states:
- **Built**: Fully implemented, unit/integration tested, and verified against design specifications.
- **Partial**: Core backend or database components are complete, but frontend UI views or validation logic remain pending.
- **Planned**: Described in specifications, but codebase structures do not yet exist.
- **Deferred**: Postponed for future development cycles.

| Feature Module | Status | Target Specification | Mapped Directory |
|---|---|---|---|
| Customer Auth (OTP) | **Built** | `docs/product/02-BUSINESS-LOGIC.md` | `server/src/modules/auth` |
| Optimistic Proxy + Proactive Refresh | **Built** | `docs/product/03-UI-UX-SPECIFICATION.md` | `web/proxy.js` |
| Data Access Layer + Authz Boundary | **Built** | `docs/plans/web-modernization/` | `web/src/lib/dal` |
| Server Actions (mutations, route-independent) | **Built** | `docs/plans/web-modernization/` | `web/src/lib/actions` |
| Customer Profiles | **Built** | `docs/product/02-BUSINESS-LOGIC.md` | `server/src/modules/users` |
| Admin Auth (Credentials) | **Built** | `docs/product/02-BUSINESS-LOGIC.md` | `server/src/modules/auth` |
| Scheduling & Hours | **Built** | `docs/product/02-BUSINESS-LOGIC.md` | `server/src/modules/venues` |
| Slot Locking Engine | **Built** | `docs/product/02-BUSINESS-LOGIC.md` | `server/src/modules/bookings` |
| Payment Abstraction | **Built** | `docs/adrs/ADR-004-booking-lifecycle-payments.md` | `server/src/modules/payments` |
| Sandbox Payment Provider | **Built** (test-only) | `docs/adrs/ADR-004-booking-lifecycle-payments.md` | `server/src/modules/payments/sandbox-payment.provider.js` |
| PhonePe Payments | **Built** | `docs/integrations/02-PAYMENT-INTEGRATION.md` | `server/src/modules/payments/phonepe-payment.provider.js` |
| Wallet Transaction Logic | **Built** | `docs/product/02-BUSINESS-LOGIC.md` | `server/src/modules/users` |
| Reviews & Moderation | **Built** | `docs/product/01-PROJECT-OVERVIEW.md` | `server/src/modules/reviews` |
| Reward Engine (Scratch Cards & Vouchers) | **Built** | `docs/adrs/ADR-010-rewards-module.md` | `server/src/modules/rewards` |
| Scheduled Notifications (Reminders + Review Requests) | **Built** (delivery pending Meta) | `docs/adrs/ADR-011-notifications-module.md` | `server/src/modules/notifications` |

---

## 2. Detailed Implementation Checklists

### 2.1 Customer Authentication & Onboarding (Built)
- [x] **OTP Dispatch Service**: Dispatches random 6-digit verification codes using Meta Business API calls. Configured inside `server/src/modules/auth/otp.provider.js`.
- [x] **Rate Limit Cooldowns**: Blocks subsequent OTP requests for 60 seconds. OTP holds expire after 10 minutes.
- [x] **Profile Creation**: Customer entries are auto-generated upon verifying OTP.
- [x] **In-Context Authentication**: Login modal holds consecutive slot parameter state variables.
- [x] **Onboarding Redirects**: Forces redirect to `/onboarding` if profile properties are missing.
- [x] **Token Rotation**: The access token is refreshed proactively in `web/proxy.js` at the edge (before the render) and, as a fallback for authenticated Server Action calls, on a 401 inside `web/src/lib/dal/httpClient.js`. Role/permissions derive from `/users/me`, not a cookie.

### 2.2 Admin Authentication & Management (Partial)
- [x] **Email & Password Guards**: Restricts dashboard panels to admins.
- [x] **Lockout Logic**: Temporarily blocks admin credentials after 10 consecutive invalid logins.
- [ ] **Provisioning Engine**: Invite-only registration flow. (*Planned*)
- [ ] **Reset Flows**: Password reset token mailers. (*Planned*)

### 2.3 Booking & Scheduling Engine (Built)
- [x] **Hours Template Manager**: Core venue/court/schedule models.
- [x] **Slot Grid Generator**: Merges templates and exception calendars to generate live availability in the Venues service.
- [x] **PostgreSQL Hold Lock**: Reserves slots inside transactions, guarded by partial unique index constraints.
- [x] **Expiry Daemon**: Background sweeper script (`cleanup-expired-records.mjs`) and lazy hold expiration on payment initiation.
- [x] **Session-Range Slot Selection (web)**: All slot-grid clicks run through the pure `reduceSlotClick` reducer (`web/src/lib/bookingEngine.js`) — one shared time range mirrored across every selected court (asymmetric selections are unrepresentable), jump-fill to a distant slot with auto-selected intermediates, and proactive 12-slot / 8-court session caps mirroring the backend Joi validators. Shared-availability start times (`getSharedAvailableSlotTimes`) render an accent-border highlight on slots open across all courts.
- [x] **Commit-on-Confirm Checkout (web)**: Nothing is reserved during review; `checkoutBookingAction` runs hold → waiver → initiate-payment in one server pass at the final Confirm & Pay click (`runCheckout` in `web/src/lib/services/checkout.js`). From the commit, `useCountdown` drives a live 10-minute payment-window countdown; the hold + checkout-view snapshot persist in `sessionStorage` so a cancelled gateway popup, closed modal, or reload can resume the same payment (`confirmHeldBookingAction` — the backend reuses the initiated payment order). Expiry (client-observed or 410 `BOOKING_EXPIRED`) releases local state and returns the user to the grid.

### 2.4 Payments & Webhooks (Built)
- [x] **Neutral Payment Provider Abstraction**: Isolated 3-method interface (`createPaymentOrder`, `getPaymentStatus`, `refundPayment`) under `server/src/modules/payments/payment-provider.js`.
- [x] **Sandbox Payment Gateway**: Test-only provider facilitating mock checkouts. Only used when `NODE_ENV=test`.
- [x] **PhonePe PG v2 Provider**: Production payment provider (`phonepe-payment.provider.js`) using raw `fetch` with OAuth token management, 5xx retry, and 401 token refresh. Each gateway attempt receives a fresh 34-character merchant order ID with 64 bits of cryptographic entropy, so retries never reuse a PhonePe order.
- [x] **Shared Provider Factory**: Single `provider-factory.js` creates provider once, shared between bookings (initiation) and payments (reconciliation) modules.
- [x] **PhonePe Webhook Handler**: S2S callback controller with SHA256 auth verification, immediate 200 response, and async event processing.
- [x] **Frontend Redirect Landing + Verification**: PhonePe and sandbox return to `/booking/redirect`; its themed interstitial uses a Server Action to call the public JSON `GET /payments/verify` endpoint server-to-server. The endpoint resolves the exact payment-ledger ID before calling PhonePe, processes terminal states idempotently, and falls back to the booking page with `UNKNOWN` when the gateway is unavailable. No backend-hosted browser-redirect route is exposed.
- [x] **Background Reconciliation Job**: `scripts/reconcile-stale-payments.mjs` recovers missing webhooks for payments stuck >15 minutes.

### 2.5 Wallet & Cancellations (Built)
- [x] **Wallet Credits Schema**: Prisma balance tracks (`User.walletCredits`).
- [x] **Refund Credit workflows**: Transactions reserve credits at initiation and roll back credits to user wallets immediately upon hold expiration.

### 2.6 Reviews (Built)
- [x] **Review Submission API**: `POST /reviews` records a 1–5 rating and optional comment for the caller's own **completed** booking; enforces ownership, completion, and one-review-per-booking (unique `booking_id`).
- [x] **Public Venue Listing**: `GET /reviews?venue_id=` returns published reviews (newest first) plus an aggregate rating summary, paginated.
- [x] **Owner Self-Lookup**: `GET /reviews/me?booking_id=` returns the caller's own review for a booking.
- [x] **Moderation Listing**: `GET /reviews/moderation?venue_id=` returns all reviews (published + unpublished) with reviewer/booking detail, gated by the `manage_bookings` venue permission.
- [x] **Moderation Action**: `PATCH /reviews/:reviewId` publishes/unpublishes a review; authorization resolved in the service against the review's own `venue_id`.
- [x] **Review Page Lifecycle (web)**: `/review/[bookingId]` resolves its state server-side via `web/src/lib/services/reviewStatus.js` (sibling of `bookingStatus.js`) — sign-in gate with `?next=` restoration, onboarding redirect, ownership/eligibility guards, already-reviewed submitted state, and the form (with real court/venue/session context from the booking) only when submittable. Own review read via `getMyBookingReview` in `web/src/lib/dal/reviews.js`.
- [x] **Tests**: `tests/unit/reviews-service.test.js` and `tests/integration/review-routes.test.js` (server); `web/tests/review.test.js` (lifecycle state machine + review normalizer); OpenAPI + Postman coverage.
- [ ] **Photo Uploads**: `photo_url` reserved in schema; awaiting Cloudflare R2 integration. (*Deferred*)

### 2.7 Rewards (Built)
- [x] **Atomic Issuance**: A `rewardIssuance` service is injected into the bookings repository and runs inside all three booking-confirmation transactions (`confirmWalletOnlyPayment`, `confirmProviderPayment`, `confirmBooking`) — a booking is never confirmed without its reward instances. Duplicate webhook/redirect signals are absorbed by the `(booking_id, mechanism_id)` unique constraint.
- [x] **Weighted Prize Draw**: Server-side cumulative-probability draw over `config.prizes` at issuance; the outcome and a frozen `config_snapshot` are stored and never serialized to the client until reveal.
- [x] **Reveal API**: `POST /rewards/instances/:id/reveal` validates ownership (404), pending status (409 `REWARD_ALREADY_REVEALED`), and expiry (410 `REWARD_EXPIRED`, with lazy expiry for sweeper lag). A status-guarded `updateMany` makes concurrent reveals first-wins.
- [x] **Voucher Fulfillment**: Prizes are external offer vouchers (`no_prize` | `voucher` — never wallet credits, per ADR-010). At reveal, a unique `RWD-XXXXXXXX` code and `validity_days` redemption window are stamped atomically in the reveal transaction.
- [x] **Staff-Tracked Redemption**: `PATCH /rewards/instances/:id/redeem` (`manage_bookings`, service-resolved venue) marks a voucher redeemed; the `redeemed_at IS NULL` guard prevents double-honoring. Errors: `VOUCHER_NOT_REDEEMABLE`, `VOUCHER_ALREADY_REDEEMED`, `VOUCHER_EXPIRED`.
- [x] **Mechanism Management API**: `GET/POST /rewards/mechanisms` + `PATCH /rewards/mechanisms/:id` gated by `edit_pricing`; probability-sum, prize-shape, and validity-window validation in `rewards.validators.js`. A sample scratch-card mechanism ships **active** in `prisma/seed.mjs`, so the flow works end-to-end after seeding.
- [x] **Moderation Listing**: `GET /rewards/instances/moderation` (`manage_bookings`) with status/mechanism/voucher-code/redeemed filters, paginated; `PATCH /rewards/instances/:id/expire` for manual expiry.
- [x] **Expiry Sweeper**: `sweep-expired-reward-instances` scheduler job (`server/src/server.js`) backed by a partial index on pending instances.
- [x] **Overlay Reveal UI (web)**: `RewardExperience` (`web/src/components/features/rewards/`) owns the flow — on the booking-confirmation page the scratch overlay auto-presents once (~650ms after arrival; bottom sheet on mobile, centered dialog on desktop; top-right close icon, Escape/backdrop close, focus trap via `useOverlay`); closed unscratched, a tappable foil teaser card persists in the right panel above the map and reopens the overlay. The overlay is projected under `document.body` via the shared SSR-safe `Portal` component (`web/src/components/shared/Portal.js`) so no ancestor CSS containment context (transform/overflow/contain) can clip or misposition the fixed-position dialog. The scratch surface (`RewardReveal`) is payment-app-grade: painted canvas foil (gradient, diagonal pattern, sparkles, "SCRATCH & WIN" plate, sheen sweep), interpolated `destination-out` strokes with coalesced pointer events, ~55% coverage auto-clear with a foil fade-out, haptic ticks (`navigator.vibrate`), and a `canvas-confetti` burst on wins (`disableForReducedMotion`, dynamically imported). The gesture is cosmetic — an explicit "Reveal without scratching" button serves keyboard/AT/reduced-motion users, and the outcome is always the server's pre-computed fact.
- [x] **My Rewards Page (web)**: `/dashboard/rewards` groups instances into "Ready to Scratch" (foil teaser cards opening the same scratch overlay) and Past (won with live voucher state / no-prize / expired) per UX spec §3.3; the "🎁 Scratch Card waiting!" badge on My Bookings links here.
- [x] **Admin Rewards Panel (web)**: `/admin/rewards` (route permission `manage_bookings`) — Redemption Desk (voucher-code lookup → verify → mark redeemed with optional note), Mechanisms panel (create/edit scratch-card prize pools with live probability-sum feedback, pause/activate; visible only with `edit_pricing`), and an Issued Rewards table (search/filter, per-row redeem/expire).
- [x] **Scratch-Card Mechanism Configuration**: `rewardMechanismSchema` configures `type: "scratch_card"` and the mechanism editor shows the experience field.
- [x] **Tests**: `tests/unit/rewards-service.test.js` and `tests/integration/reward-routes.test.js` (server); `web/tests/rewards.test.js` (normalizers, mechanism-editor schema, date helpers); OpenAPI + Postman coverage.
- [ ] **WhatsApp Reward Notification**: Deferred with the rest of marketing messaging. (*Deferred*)

### 2.8 Promotions & Coupons (Partial)
- [x] **Checkout Discounting**: The booking price quote resolves a valid coupon by code (active + validity-window filtered) and applies a flat or percentage discount to the subtotal in `booking-pricing.service.js`.
- [x] **Promo Code Provisioning Tool**: `scripts/create-promo-code.mjs` (`npm run promo:create`) creates a `coupons` record with full input validation, discount-bound and validity-window rules, UPPERCASE normalization, and duplicate/unknown-venue rejection. Self-contained (Prisma-direct), in the style of `prisma/seed.mjs`.
- [ ] **Admin Coupon Management API**: Create/list/deactivate endpoints. When built, coupon logic should join the pricing domain in the venues module (gated by `edit_pricing`) and the script becomes a thin client. (*Planned*)
- [ ] **Usage Enforcement**: `coupon_usages` recording and `max_uses_total` / `max_uses_per_phone` cap enforcement at redemption. (*Planned*)

### 2.9 Scheduled Notifications (Built — delivery pending Meta)
Implements the T-24h/T-2h reminders and post-session review requests of `docs/product/02-BUSINESS-LOGIC.md` §8 (ADR-011).
- [x] **PostgreSQL Outbox + In-Process Dispatcher**: A `notifications` table (idempotency `UNIQUE(booking_id, type)`, `(status, scheduled_for)` index) is the outbox; the existing `core/scheduler.js` runs a `dispatch-due-notifications` job that claims due rows atomically (`scheduled → sending`), re-checks booking eligibility at dispatch time, retries with backoff, and dead-letters at `maxAttempts`. No BullMQ/pg-boss, no Redis — see ADR-011 for why.
- [x] **Planner Injected at Confirm**: A `notificationPlanner` service is injected into the bookings repository and runs inside all three confirm transactions (`confirmWalletOnlyPayment`, `confirmProviderPayment`, `confirmBooking`), scheduling reminder (`reminder_t24`, `reminder_t2h` from the session-start UTC) and review (`review_request` at session-end UTC) rows atomically. Phantom/force-expired payments schedule nothing; duplicate confirms are absorbed by the unique constraint.
- [x] **Eligibility Re-check at Dispatch**: Reminders send while `confirmed|walk_in`, `skipped` if the session already ended, `cancelled` if voided; the review request sends only once `completed` (released back to `scheduled` while the completion sweeper catches up, giving up after a 48h max delay).
- [x] **Transport Abstraction (Dry-Run by Default)**: `notifications.transport.js` generalizes the OTP-provider pattern — dry-run (log + `provider: 'dry_run'`) until `NOTIFICATIONS_TRANSPORT_MODE=live` and the three approved templates are configured, then POSTs the utility template to the Meta Graph API. Scheduling/business logic never call the transport directly.
- [x] **Review Link**: The review request carries the absolute link `${FRONTEND_BASE_URL}/review/{bookingId}` (the existing owner-verified review page).
- [x] **Admin Toggles + API**: `GET/PATCH /notifications/settings` (`manage_venues`) upsert per-venue `reminders_enabled` / `review_requests_enabled` (both default off; a `notification_settings` row is seeded off). `GET /notifications/log` (`manage_bookings`) is the paginated dispatch log + per-status summary.
- [x] **Admin Settings UI (web)**: `/admin/settings` (previously a read-only stub) renders the two toggles as accessible `role=switch` controls (`SettingsView.js`, via `updateNotificationSettingsAction`) plus a recent-activity panel (manage_bookings), following the rewards admin pattern.
- [x] **Config + Validation**: `notifications` config section in `env.js` (transport mode, template names/languages, max attempts, dispatch limit); production build validation requires the WhatsApp credentials + all three templates when `NOTIFICATIONS_TRANSPORT_MODE=live`.
- [x] **Tests**: `tests/unit/notifications-{time,transport,planner,service}.test.js`, `tests/integration/notifications-{routes,booking-confirm}.test.js` (schedules on genuine confirm, not phantom; idempotent; respects toggles), dispatcher wiring in `tests/unit/scheduler-services.test.js`, and `web/tests/notifications.test.js` (normalizers + schemas). OpenAPI + Postman coverage.
- [ ] **Live Meta WhatsApp Delivery**: Awaits Meta credentials + approved `reminder_t24`/`reminder_t2h`/`review_request` templates + `NOTIFICATIONS_TRANSPORT_MODE=live` + enabling the toggles. (*Deferred — Meta setup, ~30 days*)
- [ ] **Admin "Retry" for Dead-Lettered Rows**: A failed notification stays queryable in the log; flipping `failed → scheduled` to retry manually is a follow-up, not core scope. (*Follow-up*)

---

## 3. Specification-to-Code Divergences

Divergences represent technical modifications made during implementation to solve security, scaling, or routing challenges. Entries 4–5 are historical implementation notes: on 2026-07-21 the product documents were reconciled to the voucher-only, overlay-first implementation and now classify their former prize and standalone-route proposals as historical design records.

1. **Query-String Destination Redirects**:
   - *Specification*: `03-UI-UX-SPECIFICATION.md` does not specify redirection behaviors for users returning to the checkout booking process from onboarding screens.
   - *Codebase Reality*: The edge router handles onboarding routing dynamically by checking search queries `?next=/booking`. It redirects users back to checkout after onboarding is completed.
2. **JWT Subject Role Scoping**:
   - *Specification*: Permissions are listed as database-query rules.
   - *Codebase Reality*: Querying PostgreSQL tables on every incoming request is inefficient. Role maps are cached inside the JWT subject payload, reducing query IOPS.
3. **Reward Management Routes Under `/rewards` (not `/admin`)**:
   - *Specification*: `02-API-SPECIFICATION.md` originally placed reward management under `/admin/venues/:id/reward-mechanisms` and `/admin/reward-instances`.
   - *Codebase Reality*: No `/admin` route namespace exists in the backend — "admin" is an authorization concern (ADR-007), not a module. Reward management lives under `/rewards` with per-route `edit_pricing` / `manage_bookings` guards, mirroring ADR-009's reviews-moderation precedent. The API spec has been updated to the built paths (ADR-010).
4. **Voucher-Only Reward Prizes**:
   - *Specification*: `02-BUSINESS-LOGIC.md` §12.5 defines `wallet_credit`, `coupon`, and `free_booking` prize fulfillment.
   - *Codebase Reality*: Product direction (2026-07-16) requires rewards to be external offer vouchers (venue F&B stall etc.) with staff-tracked redemption — rewards never touch wallet credits. `PrizeType` is `no_prize | voucher`; the fulfillment columns were reshaped (`voucher_code`, `voucher_valid_until`, `redeemed_at`, `redemption_note`). The PO-owned product document §12.5 still shows the old prize table; the authoritative model is ADR-010 and `01-DATABASE-SCHEMA.md` Domain F. Pending PO sign-off to update §12.5.
5. **Overlay Reward Reveal (no `/rewards/[instanceId]` route)**:
   - *Specification*: `03-UI-UX-SPECIFICATION.md` §3.4 describes a standalone scratch-card screen at `/rewards/[instanceId]`.
   - *Codebase Reality*: Product direction (2026-07-16) requires the reveal to happen in context, like payment/booking apps: the scratch overlay auto-presents once on the booking-confirmation page and, if dismissed unscratched, persists as a tappable foil teaser card in the right panel above the map (`RewardExperience`); the same teaser/overlay pair powers `/dashboard/rewards`. No standalone reveal route exists; the "Scratch Card waiting!" badge links to `/dashboard/rewards`. The PO-owned UX document §3.4 still shows the routed screen; the authoritative shape is ADR-010's frontend revision. Pending PO sign-off to update §3.4.
