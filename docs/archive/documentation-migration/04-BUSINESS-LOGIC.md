# Pickleball Platform — Business Logic & Workflows

This document defines all business rules, state transitions, edge cases, and operational policies. The backend is the single source of truth for all logic described here. The frontend never computes prices, availability, or booking states independently.

---

## 1. Role-Based Access Control (RBAC)

### 1.1 Permission Model

Routes are guarded by **specific permissions**, not role names. The backend checks `requirePermission('edit_pricing')`, not `isAdmin`. This keeps the access control layer stable — roles can be reconfigured and new roles added without touching any route-level code.

### 1.2 Roles & Permission Matrix

Four roles are seeded at launch. `super_admin` and `customer` are actively used from day one. `manager` and `staff` are seeded but unassigned until the team grows.

| Permission | super_admin | manager | staff | customer |
|---|:---:|:---:|:---:|:---:|
| `manage_courts` | ✓ | | | |
| `edit_pricing` | ✓ | ✓ | | |
| `edit_schedule` | ✓ | ✓ | | |
| `manage_bookings` | ✓ | ✓ | ✓ | |
| `issue_credits` | ✓ | ✓ | | |
| `walk_in_entry` | ✓ | ✓ | ✓ | |
| `view_own_bookings` | ✓ | ✓ | ✓ | ✓ |

### 1.3 Contextual Venue Scoping

Roles are assigned per venue via `venue_user_roles`. At launch with a single venue, all operator accounts are assigned `super_admin` at that venue. The table structure is identical whether the platform has one venue or fifty — no schema change is needed when expanding.

All admin API queries are filtered to the venue(s) the requesting user has a role assignment for. A user with no role assignment at a venue sees it as if it does not exist.

### 1.4 Session Security

- Access tokens are short-lived JWTs.
- Refresh tokens are opaque random values stored only as hashes in PostgreSQL and delivered to browsers through HTTP-only cookies.
- Refresh tokens rotate on every successful refresh.
- Logout revokes the current auth session and active refresh token. Logout-all revokes every active session for the user.
- Reuse of a revoked refresh token is treated as a compromised session and revokes that session.

> **Architecture decision:** PostgreSQL-backed `auth_sessions` and `refresh_tokens` provide launch revocation. Redis remains a future scaling option for distributed cache/rate-limit workloads, not the primary revocation mechanism.

---

## 2. Authentication & Onboarding

The platform uses **two entirely separate authentication systems** that coexist under the same JWT verification layer:

| Dimension | Customer (OTP) | Staff (Password) |
|---|---|---|
| Roles | `customer` | `super_admin`, `manager`, `staff` |
| Login identifier | Phone number | Email address |
| Credential | WhatsApp OTP | Email + bcrypt password |
| Account creation | Self-serve (OTP flow) | Admin-provisioned (script or admin panel) |
| Entry point | Booking page auth gate | `/admin/login` page |
| Password reset | Not applicable | Email reset token (no OTP cost) |
| `staff_credentials` row | Never created | Always required |
| JWT issued | ✓ (same format) | ✓ (same format) |

Both systems issue the same access-token shape and session model. The `requireAuth` middleware is auth-method-agnostic: it verifies the JWT signature, expiry, and subject/session claims. Role resolution always comes from `venue_user_roles` to `role_permissions`, regardless of how the token was obtained.

---

### 2.1 Customer Auth — Three-Path OTP Flow

Authentication is triggered mid-funnel when a customer clicks "Confirm & Pay" on the booking page.

```
PATH A — First-time user (no account):
  Phone entry → OTP sent → OTP verified
    → users record CREATED (name = NULL, is_phone_verified = true)
    → JWT issued → next_step: "complete_onboarding"
  Name collection → POST /auth/onboarding { name }
    → users.name SET, onboarding_completed_at SET
    → next_step: "resume_booking"
  → Slot hold → Waiver → Payment

PATH B — Returning user (name already set):
  Phone entry → OTP sent → OTP verified
    → users record FOUND (name IS NOT NULL)
    → JWT issued → next_step: "resume_booking"
  → Slot hold → Waiver → Payment

PATH C — Already authenticated (valid JWT in client storage):
  GET /users/me confirms name IS NOT NULL → skip auth gate entirely
  → Slot hold → Waiver → Payment
```

**Onboarding completeness** is derived from `users.name IS NOT NULL`. `onboarding_completed_at` is a timestamp for analytics only.

### 2.2 OTP Verification — User Record Lifecycle

On `POST /auth/otp/verify`:
1. Verify OTP hash and expiry in `otp_requests`.
2. **Find or create** `users` record by phone (upsert on `phone`).
3. Set `is_phone_verified = true`.
4. Resolve `venue_user_roles` for this user to determine `next_step`:
   - Non-customer role exists → `next_step = "admin_dashboard"`
   - No name set → `next_step = "complete_onboarding"`
   - Name set → `next_step = "resume_booking"`
5. Create an `auth_sessions` row, issue a short-lived access token, and set the initial rotating refresh token cookie.

### 2.3 Name Collection — `POST /auth/onboarding`

- Requires valid JWT; does NOT require `name IS NOT NULL`.
- Atomically sets `users.name` and `users.onboarding_completed_at = NOW()`.
- Idempotent: calling again updates the name.
- Returns `next_step: "resume_booking"`.

### 2.4 Customer Onboarding Middleware

| Middleware | Check | Used on |
|---|---|---|
| `requireAuth` | Valid JWT | All authenticated routes |
| `requireOnboarding` | `requireAuth` + `users.name IS NOT NULL` | Booking hold, waiver, payment, booking history, wallet, rewards |

---

### 2.5 Staff Auth — Credential-Based Flow

#### Account Provisioning

Staff accounts are never self-registered. A super admin creates them via the admin panel or a backend script:

```
POST /admin/staff { email, name, role_id, venue_id }
  → Creates users record (name pre-set — no onboarding step for staff)
  → Creates staff_credentials record (status = 'pending_activation')
  → Assigns venue_user_roles record
  → Generates activation_token (raw), stores activation_token_hash (bcrypt)
  → Sends activation email with link:
    https://[domain]/admin/activate?token=[raw_token]
```

Activation tokens expire after **72 hours**. If expired, the super admin re-sends activation.

#### Account Activation (First-Time Password Set)

```
Staff clicks email link → /admin/activate?token=xxx
  → Frontend shows password creation form
  → POST /auth/staff/activate { token, password, password_confirm }
  → Backend bcrypt-verifies token against activation_token_hash
  → If valid and not expired:
      password_hash set, activation_token_hash cleared
      status → 'active', force_password_change = false
      JWT issued → redirect to admin dashboard
  → If expired: show "Link expired — contact your admin"
```

#### Login Flow

```
Staff navigates to /admin/login
  → Enters email + password
  → POST /auth/staff/login { email, password }
  → Backend:
      1. Find staff_credentials by email
      2. Check status: suspended → 403; locked + locked_until > NOW() → 423
      3. bcrypt.compare(password, password_hash)
      4. If fail: increment failed_login_attempts
                 if attempts ≥ 10: status = 'locked', locked_until = NOW() + 30m
         If pass: reset failed_login_attempts = 0, update last_login_at + last_login_ip
      5. If force_password_change = true: JWT issued but next_step = "force_password_change"
         Otherwise: JWT issued, next_step = "admin_dashboard"
  → JWT stored in httpOnly cookie or localStorage (admin panel decision)
  → Redirect to /admin
```

#### Password Reset Flow

```
Staff clicks "Forgot password" on /admin/login
  → Enters email → POST /auth/staff/reset-password/request { email }
  → Backend:
      Find staff_credentials by email
      If not found: respond 200 (do not reveal whether email exists — security)
      If found: generate reset_token (raw), store password_reset_token_hash (bcrypt)
               set password_reset_expires_at = NOW() + 1 hour
               Send reset email with link: /admin/reset-password?token=[raw_token]
  → Always returns 200 with generic message

Staff clicks email link → /admin/reset-password?token=xxx
  → Enters new password → POST /auth/staff/reset-password/confirm { token, password, password_confirm }
  → Backend:
      Find staff_credentials where reset token hash matches AND expires_at > NOW()
      If invalid/expired: 400 INVALID_RESET_TOKEN
      If valid:
        Set new password_hash, clear reset token fields
        Set password_changed_at = NOW()
        force_password_change = false
        JWT issued, next_step = "admin_dashboard"
```

**Note:** WhatsApp OTP is never used in the staff password reset flow. Reset is entirely email-based.

#### Security Controls

| Control | Detail |
|---|---|
| Password hashing | bcrypt, cost factor 12 |
| Minimum password length | 8 characters |
| Rate limiting | 5 login attempts per IP per 15 minutes (Express rate limiter) |
| Account lockout | 10 failed attempts → locked for 30 minutes |
| Token security | Activation and reset tokens stored as bcrypt hashes; raw tokens never persisted |
| Token expiry | Activation: 72 hours; Password reset: 1 hour |
| Force password change | Set on provision; must change before accessing any admin route |
| Suspension | Immediate effect on new logins; active sessions can be revoked through the session tables |
| HTTPS | All staff auth endpoints HTTPS only in production |

#### Account Deactivation / Suspension

```
Admin sets staff_credentials.status = 'suspended'
→ All future login attempts rejected with 403 ACCOUNT_SUSPENDED
→ Active auth sessions are revoked when the admin suspension workflow is implemented
```

---

### 2.6 Shared JWT Layer

Both customer OTP auth and staff password auth issue the same JWT format:

```json
{ "sub": "<user_id>", "sid": "<session_id>", "roles": [], "permissions": [], "exp": <epoch> }
```

The `requireAuth` middleware verifies signature, expiry, and identity claims. It does not know or care how the token was obtained. All role and permission resolution comes from the database at request time.

```
requireAuth:
  1. Extract Bearer token from Authorization header
  2. Verify JWT signature (same secret for both auth paths)
  3. Check exp > NOW()
  4. Load users record by `sub` and attach it to `req.user`
  5. Proceed

requirePermission('edit_pricing'):
  1. requireAuth (above)
  2. Load venue_user_roles for req.user.id at the target venue
  3. Load role_permissions for that role
  4. Check 'edit_pricing' permission exists → proceed or 403

requireOnboarding:
  1. requireAuth
  2. Check req.user.name IS NOT NULL → proceed or 403 ONBOARDING_INCOMPLETE
  (Note: staff users always have name set at provisioning, so this check
   trivially passes for all staff; requireOnboarding is only meaningful
   for customer-facing routes)
```

### 2.7 Route Protection Reference

| Route | requireAuth | requireOnboarding | requirePermission | Notes |
|---|:---:|:---:|:---:|---|
| Landing page, `/book`, availability API | | | | Fully public |
| `POST /auth/otp/*` | | | | Customer OTP |
| `POST /auth/staff/login` | | | | Staff credential endpoint |
| `POST /auth/staff/activate`, `reset-password/*` | | | | Token-based only |
| `/login` page | | | | Redirects away if already authenticated + onboarded |
| `/onboarding` page | ✓ | | | Redirects away if `name IS NOT NULL` |
| `GET /users/me`, `POST /auth/onboarding` | ✓ | | | Auth but not onboarding required |
| `POST /auth/staff/change-password` | ✓ | | | Accessible even when `force_password_change` blocks other routes |
| `POST /bookings/hold`, waiver, payment | ✓ | ✓ | | Core booking actions |
| `/bookings`, `/wallet`, `/rewards` pages | ✓ | ✓ | | Protected customer pages |
| `/review/[id]` | ✓ | ✓ | | Booking owner also verified |
| `/admin/login` page | | | | Redirects away if already staff-authenticated |
| All `/admin/*` routes | ✓ | ✓ | ✓ | Staff only |

### 2.8 Edge Cases

**Interrupted customer onboarding (OTP verified, name never submitted):**
JWT is valid. On return, `GET /users/me` returns `name: null` → frontend shows name collection. Same JWT works for `/auth/onboarding`. No re-OTP required within the 24h window.

**JWT expired during onboarding:**
User re-enters phone → OTP → existing `users` record found → `next_step: "complete_onboarding"` again. Same row reused.

**Duplicate phone prevention:**
`users.phone` is `UNIQUE`. OTP verify is an upsert — same phone always resolves to the same `users` row.

**Duplicate email prevention:**
`staff_credentials.email` is `UNIQUE`. Admin provisioning endpoint returns `409 EMAIL_ALREADY_EXISTS` if email is already in use.

**Staff phone number:**
Staff users have a `users.phone` if they want one (for future WhatsApp communications), but it is not required and is not used for auth. Staff never go through OTP.

**Customer who later becomes staff:**
Scenario: A user who booked as a customer is later promoted to staff. The same `users` record is used. A `staff_credentials` row is created for them. A `venue_user_roles` row is updated to a non-customer role. Their next customer OTP login will return `next_step: "admin_dashboard"` instead of `resume_booking`. They can still access their booking history via customer routes with the same JWT.

**Admin access to customer-facing routes:**
Admin users have `onboarding_complete = true` (name is always set at provisioning). They can therefore also access customer-facing routes (`requireOnboarding` passes). This is by design — admins may need to test the booking flow.

**Force password change blocking:**
If `staff_credentials.force_password_change = true`, login returns `next_step: "force_password_change"`. The admin panel frontend redirects to the change-password screen. All other admin routes return `403 FORCE_PASSWORD_CHANGE_REQUIRED` until the password is updated.

---

## 3. Scheduling System

### 3.1 Schedule Hierarchy

Availability is determined by layering three sources in order of precedence:

1. **Standard Operating Hours** (`schedules` table) — the default weekly template. Example: Mon–Sun, 06:00–22:00, 60-min slots.
2. **Daily Overrides** (`schedule_exceptions` table) — paint over any specific date. Types:
   - `closed` — no slots generated for that date.
   - `modified_hours` — custom open/close times for that date.
   - `blocked` — specific range marked reserved without a payment record.
3. **Existing Bookings** — confirmed and pending_payment bookings are subtracted from the available slot pool.

### 3.2 Slot Generation Rule

Slots are generated on-the-fly by the backend. Only slots whose **entire duration fits within the open/close window** are created. Partial trailing windows are silently dropped.

> **Example:** Open 09:00–12:00, slot duration 90 minutes → generates 09:00–10:30 and 10:30–12:00 only.

Changing the `slot_duration_mins` on a schedule takes effect immediately for all future slot calculations without any data migration.

### 3.3 Rollover Logic (Advance Booking Window)

To prevent a "midnight rush," a **Rollover Trigger Time** is set per venue (e.g., 08:00 AM).

- Each day at rollover time, the next available day (at the edge of the advance window) becomes bookable.
- **Example:** Venue has a 7-day advance window and rollover at 08:00. On Monday at 08:00, slots for the following Monday become visible.
- Before rollover time, the furthest bookable day is `today + advance_booking_days - 1`.

---

## 4. Pricing Engine (Waterfall Logic)

All pricing is calculated server-side. The backend generates a price quote that is locked into the booking record and passed directly to the payment gateway. The user always pays exactly the quoted amount.

### 4.1 Unit-Based Calculation

A booking consists of one or more **slot units** where each unit = one court × one time slot. The total price is the sum of all unit prices after applying the waterfall logic to each unit individually, then applying the coupon to the total.

**Example:** Court 1 + Court 2, 9 AM–11 AM on a Sunday (2 courts × 2 slots = 4 units):

```
Court 1 / 9:00–10:00  → base ₹500 + weekend +20%              = ₹600
Court 1 / 10:00–11:00 → base ₹500 + weekend +20%              = ₹600
Court 2 / 9:00–10:00  → base ₹500 + indoor +10% + weekend +20% = ₹660
Court 2 / 10:00–11:00 → base ₹500 + indoor +10% + weekend +20% = ₹660
                                                  Subtotal       = ₹2,520
Coupon (-10%)                                                    = −₹252
                                                  Discounted     = ₹2,268
Tax (18%)                                                        = ₹408.24
                                                  Total          = ₹2,676.24
```

Each unit's price is stored as `booking_slots.unit_price` for display in receipts.

### 4.2 Calculation Sequence Per Unit

For each (court_id, slot_start_time) combination:

1. **Base Price** — Fetch `base_prices.amount` for the court.
2. **Time/Day Modifiers** — Query active `pricing_rules` of type `time_modifier`. Apply matching rules ordered by `priority` descending.
3. **Court Modifiers** — Apply active `pricing_rules` of type `court_modifier`.
4. Store result as `unit_price` for this slot unit.

After all units are priced:

5. **Coupon Application** — If a valid coupon is provided, apply flat or percentage discount to the sum of all unit prices. One coupon per booking.
6. **Wallet Credits** — Deduct up to the user's available `wallet_credits` balance.
7. **Tax** — Applied as a percentage on `(subtotal − coupon_discount)`.

### 4.3 Price Preview

A lightweight `POST /bookings/price-preview` endpoint accepts the full selection (court IDs + slot times) and returns the complete price breakdown without creating any database hold. The frontend calls this to display live pricing as the user adjusts their selection. The quote from this endpoint is informational — the authoritative quote is generated again at hold time.

### 4.4 Quote Validity

The price quote is recalculated at hold time (Step 2 of the booking flow). The hold quote is locked into `bookings.total_amount` and passed to PhonePe. The preview endpoint quote is advisory only.

---

## 5. Booking Flow & State Machine

### 5.1 Selection Model

A booking is a **session**: one date, one contiguous time range, covering one or more courts. Constraints:
- All selected courts share the same date, start time, and end time.
- Selected time slots must be consecutive with no gaps.
- At launch: 1 or 2 courts, 1 to N consecutive slots.

### 5.2 Full Booking Sequence

```
Step 1 — Browse & Select (no auth required)
  User views the booking page. Slot grids rendered per court.
  User selects court(s) and consecutive time slots.
  Live price preview updates as selections change (price-preview endpoint).
  No database writes. No lock held.

Step 2 — "Confirm & Pay" clicked
  Frontend checks for a valid JWT in local storage.

  IF valid JWT found:
    → Call GET /users/me to confirm token is live and name IS NOT NULL.
    → If name IS NULL (incomplete onboarding): show name collection screen.
      → POST /auth/onboarding { name }
      → Proceed to Step 3.
    → If name IS NOT NULL: skip auth gate entirely → go to Step 3.

  IF no valid JWT (or expired token):
    → Open Auth Gate bottom sheet.

    PATH A — First-time user:
      Phone entry (+91) → "Send OTP"
      OTP entry (6-digit) → "Verify OTP"
        → POST /auth/otp/verify
        → users record CREATED (name = NULL)
        → JWT issued, next_step: "complete_onboarding"
      Name collection screen
        → POST /auth/onboarding { name }
        → next_step: "resume_booking"

    PATH B — Returning user:
      Phone entry → "Send OTP"
      OTP entry → "Verify OTP"
        → POST /auth/otp/verify
        → users record FOUND (name IS NOT NULL)
        → JWT issued, next_step: "resume_booking"

Step 3 — All-or-Nothing Lock (authenticated + onboarding complete)
  Frontend sends the full selection to POST /bookings/hold.
  JWT is required (requireOnboarding middleware enforced).
  user_id is taken from the JWT — no session_id.

  Backend pre-validation (before any DB write):
    a. All court_ids belong to the venue and are active.
    b. slot_start_times are consecutive (no gaps).
    c. Each slot exists in the generated slot array for that date.
    d. Velocity check: user_id holds fewer than 2 pending bookings.

  Backend lock phase (single DB transaction):
    e. Sort all N×M units by (court_id, slot_start_time).
    f. SELECT ... FOR UPDATE on all slot units.
    g. If any unit is taken: rollback → return 409 with unavailable list.
    h. If all free: INSERT bookings row + N×M booking_slots rows.
       status = 'pending_payment', expires_at = NOW() + 10 minutes.

  Returns: booking_id, price_quote, expires_at.
  The 10-minute clock starts now.

Step 4 — Checkout Summary & Waiver
  Full order summary: courts, date, session time range, per-unit prices.
  Wallet credit toggle (if balance > 0).
  Coupon field.
  Two mandatory checkboxes:
    1. Time acknowledgment (exact date, start, end, AM/PM explicit).
    2. No-cancellation / no-refund policy acceptance.
  POST /bookings/:id/waiver on confirmation.
  Waiver logged: user_id, IP, server-side timestamp.

Step 5 — Payment
  PATH A — Wallet-Only (phonepe_amount == 0):
    Deduct credits, confirm booking immediately.

  PATH B — PhonePe UPI:
    POST /bookings/:id/initiate-payment
    PhonePe iFrame or redirect pay page.
    Confirmation via webhook (primary) or redirect (secondary).

Step 6 — Confirmation
  booking.status → 'confirmed'
  All booking_slots.status → 'confirmed'
  WhatsApp confirmation + receipt sent.
  Reward instance(s) issued.
```

### 5.3 Unavailability Reporting

When the lock phase fails because one or more slot units are taken, the backend returns the specific unavailable units. The frontend uses this to highlight just the taken slots without clearing the user's entire selection — the user can adjust and retry immediately.

```json
{
  "error": {
    "code": "SLOTS_UNAVAILABLE",
    "message": "Some of your selected slots were just taken.",
    "unavailable": [
      { "court_id": "<uuid>", "court_name": "Court 2", "slot_start_time": "10:00" },
      { "court_id": "<uuid>", "court_name": "Court 2", "slot_start_time": "11:00" }
    ]
  }
}
```

### 5.4 Anti-Hoarding — Velocity Check

A user cannot hold more than **2 bookings in `pending_payment` state simultaneously**, regardless of how many courts or slots each booking contains. The check uses `user_id` from the JWT exclusively — no session-based check.

### 5.5 Slot Expiry (Background Sweeper)

Runs every 30 seconds. Finds bookings where `status = 'pending_payment'` AND `expires_at < NOW()`.

For each expired booking:
1. Rollback wallet credits if any were applied.
2. Update `bookings.status → 'expired'` and all child `booking_slots.status → 'expired'` in one transaction.

All slot units for all courts in the booking are released simultaneously.

---

## 6. Edge Cases & Exception Handling

### 6.1 Stale Payment (Phantom Booking)

**Scenario:** User pays at minute 9. The bank takes 3 minutes to process. By minute 10, the sweeper expires all slot units. At minute 12, PhonePe sends the "Success" webhook, but one or more slot units have since been rebooked by another user.

**Resolution Sequence:**
1. Backend receives the webhook and finds the booking in `expired` state.
2. Query `booking_slots` for this booking. Check for conflicts in any `(court_id, slot_date, slot_start_time)` unit against active bookings.
3. If conflict exists: cannot confirm. Automatically notifies the Admin.
4. Immediately initiates a PhonePe refund OR issues equivalent wallet credits.
5. Sends a WhatsApp apology to the user.

### 6.2 Duplicate Webhook

**Scenario:** PhonePe sends the "Success" signal three times for the same transaction.

**Resolution:** The webhook endpoint checks `payments.idempotency_key` before processing. If the key already exists with `status = 'success'`, duplicate signals are gracefully ignored. No duplicate records are created.

### 6.3 AM/PM Booking Error Prevention

The checkout screen displays the full session time in an unambiguous format (e.g., "Sunday, 11 May — 9:00 AM to 12:00 PM, 3 hours") and requires a mandatory acknowledgment checkbox before the Pay button activates.

### 6.4 Manual Admin Block

Admin can mark any combination of courts and slots as `admin_block` without a payment record. The admin selects one or both courts and one or more consecutive slots. All selected `booking_slots` rows are inserted with `status = 'admin_block'` under one `bookings` parent record. These appear as "Unavailable" to users.

### 6.5 Walk-in Entry

Admin selects courts, date, and consecutive time slots for the walk-in player. The system:
1. Creates or matches an existing user record by phone.
2. Inserts one `bookings` row + all N×M `booking_slots` rows with `status = 'walk_in'`.
3. Records payment as cash (outside the gateway).
4. No OTP or payment gateway involvement.

---

## 7. Cancellation Policy & Wallet Credits

### 7.1 No-Cancellation Policy

All bookings are **100% non-refundable** once confirmed. Users acknowledge this at checkout.

### 7.2 Force Majeure / Business-Initiated Cancellations

When the **business** must cancel (flood, power outage, court damage), the Admin initiates the cancellation workflow:

1. Admin selects the affected booking(s) and triggers cancellation.
2. System updates `bookings.status` → `cancelled`.
3. Instead of a bank refund (which incurs gateway fees), the system:
   - Calculates credit amount = `payments.amount` (or `total_amount` if walk-in).
   - Inserts a `wallet_transactions` record of type `credit_issued`.
   - Increments `users.wallet_credits` by the credit amount.
4. Sends a WhatsApp message informing the user of the cancellation and the credit added.
5. Credits are automatically applied as a discount on the user's next booking during the pricing calculation step.

---

## 8. Automated Notification Matrix

All notifications are delivered via the **Meta WhatsApp Cloud API (direct integration)**. All outbound messages use pre-approved Meta templates. See `07-WHATSAPP-INTEGRATION.md` for template category definitions, cost structure, and setup details.

**Built at launch:**

| Trigger | Recipient | WhatsApp Template Category | Charged? |
|---|---|---|---|
| OTP Request | User | **Authentication** | Yes, ~₹0.115–0.145 |
| Booking Confirmed (T=0) | User | **Utility** | Free if within CSW; else ~₹0.16 |
| Force Majeure Cancellation | User | **Utility** | Free if within CSW; else ~₹0.16 |
| Phantom Booking Apology | User | **Utility** | Free if within CSW; else ~₹0.16 |
| Wallet Credit Issued | User | **Utility** | Free if within CSW; else ~₹0.16 |

> **18% GST** applies on top of all WhatsApp template message charges billed in India.

**Deferred — not built at launch:**

| Trigger | Status | Notes |
|---|---|---|
| Reminder (T−24 hours) | **Deferred** | Requires a reliable job scheduler with per-booking scheduled jobs |
| Reminder (T−2 hours) | **Deferred** | Same dependency as T−24h |
| Review Request (post-session) | **Deferred** | Triggered after slot end time; same scheduler dependency |
| Inbound support messages | **Deferred** | Webhook handler and support inbox not built at launch |
| Flash Sale / Loyalty Promo | **Deferred** | No active reward engine or marketing campaigns at launch |

> **Future Enhancement — Scheduled Reminders:** When a job scheduler (BullMQ or pg-boss) is introduced for the slot expiry sweeper's notification needs, T−24h and T−2h reminders are added as the first scheduled notification jobs. No schema changes are needed — `bookings.slot_date` and `bookings.slot_start_time` provide all the timing data required.

> **Future Enhancement — Inbound Support:** When support volume justifies a structured inbox, the WhatsApp inbound webhook handler is activated and routed to an admin notification channel. The webhook route already exists in the architecture and only needs to be enabled in the Meta dashboard.

---

## 9. Legal Compliance — Digital Waiver

The checkout flow includes a mandatory digital waiver step that cannot be bypassed. The system logs:

| Field | Source |
|---|---|
| `waiver_accepted` | Boolean, must be `true` to proceed |
| `waiver_accepted_at` | Server-side timestamp (not client-provided) |
| `waiver_ip_address` | Extracted from the request headers |
| Verified phone number | From the completed OTP session |

The waiver text covers: liability for physical injury, the no-refund policy, and acknowledgment of the specific booking time.

---

## 10. Admin Operations

### 10.1 Schedule Management

Admins can:
- Update standard operating hours per court (takes effect for future slot generation immediately).
- Create date-specific exceptions (close early, close entirely, block a range).
- Change slot duration — takes effect immediately for all future uncreated slots.

### 10.2 Pricing Management

Admins can add, edit, deactivate, or reorder `pricing_rules` and `coupons` through the dashboard. Changes take effect on the next booking attempt (not retroactively for confirmed bookings).

### 10.3 Basic Admin Reporting (Launch)

The admin dashboard surfaces the following at launch:

- Bookings list: filterable by date, court, status.
- Today's revenue total and booking count.
- User lookup by phone: booking history, wallet balance.



---

## 11. Review System

The review screen allows:
- Star rating (1–5), required.
- Free-text comment, optional.
- Court selfie photo upload, **deferred** — the `photo_url` column exists in the schema; the upload feature and Cloudflare R2 integration for reviews is added post-launch.

One review is permitted per booking. Admin can suppress a review from public display (`is_published = false`) but cannot edit the content.

> **Note on review triggers:** At launch, review links are sent manually or surfaced in the My Bookings screen after a session ends. Automated WhatsApp review request messages are deferred along with the scheduled notification system.

---


## 12. Reward Engine

> **Design principle:** The reward system is a pluggable engine decoupled from any specific experience (scratch card, spinner, etc.). No points currency exists. Each confirmed booking directly triggers the active mechanism(s). Switching experiences, running multiple simultaneously, or disabling them entirely is an admin configuration action — not a code change.

### 12.1 Core Concepts

| Concept | Description |
|---|---|
| **Mechanism** | A configured reward experience. Defined in `reward_mechanisms`. Examples: "Post-Booking Scratch Card", "Weekend Spinner". |
| **Trigger Event** | What causes a mechanism to fire. Only `booking_confirmed` is active at launch. |
| **Instance** | A single user's reward generated by a trigger. One instance is created per booking per active mechanism. Stored in `reward_instances`. |
| **Outcome** | The specific prize the user receives. Pre-computed server-side at issuance. Never exposed until the user reveals. |
| **Reveal** | The user interaction that exchanges the pending instance for its outcome and triggers prize fulfillment. |

### 12.2 Instance Issuance

When a booking is confirmed (status → `confirmed`), the backend queries all `reward_mechanisms` where:
- `venue_id` matches the booking's venue
- `trigger_event = 'booking_confirmed'`
- `is_active = true`
- `NOW()` is within `valid_from` and `valid_until` (if set)

For each matching mechanism, one `reward_instances` row is inserted atomically inside the same database transaction that confirms the booking. This guarantees:
- No booking is confirmed without its reward instance(s).
- No orphaned instances exist without a confirmed booking.
- Duplicate webhook signals (idempotent confirm) do not create duplicate instances — the `UNIQUE (booking_id, mechanism_id)` constraint silently prevents re-insertion.

**Issuance also applies to walk-in bookings** confirmed by an admin.
**Instances are never created for** expired, cancelled, or admin-block bookings.

### 12.3 Outcome Pre-computation

At issuance time, the backend runs a server-side weighted random draw against `config.prizes` and selects a winning prize. The result is stored in `reward_instances.outcome` as JSONB.

```
outcome example:
{ "prize_id": "p2", "label": "₹50 Court Credit", "type": "wallet_credit", "value": 50 }
```

The draw is performed server-side every time. The frontend receives only the mechanism type and a token representing the instance — never the outcome. The outcome is revealed only when the user calls the reveal endpoint.

**Probability validation:** Before any `reward_mechanisms` record is saved (create or update), the backend validates that all prize probabilities sum to exactly 1.0. Rejected with a `400` error if they do not.

**Prize pool isolation:** Each instance stores a `config_snapshot` — a frozen copy of the mechanism's `config` at issuance time. If an admin later edits the prize pool (e.g., increases win probability), existing unrevealed instances retain their original outcome. The edit affects only future issuances.

### 12.4 Reveal Flow

1. User opens the reward screen and sees a pending instance (scratch card, spinner segment, etc.).
2. User interacts with the UI (scratches the card / taps spin).
3. Frontend calls `POST /rewards/instances/:id/reveal`.
4. Backend verifies:
   - Instance belongs to the authenticated user.
   - `status = 'pending'`.
   - `expires_at > NOW()` (not expired).
5. Backend marks `status = 'revealed'`, sets `revealed_at`.
6. Backend executes prize fulfillment (Section 12.5).
7. Backend returns the `outcome` in the response — this is the first time the client sees it.
8. Frontend animates the reveal to land on the returned outcome (scratch reveals the prize; spinner lands on the segment). The animation is purely cosmetic — it does not affect the result.

### 12.5 Prize Fulfillment

Fulfillment is executed atomically in the same transaction as the reveal status update.

| Prize Type | Fulfillment Action |
|---|---|
| `no_prize` | No action. Mark `fulfillment_status = 'not_applicable'`. |
| `wallet_credit` | Increment `users.wallet_credits` by `value`. Insert `wallet_transactions` row (type: `credit_issued`, reason: reward prize). Mark `fulfillment_status = 'fulfilled'`. |
| `coupon` | Generate a new one-time `coupons` record from the template (`coupon_template_id`). Set `max_uses_total = 1`, `max_uses_per_phone = 1`, assign to the user's phone. Return the coupon code in the outcome. Mark `fulfillment_status = 'fulfilled'`. |
| `free_booking` | Yet to be designed in detail. Mark `fulfillment_status = 'pending'` for admin follow-up. |

**On fulfillment failure:** The reveal transaction rolls back. The instance remains in `pending` state. The user can retry. The error is logged for admin visibility.

### 12.6 Instance Expiry

Unrevealed instances with `expires_at < NOW()` are swept by the background job. The sweeper updates `status = 'expired'`. Expired instances are never fulfillable and are removed from the user's active rewards screen.

The `instance_expiry_days` is configured per mechanism (default: 7 days). A shorter window creates urgency; a longer window reduces churn.

### 12.7 Adding or Switching Mechanisms

| Change | Required Action |
|---|---|
| Activate scratch cards | Create/enable a `reward_mechanisms` row with `type = 'scratch_card'` |
| Disable scratch cards | Set `reward_mechanisms.is_active = false` |
| Switch to spinner | Deactivate scratch card mechanism; activate a `spinner` mechanism |
| Run both simultaneously | Have both mechanisms `is_active = true`; each booking generates two instances |
| Disable all rewards | Set all mechanisms to `is_active = false`; no instances generated |
| Add a new mechanism type | Add enum value; write frontend component; no schema or table changes |

### 12.8 Admin Controls

| Action | Permission |
|---|---|
| Create / edit / deactivate mechanisms | `edit_pricing` |
| Edit prize probabilities (config JSONB) | `edit_pricing` |
| View a user's reward instance history | `manage_bookings` |
| Manually expire an instance | `manage_bookings` |
| Fulfill pending `free_booking` prizes | `manage_bookings` |

