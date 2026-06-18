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
| Edge Route Proxy | **Built** | `docs/product/03-UI-UX-SPECIFICATION.md` | `web/proxy.js` |
| Customer Profiles | **Built** | `docs/product/02-BUSINESS-LOGIC.md` | `server/src/modules/users` |
| Staff Auth (Credentials) | **Built** | `docs/product/02-BUSINESS-LOGIC.md` | `server/src/modules/auth` |
| Scheduling & Hours | **Built** | `docs/product/02-BUSINESS-LOGIC.md` | `server/src/modules/venues` |
| Slot Locking Engine | **Built** | `docs/product/02-BUSINESS-LOGIC.md` | `server/src/modules/bookings` |
| Payment Abstraction | **Built** | `docs/adrs/ADR-004-booking-lifecycle-payments.md` | `server/src/modules/payments` |
| Sandbox Payment Provider | **Built** | `docs/adrs/ADR-004-booking-lifecycle-payments.md` | `server/src/modules/payments/sandbox-payment.provider.js` |
| PhonePe Payments | **Planned** | `docs/integrations/02-PAYMENT-INTEGRATION.md` | `server/src/modules/payments` |
| Wallet Transaction Logic | **Built** | `docs/product/02-BUSINESS-LOGIC.md` | `server/src/modules/users` |
| Reviews Submission | **Planned** | `docs/product/01-PROJECT-OVERVIEW.md` | `server/src/modules/reviews` |
| Reward Scratch Cards | **Planned** | `docs/product/01-PROJECT-OVERVIEW.md` | `server/src/modules/rewards` |

---

## 2. Detailed Implementation Checklists

### 2.1 Customer Authentication & Onboarding (Built)
- [x] **OTP Dispatch Service**: Dispatches random 6-digit verification codes using Meta Business API calls. Configured inside `server/src/modules/auth/otp.provider.js`.
- [x] **Rate Limit Cooldowns**: Blocks subsequent OTP requests for 60 seconds. OTP holds expire after 10 minutes.
- [x] **Profile Creation**: Customer entries are auto-generated upon verifying OTP.
- [x] **In-Context Authentication**: Login modal holds consecutive slot parameter state variables.
- [x] **Onboarding Redirects**: Forces redirect to `/onboarding` if profile properties are missing.
- [x] **Token Rotation**: Silent authentication refreshes execute rotation checks via `web/src/lib/proxy-core.js`.

### 2.2 Staff Authentication & Management (Partial)
- [x] **Email & Password Guards**: Restricts dashboard panels to staff.
- [x] **Lockout Logic**: Temporarily blocks staff credentials after 10 consecutive invalid logins.
- [ ] **Provisioning Engine**: Invite-only registration flow. (*Planned*)
- [ ] **Reset Flows**: Password reset token mailers. (*Planned*)

### 2.3 Booking & Scheduling Engine (Built)
- [x] **Hours Template Manager**: Core venue/court/schedule models.
- [x] **Slot Grid Generator**: Merges templates and exception calendars to generate live availability in the Venues service.
- [x] **PostgreSQL Hold Lock**: Reserves slots inside transactions, guarded by partial unique index constraints.
- [x] **Expiry Daemon**: Background sweeper script (`cleanup-expired-records.mjs`) and lazy hold expiration on payment initiation.

### 2.4 Payments & Webhooks (Built)
- [x] **Neutral Payment Provider Abstraction**: Isolated interface under `server/src/modules/payments/`.
- [x] **Sandbox Payment Gateway**: deterministic provider facilitating mock checkouts, status tracking, and callbacks without credentials.

### 2.5 Wallet & Cancellations (Built)
- [x] **Wallet Credits Schema**: Prisma balance tracks (`User.walletCredits`).
- [x] **Refund Credit workflows**: Transactions reserve credits at initiation and roll back credits to user wallets immediately upon hold expiration.

### 2.6 Review & Rewards (Planned / Deferred)
- [ ] **Review Ratings API**: Submits ratings.
- [ ] **Reward Configs**: Scans and dispenses pre-calculated Reward instances.
- [ ] **Scratch Canvas UI**: Interactive HTML5 scratch-off canvas components.
- [ ] **Spinner Wheel**: Wheel interactive layouts. (*Deferred*)

---

## 3. Specification-to-Code Divergences

Divergences represent technical modifications made during implementation to solve security, scaling, or routing challenges:

1. **Query-String Destination Redirects**:
   - *Specification*: `03-UI-UX-SPECIFICATION.md` does not specify redirection behaviors for users returning to the checkout booking process from onboarding screens.
   - *Codebase Reality*: The edge router handles onboarding routing dynamically by checking search queries `?next=/booking`. It redirects users back to checkout after onboarding is completed.
2. **JWT Subject Role Scoping**:
   - *Specification*: Permissions are listed as database-query rules.
   - *Codebase Reality*: Querying PostgreSQL tables on every incoming request is inefficient. Role maps are cached inside the JWT subject payload, reducing query IOPS.
