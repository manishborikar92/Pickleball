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
| Reward Scratch Cards | **Planned** | `docs/product/01-PROJECT-OVERVIEW.md` | `server/src/modules/rewards` |

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

### 2.4 Payments & Webhooks (Built)
- [x] **Neutral Payment Provider Abstraction**: Isolated 3-method interface (`createPaymentOrder`, `getPaymentStatus`, `refundPayment`) under `server/src/modules/payments/payment-provider.js`.
- [x] **Sandbox Payment Gateway**: Test-only provider facilitating mock checkouts. Only used when `NODE_ENV=test`.
- [x] **PhonePe PG v2 Provider**: Production payment provider (`phonepe-payment.provider.js`) using raw `fetch` with OAuth token management, 5xx retry, and 401 token refresh.
- [x] **Shared Provider Factory**: Single `provider-factory.js` creates provider once, shared between bookings (initiation) and payments (reconciliation) modules.
- [x] **PhonePe Webhook Handler**: S2S callback controller with SHA256 auth verification, immediate 200 response, and async event processing.
- [x] **PhonePe Redirect Handler**: Post-payment browser redirect with Order Status API verification and idempotent processing.
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
- [x] **Tests**: `tests/unit/reviews-service.test.js` and `tests/integration/review-routes.test.js`; OpenAPI + Postman coverage.
- [ ] **Photo Uploads**: `photo_url` reserved in schema; awaiting Cloudflare R2 integration. (*Deferred*)

### 2.7 Rewards (Planned / Deferred)
- [ ] **Reward Configs**: Scans and dispenses pre-calculated Reward instances.
- [ ] **Scratch Canvas UI**: Interactive HTML5 scratch-off canvas components.
- [ ] **Spinner Wheel**: Wheel interactive layouts. (*Deferred*)

### 2.8 Promotions & Coupons (Partial)
- [x] **Checkout Discounting**: The booking price quote resolves a valid coupon by code (active + validity-window filtered) and applies a flat or percentage discount to the subtotal in `booking-pricing.service.js`.
- [x] **Promo Code Provisioning Tool**: `scripts/create-promo-code.mjs` (`npm run promo:create`) creates a `coupons` record with full input validation, discount-bound and validity-window rules, UPPERCASE normalization, and duplicate/unknown-venue rejection. Self-contained (Prisma-direct), in the style of `prisma/seed.mjs`.
- [ ] **Admin Coupon Management API**: Create/list/deactivate endpoints. When built, coupon logic should join the pricing domain in the venues module (gated by `edit_pricing`) and the script becomes a thin client. (*Planned*)
- [ ] **Usage Enforcement**: `coupon_usages` recording and `max_uses_total` / `max_uses_per_phone` cap enforcement at redemption. (*Planned*)

---

## 3. Specification-to-Code Divergences

Divergences represent technical modifications made during implementation to solve security, scaling, or routing challenges:

1. **Query-String Destination Redirects**:
   - *Specification*: `03-UI-UX-SPECIFICATION.md` does not specify redirection behaviors for users returning to the checkout booking process from onboarding screens.
   - *Codebase Reality*: The edge router handles onboarding routing dynamically by checking search queries `?next=/booking`. It redirects users back to checkout after onboarding is completed.
2. **JWT Subject Role Scoping**:
   - *Specification*: Permissions are listed as database-query rules.
   - *Codebase Reality*: Querying PostgreSQL tables on every incoming request is inefficient. Role maps are cached inside the JWT subject payload, reducing query IOPS.
