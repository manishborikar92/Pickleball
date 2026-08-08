# Pickleball Platform — Database Schema

All tables are stored in PostgreSQL. JSONB is used for flexible rule storage in the Scheduling & Pricing domain. Every core entity traces back to a `venue_id`, enforcing multi-tenant isolation.

---

## Domain A — Venue & Courts

### `venues`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default gen_random_uuid() | |
| `name` | VARCHAR(255) | NOT NULL | Display name (e.g., "Besa, Nagpur") |
| `slug` | VARCHAR(100) | UNIQUE, NOT NULL | URL-safe identifier |
| `address` | TEXT | NOT NULL | Full address |
| `city` | VARCHAR(100) | NOT NULL | |
| `timezone` | VARCHAR(50) | NOT NULL | e.g., "Asia/Kolkata" |
| `currency` | CHAR(3) | NOT NULL, default 'INR' | ISO 4217 |
| `rollover_time` | TIME | NOT NULL | When next day's slots become visible (e.g., 08:00) |
| `advance_booking_days` | SMALLINT | NOT NULL, default 7 | How many days ahead users can book |
| `phone` | VARCHAR(20) | | Facility contact number |
| `email` | VARCHAR(255) | | Facility contact email |
| `is_active` | BOOLEAN | NOT NULL, default true | |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

---

### `courts`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `venue_id` | UUID | FK → venues.id, NOT NULL | |
| `name` | VARCHAR(100) | NOT NULL | e.g., "Court 1" |
| `surface_type` | VARCHAR(50) | | e.g., "Hard", "Clay" |
| `environment` | VARCHAR(20) | NOT NULL | "indoor" or "outdoor" |
| `description` | TEXT | | |
| `cover_image_url` | VARCHAR(500) | | Stored in Cloudflare R2 |
| `status` | VARCHAR(20) | NOT NULL, default 'active' | Enum: active, maintenance, offline |
| `display_order` | SMALLINT | default 0 | Sort order in UI |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

---

## Domain B — Identity & RBAC

### `users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `phone` | VARCHAR(20) | UNIQUE | Primary customer identifier; includes country code. Nullable for admin-only users who authenticate by email. |
| `name` | VARCHAR(255) | | `NULL` until the user completes onboarding. A completed onboarding state includes both a non-null name and `onboarding_completed_at`. |
| `is_phone_verified` | BOOLEAN | NOT NULL, default false | Set `true` on first successful OTP verification |
| `onboarding_completed_at` | TIMESTAMPTZ | | Set once when a valid `name` is first submitted via `/auth/onboarding`. `NULL` until onboarding is completed. |
| `wallet_credits` | NUMERIC(10,2) | NOT NULL, default 0.00 | Monetary credit balance (INR); issued on force-majeure cancellations |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

---

### `roles`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `name` | VARCHAR(50) | UNIQUE, NOT NULL | Enum: `super_admin`, `manager`, `staff`, `customer` |
| `description` | TEXT | | |

**Seed roles at launch:** `super_admin` and `customer`. `manager` and `staff` are seeded but unused until the team grows.

---

### `permissions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `key` | VARCHAR(100) | UNIQUE, NOT NULL | e.g., `edit_pricing`, `manage_bookings` |
| `description` | TEXT | | |

**Seed permissions at launch:** `manage_courts`, `edit_pricing`, `edit_schedule`, `manage_bookings`, `issue_credits`, `walk_in_entry`, `view_own_bookings`, `manage_venues`.

---

### `role_permissions`

| Column | Type | Constraints |
|---|---|---|
| `role_id` | UUID | FK → roles.id |
| `permission_id` | UUID | FK → permissions.id |
| PK | | (role_id, permission_id) |

**Seed assignments at launch:**

| Permission | super_admin | manager | staff | customer |
|---|:---:|:---:|:---:|:---:|
| `manage_courts` | ✓ | | | |
| `edit_pricing` | ✓ | ✓ | | |
| `edit_schedule` | ✓ | ✓ | | |
| `manage_bookings` | ✓ | ✓ | ✓ | |
| `issue_credits` | ✓ | ✓ | | |
| `walk_in_entry` | ✓ | ✓ | ✓ | |
| `view_own_bookings` | ✓ | ✓ | ✓ | ✓ |
| `manage_venues` | ✓ | | | |

---

### `venue_user_roles`

Maps a user to a role within a specific venue. A user may hold different roles at different venues, enabling contextual access control without duplicating user records.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `user_id` | UUID | FK → users.id, NOT NULL | |
| `venue_id` | UUID | FK → venues.id, NOT NULL | |
| `role_id` | UUID | FK → roles.id, NOT NULL | |
| `assigned_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `assigned_by` | UUID | FK → users.id | Super admin who made the assignment |
| PK | | (user_id, venue_id) | One role per user per venue |

> At launch with a single venue and a small operator team, all admin users are assigned `super_admin` at the single venue. The multi-venue operational UI for managing cross-venue assignments is deferred, but the schema supports it from day one.

---

### `admin_credentials`

Stores email + password credentials for non-customer users (`super_admin`, `manager`, `staff`). Customers never have rows in this table. Admin users never use OTP for login. The two auth systems share the `users` table as the identity root but are entirely separate in credential management.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users.id, UNIQUE, NOT NULL | One credential record per admin user |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Login identifier for the admin panel |
| `password_hash` | TEXT | NOT NULL | bcrypt hash, cost factor 12. Never logged or stored in plain text. |
| `status` | VARCHAR(30) | NOT NULL, default 'pending_activation' | Enum: `pending_activation`, `active`, `suspended`, `locked` |
| `activation_token_hash` | TEXT | | bcrypt hash of the single-use activation token. Cleared after activation. |
| `activation_token_expires_at` | TIMESTAMPTZ | | Activation links expire after 72 hours |
| `password_reset_token_hash` | TEXT | | bcrypt hash of the single-use password reset token. Cleared after use. |
| `password_reset_expires_at` | TIMESTAMPTZ | | Reset links expire after 1 hour |
| `failed_login_attempts` | SMALLINT | NOT NULL, default 0 | Reset to 0 on successful login |
| `locked_until` | TIMESTAMPTZ | | Set when failed attempts reach 10; locked for 30 minutes |
| `force_password_change` | BOOLEAN | NOT NULL, default false | If true, admin must change password before any protected route is accessible |
| `last_login_at` | TIMESTAMPTZ | | |
| `last_login_ip` | INET | | |
| `password_changed_at` | TIMESTAMPTZ | | Updated on every successful password change |
| `created_by` | UUID | FK → users.id | The super_admin who provisioned this account |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**`status` transitions:**
```
pending_activation → (activation link clicked + password set) → active
active             → (admin suspends)                          → suspended
active             → (10 failed login attempts)                → locked
locked             → (30-min lockout expires OR admin resets)  → active
suspended          → (admin re-activates)                      → active
```

---

### `otp_requests`

Tracks OTP sends and verification attempts for rate-limiting and audit.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `phone` | VARCHAR(20) | NOT NULL | |
| `otp_hash` | TEXT | NOT NULL | Hashed OTP (never stored in plain text) |
| `expires_at` | TIMESTAMPTZ | NOT NULL | |
| `verified_at` | TIMESTAMPTZ | | Null until verified |
| `attempt_count` | SMALLINT | NOT NULL, default 0 | |
| `ip_address` | INET | | |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

---

### `auth_sessions`

Tracks browser/device sessions for refresh-token lifecycle, revocation, audit, and logout-all behavior.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Session identifier embedded in access-token `sid` claim |
| `user_id` | UUID | FK -> users.id, NOT NULL | |
| `status` | VARCHAR(20) | NOT NULL, default `active` | Enum: `active`, `revoked`, `expired` |
| `ip_address` | INET | | First-seen client IP |
| `user_agent` | TEXT | | First-seen user agent |
| `last_seen_at` | TIMESTAMPTZ | NOT NULL, default now() | Updated on refresh |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Matches the refresh-token session horizon |
| `revoked_at` | TIMESTAMPTZ | | Set by logout, logout-all, or token reuse detection |
| `revoke_reason` | VARCHAR(100) | | e.g., `logout_current`, `logout_all`, `refresh_token_reuse` |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

Indexes: `(user_id, status)` for active-session lookup and `(expires_at)` for cleanup.

---

### `refresh_tokens`

Stores rotating refresh-token hashes. Raw refresh tokens are never stored.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `session_id` | UUID | FK -> auth_sessions.id, NOT NULL | |
| `user_id` | UUID | FK -> users.id, NOT NULL | |
| `token_hash` | TEXT | UNIQUE, NOT NULL | SHA-256 hash of the raw refresh token |
| `parent_token_id` | UUID | | Prior token in the rotation chain |
| `replaced_by_token_id` | UUID | | Next token created during rotation |
| `expires_at` | TIMESTAMPTZ | NOT NULL | |
| `revoked_at` | TIMESTAMPTZ | | Set when rotated, logged out, or revoked |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

Indexes: `(session_id, revoked_at)`, `(user_id, created_at)`, `(expires_at)`, plus a partial unique index on `session_id` where `revoked_at IS NULL` so each session can have only one active refresh token.

---

## Domain C — Scheduling & Pricing Engine

### `schedules`

Defines the standard operating hours (template) per court.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `venue_id` | UUID | FK → venues.id, NOT NULL | |
| `court_id` | UUID | FK → courts.id, NOT NULL | |
| `day_of_week` | SMALLINT[] | NOT NULL | 0=Sun … 6=Sat |
| `open_time` | TIME | NOT NULL | e.g., 06:00 |
| `close_time` | TIME | NOT NULL | e.g., 22:00 |
| `slot_duration_mins` | SMALLINT | NOT NULL, default 60 | 60, 90, or 120 |
| `is_active` | BOOLEAN | NOT NULL, default true | |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

> **Slot Generation Rule:** Only slots that fully fit within `open_time`–`close_time` are generated. Partial trailing slots are dropped (e.g., 9 AM–12 PM with 90-min slots yields 9:00 and 10:30 only).

---

### `schedule_exceptions`

Daily overrides that paint over the standard schedule for a specific date.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `venue_id` | UUID | FK → venues.id, NOT NULL | |
| `court_id` | UUID | FK → courts.id | NULL means applies to all courts at venue |
| `exception_date` | DATE | NOT NULL | |
| `exception_type` | VARCHAR(20) | NOT NULL | Enum: closed, modified_hours, blocked |
| `open_time` | TIME | | Used when type = modified_hours |
| `close_time` | TIME | | Used when type = modified_hours |
| `reason` | TEXT | | Admin note (e.g., "Tournament") |
| `created_by` | UUID | FK → users.id | |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

---

### `pricing_rules`

Dynamic pricing modifiers stored as JSONB for schema-free flexibility.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `venue_id` | UUID | FK → venues.id, NOT NULL | |
| `court_id` | UUID | FK → courts.id | NULL = applies to all courts at venue |
| `name` | VARCHAR(255) | NOT NULL | Human-readable label (e.g., "Weekend Peak") |
| `rule` | JSONB | NOT NULL | See rule schema below |
| `priority` | SMALLINT | NOT NULL, default 0 | Higher priority rules are evaluated first |
| `is_active` | BOOLEAN | NOT NULL, default true | |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Pricing Rule JSONB Schema:**

```json
{
  "type": "time_modifier",
  "days": ["Saturday", "Sunday"],
  "start_time": "18:00",
  "end_time": "22:00",
  "adjustment_type": "percentage",
  "value": 20
}
```

```json
{
  "type": "court_modifier",
  "environment": "indoor",
  "adjustment_type": "percentage",
  "value": 10
}
```

```json
{
  "type": "flash_sale",
  "start_time": "09:00",
  "end_time": "10:00",
  "adjustment_type": "percentage",
  "value": -50
}
```

---

### `base_prices`

Default hourly rate per court.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `court_id` | UUID | FK → courts.id, UNIQUE, NOT NULL | One base price per court |
| `amount` | NUMERIC(10,2) | NOT NULL | INR per slot (base) |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

---

### `coupons`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `venue_id` | UUID | FK → venues.id | NULL = platform-wide |
| `code` | VARCHAR(50) | UNIQUE, NOT NULL | |
| `discount_type` | VARCHAR(20) | NOT NULL | Enum: flat, percentage |
| `discount_value` | NUMERIC(10,2) | NOT NULL | |
| `max_uses_total` | INTEGER | | NULL = unlimited |
| `max_uses_per_phone` | SMALLINT | default 1 | |
| `valid_from` | TIMESTAMPTZ | | |
| `valid_until` | TIMESTAMPTZ | | |
| `is_active` | BOOLEAN | NOT NULL, default true | |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

> **Future Enhancement — Stackable Coupons:** An `is_stackable` boolean column can be added when pricing rules become complex enough to require coupon-modifier interaction logic. At launch, one coupon per booking applies after all time/court modifiers.

---

### `coupon_usages`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `coupon_id` | UUID | FK → coupons.id |
| `booking_id` | UUID | FK → bookings.id |
| `user_id` | UUID | FK → users.id |
| `phone` | VARCHAR(20) | NOT NULL |
| `used_at` | TIMESTAMPTZ | NOT NULL, default now() |

---

## Domain D — Booking & Transactions

### `bookings`

The parent transaction record. One booking covers a contiguous time session across one or more courts. All slot-level detail lives in `booking_slots`. Financial columns remain on this table. Bookings are always created by an authenticated, onboarding-complete user — there are no anonymous holds.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `venue_id` | UUID | FK → venues.id, NOT NULL | |
| `user_id` | UUID | FK → users.id, NOT NULL | Always set at hold time; no anonymous bookings |
| `slot_date` | DATE | NOT NULL | All booking_slots in this booking share this date |
| `session_start_time` | TIME | NOT NULL | Earliest slot start across all courts |
| `session_end_time` | TIME | NOT NULL | Latest slot end across all courts |
| `session_duration_mins` | SMALLINT | NOT NULL | Total time span in minutes (e.g., 9 AM–12 PM = 180) |
| `court_count` | SMALLINT | NOT NULL | Number of distinct courts in this booking |
| `slot_unit_count` | SMALLINT | NOT NULL | Total court×time_slot units (court_count × time slots selected) |
| `status` | VARCHAR(30) | NOT NULL, default 'pending_payment' | Enum: pending_payment, confirmed, completed, expired, cancelled, walk_in, admin_block |
| `booking_type` | VARCHAR(20) | NOT NULL, default 'online' | Enum: online, walk_in, admin_block |
| `base_amount` | NUMERIC(10,2) | NOT NULL | Sum of all unit base prices before modifiers |
| `discount_amount` | NUMERIC(10,2) | NOT NULL, default 0.00 | Coupon + modifier reductions |
| `tax_amount` | NUMERIC(10,2) | NOT NULL, default 0.00 | Optional tax charged on the booking (defaults to 0.00) |
| `total_amount` | NUMERIC(10,2) | NOT NULL | Final amount charged |
| `credits_applied` | NUMERIC(10,2) | NOT NULL, default 0.00 | |
| `coupon_id` | UUID | FK → coupons.id | |
| `expires_at` | TIMESTAMPTZ | | For pending_payment; NULL once confirmed |
| `waiver_accepted` | BOOLEAN | NOT NULL, default false | |
| `waiver_accepted_at` | TIMESTAMPTZ | | |
| `waiver_ip_address` | INET | | |
| `access_pin` | CHAR(4) | | Single PIN grants access to all courts in this booking |
| `notes` | TEXT | | Admin notes for walk-ins/blocks |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Booking Status State Machine:**

```
AVAILABLE
    │ (user confirms full selection)
    ▼
PENDING_PAYMENT  ──── (10 min timeout + wallet rollback) ────► EXPIRED
    │
    │ (wallet-only path OR PhonePe COMPLETED webhook/redirect)
    ▼
CONFIRMED ─────── (play window ends) ───────► COMPLETED
    │
    │ (admin force-cancel, strictly before session starts)
    ▼
CANCELLED
```

Status changes on `bookings` are always propagated to all child `booking_slots` rows in the same transaction.

---

### `booking_slots`

One row per court per time slot unit within a booking. This is where double-booking prevention is enforced. The partial unique index covers all active statuses.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `booking_id` | UUID | FK → bookings.id, NOT NULL | |
| `court_id` | UUID | FK → courts.id, NOT NULL | |
| `slot_date` | DATE | NOT NULL | |
| `slot_start_time` | TIME | NOT NULL | |
| `slot_end_time` | TIME | NOT NULL | |
| `status` | VARCHAR(30) | NOT NULL | Denormalized from `bookings.status`. Updated in the same transaction as the parent. Used for the partial unique index. |
| `unit_price` | NUMERIC(10,2) | NOT NULL | Pre-tax price for this specific court × slot unit after all modifiers. Stored for receipt breakdown. |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Double-booking prevention:**
```sql
CREATE UNIQUE INDEX booking_slots_no_double_book
ON booking_slots (court_id, slot_date, slot_start_time)
WHERE status IN ('pending_payment', 'confirmed', 'walk_in', 'admin_block');
```

This partial unique index constraint is evaluated atomically during slot hold creation. When concurrent inserts for the same slot run inside a database transaction, PostgreSQL rejects the second insertion, throwing a unique constraint violation. The service layer catches this error and maps it to a structured selection conflict.

---

### `payments`

One record per payment attempt. A single booking may have multiple `payments` records (one per retry attempt). Only one will reach `status = 'success'`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `booking_id` | UUID | FK → bookings.id, NOT NULL | |
| `gateway` | VARCHAR(50) | NOT NULL, default 'phonepe' | Enum: phonepe, wallet |
| `merchant_order_id` | VARCHAR(255) | UNIQUE | Exact PhonePe correlation key. Every gateway attempt receives a new 34-character `PP-<booking-prefix>-<64-bit-entropy>` value; NULL for wallet-only payments |
| `gateway_order_id` | VARCHAR(255) | | PhonePe's internal `orderId` (e.g., `OMO...`); filled from webhook |
| `gateway_payment_id` | VARCHAR(255) | | PhonePe `transactionId` from `paymentDetails[0]`; filled on success |
| `upi_vpa` | VARCHAR(255) | | UPI VPA used (e.g., `user@ybl`); filled from webhook `splitInstruments` |
| `payment_mode` | VARCHAR(30) | | `UPI_INTENT`, `UPI_COLLECT`, or `UPI_QR`; filled from webhook |
| `amount` | NUMERIC(10,2) | NOT NULL | Amount sent to PhonePe in INR. 0.00 for wallet-only |
| `currency` | CHAR(3) | NOT NULL, default 'INR' | |
| `status` | VARCHAR(20) | NOT NULL, default 'initiated' | Enum: initiated, success, failed, refund_pending, refunded, refund_failed |
| `webhook_received_at` | TIMESTAMPTZ | | Timestamp of first webhook receipt |
| `idempotency_key` | VARCHAR(255) | UNIQUE | Provider-namespaced attempt key (for example, `phonepe:<merchant_order_id>`); used to deduplicate processing |
| `merchant_refund_id` | VARCHAR(255) | UNIQUE | UUID generated before calling the Refund API; used for refund idempotency |
| `refund_amount` | NUMERIC(10,2) | | Amount refunded via PhonePe (INR) |
| `refund_initiated_at` | TIMESTAMPTZ | | |
| `refund_completed_at` | TIMESTAMPTZ | | Set when `pg.refund.completed` webhook arrives |
| `raw_webhook_payload` | JSONB | | Full webhook body stored for debugging and reconciliation |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

---

### `wallet_transactions`

Audit trail for all platform credit movements.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users.id, NOT NULL | |
| `booking_id` | UUID | FK → bookings.id | Source booking (for credits issued) |
| `type` | VARCHAR(20) | NOT NULL | Enum: credit_issued, credit_redeemed |
| `amount` | NUMERIC(10,2) | NOT NULL | |
| `balance_after` | NUMERIC(10,2) | NOT NULL | Snapshot for audit |
| `reason` | TEXT | | e.g., "Force majeure cancellation — Court 1" |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

---

## Domain E — Reviews

### `reviews`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `booking_id` | UUID | FK → bookings.id, UNIQUE, NOT NULL | One review per booking |
| `user_id` | UUID | FK → users.id, NOT NULL | |
| `venue_id` | UUID | FK → venues.id, NOT NULL | |
| `rating` | SMALLINT | NOT NULL, CHECK (1–5) | Covers the overall session experience |
| `comment` | TEXT | | Optional free-text |
| `photo_url` | VARCHAR(500) | | Cloudflare R2 URL — deferred |
| `is_published` | BOOLEAN | NOT NULL, default true | Admin can suppress |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

---

## Domain F — Reward Engine

> **Design principle:** The reward system is a pluggable engine. `reward_mechanisms` defines *what* reward experiences are active (such as scratch cards) and *how* they behave. `reward_instances` holds each user's individual reward generated by a trigger. Disabling rewards or configuring prize pools is an admin configuration change — not a code or schema change. New mechanism types require a new frontend component and new `config` JSONB handling in the prize-draw logic; no tables are added or removed.

> **Rewards never touch wallet credits.** `wallet_credits` (Domain D) are monetary INR credits issued on business-initiated cancellations and payment rollbacks only. Reward prizes are **external offer vouchers** (e.g., the venue's food & beverage stall) redeemed outside the booking flow with staff-tracked redemption. Each confirmed booking directly generates a reward instance.

---

### `reward_mechanisms`

Admin-managed table. One row per mechanism type per venue. Controls which reward experiences are live and how they behave. Multiple mechanisms can be active at the same time; a single booking confirmation creates one `reward_instance` per active mechanism.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `venue_id` | UUID | FK → venues.id, NOT NULL | |
| `name` | VARCHAR(255) | NOT NULL | Human label (e.g., "Post-Booking Scratch Card") |
| `type` | VARCHAR(50) | NOT NULL | Enum: `scratch_card`. Mechanism creation accepts `scratch_card`. |
| `trigger_event` | VARCHAR(50) | NOT NULL, default 'booking_confirmed' | What fires this mechanism. Only `booking_confirmed` is active at launch. |
| `config` | JSONB | NOT NULL | Mechanism-specific configuration. See schemas below. |
| `instance_expiry_days` | SMALLINT | NOT NULL, default 7 | Days after issuance before unrevealed instances expire |
| `is_active` | BOOLEAN | NOT NULL, default false | Must be explicitly activated. Only active mechanisms generate instances. |
| `valid_from` | TIMESTAMPTZ | | Mechanism is inactive before this time even if `is_active = true` |
| `valid_until` | TIMESTAMPTZ | | Mechanism auto-deactivates after this time |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**`config` JSONB — `scratch_card` type:**
```json
{
  "card_theme": "court_green",
  "prizes": [
    { "id": "p1", "label": "Better luck next time!",              "type": "no_prize", "probability": 0.70 },
    { "id": "p2", "label": "Free Iced Coffee at the Baseline Café", "type": "voucher",  "terms": "Show this voucher at the café counter. One per visit.", "validity_days": 14, "probability": 0.20 },
    { "id": "p3", "label": "20% Off Any Snack Combo",             "type": "voucher",  "terms": "Valid on snack combos at the venue stall.", "validity_days": 30, "probability": 0.10 }
  ]
}
```

Prize probabilities across all entries in a `config` MUST sum to exactly 1.0. This is validated by the backend before saving the mechanism.

**Prize `type` values (shared across all mechanism types):**

| Type | Fulfillment |
|---|---|
| `no_prize` | Nothing issued |
| `voucher` | An external offer voucher (venue stall / café). At reveal, a unique voucher code (`RWD-XXXXXXXX`) is issued with a redemption window of `validity_days` (default 30). Redemption is staff-tracked: venue staff mark the voucher redeemed via the moderation API, preventing double-use. |

---

### `reward_instances`

One row per user per booking per active mechanism at the time of trigger. The prize outcome is computed server-side at issuance using the mechanism's `config` probability distribution and stored in `outcome`. The outcome is **never returned in any GET endpoint** while pending — it is only revealed when the user calls the reveal endpoint, after which `status` becomes `revealed`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `mechanism_id` | UUID | FK → reward_mechanisms.id, NOT NULL | |
| `mechanism_type` | VARCHAR(50) | NOT NULL | Denormalized copy of `reward_mechanisms.type` — avoids JOIN for frontend reads |
| `user_id` | UUID | FK → users.id, NOT NULL | |
| `booking_id` | UUID | FK → bookings.id, NOT NULL | |
| `status` | VARCHAR(20) | NOT NULL, default 'pending' | Enum: `pending`, `revealed`, `expired` |
| `config_snapshot` | JSONB | NOT NULL | Frozen copy of `reward_mechanisms.config` at issuance time — preserves the prize pool even if the mechanism is later edited |
| `outcome` | JSONB | NOT NULL | Pre-computed server-side at issuance. **Never exposed to the client until `reveal` is called.** |
| `prize_type` | VARCHAR(30) | NOT NULL | Denormalized from `outcome.type` (`no_prize` \| `voucher`) — allows querying prize distributions without parsing JSONB |
| `revealed_at` | TIMESTAMPTZ | | Set on reveal |
| `expires_at` | TIMESTAMPTZ | NOT NULL | `created_at + instance_expiry_days`. Unrevealed instances past this date are expired by sweeper. |
| `voucher_code` | VARCHAR(20) | UNIQUE | Issued at reveal for `voucher` prizes (`RWD-XXXXXXXX`); NULL for `no_prize` and pending instances |
| `voucher_valid_until` | TIMESTAMPTZ | | End of the voucher redemption window (`revealed_at + validity_days`) |
| `redeemed_at` | TIMESTAMPTZ | | Set when venue staff mark the voucher redeemed; NULL = unredeemed. CHECK: requires `voucher_code`. |
| `redemption_note` | TEXT | | Optional staff note recorded at redemption |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Unique constraint:** `(booking_id, mechanism_id)` — one instance per booking per mechanism; prevents duplicate issuance on webhook redelivery.

---

## Domain G — Notifications

### `notification_settings`

Per-venue notification toggle configuration. Controls whether automated reminders and post-session review requests are scheduled upon booking confirmation.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default gen_random_uuid() | |
| `venue_id` | UUID | FK → venues.id, UNIQUE, NOT NULL | Per-venue toggle configuration |
| `reminders_enabled` | BOOLEAN | NOT NULL, default false | Enable T-24h and T-2h scheduled WhatsApp reminders |
| `review_requests_enabled` | BOOLEAN | NOT NULL, default false | Enable post-session review request WhatsApp messages |
| `updated_by` | UUID | FK → users.id | User ID of admin who last updated toggles |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

---

### `notifications`

PostgreSQL notification outbox table. Scheduled notification records are created atomically inside booking confirmation transactions and claimed/delivered by the background outbox dispatcher sweeper.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default gen_random_uuid() | |
| `booking_id` | UUID | FK → bookings.id, NOT NULL | Associated booking |
| `venue_id` | UUID | FK → venues.id, NOT NULL | Associated venue |
| `user_id` | UUID | FK → users.id, NOT NULL | Recipient player |
| `type` | VARCHAR(30) | NOT NULL | Enum: `reminder_t24`, `reminder_t2h`, `review_request` |
| `scheduled_for` | TIMESTAMPTZ | NOT NULL | Target delivery time in UTC |
| `status` | VARCHAR(20) | NOT NULL, default 'scheduled' | Enum: `scheduled`, `sending`, `sent`, `failed`, `cancelled`, `skipped` |
| `attempts` | SMALLINT | NOT NULL, default 0 | Delivery attempt counter |
| `next_retry_at` | TIMESTAMPTZ | | Exponential backoff retry timestamp |
| `sent_at` | TIMESTAMPTZ | | Timestamp when transport acknowledged delivery |
| `provider` | VARCHAR(20) | | Delivery transport (`dry_run` or `meta`) |
| `last_error` | TEXT | | Last delivery failure message |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Unique constraint:** `(booking_id, type)` — prevents duplicate notification outbox rows per booking per notification type.

---

## Indexes

| Table | Index | Type | Purpose |
|---|---|---|---|
| `users` | (phone) | Unique | Primary lookup by phone number; nullable for admin-only accounts |
| `users` | (name) | B-tree | Name search and admin lookup |
| `admin_credentials` | (email) | Unique | Admin login lookup |
| `admin_credentials` | (user_id) | Unique | Reverse lookup from user to credentials |
| `admin_credentials` | (status) WHERE status = 'pending_activation' | Partial | Find unactivated accounts |
| `bookings` | (status, expires_at) | B-tree | Background expiry sweeper |
| `bookings` | (user_id, status) | B-tree | User booking history and velocity check |
| `booking_slots` | (court_id, slot_date, slot_start_time) WHERE active | Partial Unique | **Core double-booking prevention** |
| `booking_slots` | (booking_id) | B-tree | Fetch all slot units for a booking |
| `booking_slots` | (court_id, slot_date) | B-tree | Availability query per court per date |
| `payments` | (idempotency_key) | Unique | Webhook deduplication |
| `payments` | (merchant_order_id) | Unique | Order status lookups and retries |
| `payments` | (booking_id) | B-tree | All payment attempts for a booking |
| `payments` | (merchant_refund_id) | Unique | Refund idempotency |
| `payments` | (status) WHERE status IN ('initiated') | Partial | Missing webhook recovery job |
| `otp_requests` | (phone, created_at) | B-tree | Rate limiting |
| `coupon_usages` | (coupon_id, phone) | B-tree | Per-phone usage check |
| `venue_user_roles` | (user_id, venue_id) | Unique | One role per user per venue |
| `wallet_transactions` | (user_id, created_at) | B-tree | User transaction history |
| `reward_mechanisms` | (venue_id, is_active, trigger_event) | B-tree | Fetch active mechanisms on booking confirmation |
| `reward_instances` | (booking_id, mechanism_id) | Unique | Prevent duplicate issuance |
| `reward_instances` | (user_id, status) | B-tree | User's pending/revealed cards |
| `reward_instances` | (voucher_code) | Unique | Staff voucher lookup at redemption |
| `reward_instances` | (expires_at) WHERE status = 'pending' | Partial | Expiry sweeper scan |
| `notification_settings` | (venue_id) | Unique | Fast toggle lookup per venue |
| `notifications` | (booking_id, type) | Unique | Prevent duplicate notification scheduling per booking |
| `notifications` | (status, scheduled_for) | B-tree | Outbox dispatcher polling due notifications |
| `notifications` | (venue_id, created_at) | B-tree | Admin notification activity log query |
| `notifications` | (booking_id) | B-tree | Notification lookup by booking ID |

> **Venue-Aware Architecture Note:** All core tables include a `venue_id` column. The single active venue is resolved server-side at launch — no multi-venue routing headers or UI are required. When a second venue is added, indexing and query scoping already support it without schema changes.
