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
| `environment` | VARCHAR(20) | NOT NULL | "Indoor" or "Outdoor" |
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
| `phone` | VARCHAR(20) | UNIQUE, NOT NULL | Primary identifier; includes country code |
| `name` | VARCHAR(255) | | Collected at first booking |
| `is_phone_verified` | BOOLEAN | NOT NULL, default false | Set true after first successful OTP |
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

**Seed permissions at launch:** `manage_courts`, `edit_pricing`, `edit_schedule`, `manage_bookings`, `issue_credits`, `view_analytics`, `walk_in_entry`, `view_own_bookings`.

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
| `view_analytics` | ✓ | ✓ | | |
| `walk_in_entry` | ✓ | ✓ | ✓ | |
| `view_own_bookings` | ✓ | ✓ | ✓ | ✓ |

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
  "environment": "Indoor",
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

The parent transaction record. One booking covers a contiguous time session across one or more courts. All slot-level detail (which court, which slot unit) lives in `booking_slots`. Financial columns remain on this table.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `venue_id` | UUID | FK → venues.id, NOT NULL | |
| `user_id` | UUID | FK → users.id | NULL until OTP verified |
| `session_id` | VARCHAR(255) | | Anonymous session ID used before verification |
| `slot_date` | DATE | NOT NULL | All booking_slots in this booking share this date |
| `session_start_time` | TIME | NOT NULL | Earliest slot start across all courts |
| `session_end_time` | TIME | NOT NULL | Latest slot end across all courts |
| `session_duration_mins` | SMALLINT | NOT NULL | Total time span in minutes (e.g., 9 AM–12 PM = 180) |
| `court_count` | SMALLINT | NOT NULL | Number of distinct courts in this booking |
| `slot_unit_count` | SMALLINT | NOT NULL | Total court×time_slot units (court_count × time slots selected) |
| `status` | VARCHAR(30) | NOT NULL, default 'pending_payment' | Enum: pending_payment, confirmed, expired, cancelled, walk_in, admin_block |
| `booking_type` | VARCHAR(20) | NOT NULL, default 'online' | Enum: online, walk_in, admin_block |
| `base_amount` | NUMERIC(10,2) | NOT NULL | Sum of all unit base prices before modifiers |
| `discount_amount` | NUMERIC(10,2) | NOT NULL, default 0.00 | Coupon + modifier reductions |
| `tax_amount` | NUMERIC(10,2) | NOT NULL, default 0.00 | |
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
CONFIRMED
    │
    │ (admin force-cancel)
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

**Lock acquisition order:** Always sorted by `(court_id, slot_date, slot_start_time)` before acquiring `SELECT ... FOR UPDATE` locks. This deterministic order prevents deadlocks when two users are simultaneously trying to book overlapping slot sets.

---

### `payments`

One record per payment attempt. A single booking may have multiple `payments` records (one per retry attempt). Only one will reach `status = 'success'`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `booking_id` | UUID | FK → bookings.id, NOT NULL | |
| `gateway` | VARCHAR(50) | NOT NULL, default 'phonepe' | Enum: phonepe, wallet |
| `merchant_order_id` | VARCHAR(255) | UNIQUE | `merchantOrderId` sent to PhonePe (e.g., `PP-abc123`). NULL for wallet-only payments |
| `gateway_order_id` | VARCHAR(255) | | PhonePe's internal `orderId` (e.g., `OMO...`); filled from webhook |
| `gateway_payment_id` | VARCHAR(255) | | PhonePe `transactionId` from `paymentDetails[0]`; filled on success |
| `upi_vpa` | VARCHAR(255) | | UPI VPA used (e.g., `user@ybl`); filled from webhook `splitInstruments` |
| `payment_mode` | VARCHAR(30) | | `UPI_INTENT`, `UPI_COLLECT`, or `UPI_QR`; filled from webhook |
| `amount` | NUMERIC(10,2) | NOT NULL | Amount sent to PhonePe in INR. 0.00 for wallet-only |
| `currency` | CHAR(3) | NOT NULL, default 'INR' | |
| `status` | VARCHAR(20) | NOT NULL, default 'initiated' | Enum: initiated, success, failed, refund_pending, refunded, refund_failed |
| `webhook_received_at` | TIMESTAMPTZ | | Timestamp of first webhook receipt |
| `idempotency_key` | VARCHAR(255) | UNIQUE | Same as `merchant_order_id`; used to deduplicate webhook redeliveries |
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

> **Design principle:** The reward system is a pluggable engine. `reward_mechanisms` defines *what* reward experiences are active (scratch card, spinner, etc.) and *how* they behave. `reward_instances` holds each user's individual reward generated by a trigger. Switching from scratch cards to spinners, running both simultaneously, or disabling rewards entirely is an admin configuration change — not a code or schema change. New mechanism types require only a new frontend component and new `config` JSONB handling in the prize-draw logic; no tables are added or removed.

> `wallet_credits` (Domain D) are monetary INR credits issued on business-initiated cancellations. Reward prizes *may* issue wallet credits as a prize outcome, but the two systems remain independent. Rewards do not use a points currency — each confirmed booking directly generates a reward instance.

---

### `reward_mechanisms`

Admin-managed table. One row per mechanism type per venue. Controls which reward experiences are live and how they behave. Multiple mechanisms can be active at the same time; a single booking confirmation creates one `reward_instance` per active mechanism.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `venue_id` | UUID | FK → venues.id, NOT NULL | |
| `name` | VARCHAR(255) | NOT NULL | Human label (e.g., "Post-Booking Scratch Card") |
| `type` | VARCHAR(50) | NOT NULL | Enum: `scratch_card`, `spinner`, `coupon_drop`, `points`. Extensible — new types added as new enum values. |
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
    { "id": "p1", "label": "Better luck next time!", "type": "no_prize",      "probability": 0.60 },
    { "id": "p2", "label": "₹50 Court Credit",       "type": "wallet_credit", "value": 50,         "probability": 0.25 },
    { "id": "p3", "label": "10% Off Next Booking",   "type": "coupon",        "coupon_template_id": "<uuid>", "probability": 0.12 },
    { "id": "p4", "label": "Free 1-Hour Session!",   "type": "free_booking",  "duration_mins": 60, "probability": 0.03 }
  ]
}
```

**`config` JSONB — `spinner` type (future):**
```json
{
  "segment_count": 8,
  "prizes": [
    { "id": "s1", "label": "Try Again",       "type": "no_prize",      "probability": 0.50 },
    { "id": "s2", "label": "₹100 Credit",     "type": "wallet_credit", "value": 100, "probability": 0.30 },
    { "id": "s3", "label": "Free Session",    "type": "free_booking",  "duration_mins": 60, "probability": 0.20 }
  ]
}
```

Prize probabilities across all entries in a `config` MUST sum to exactly 1.0. This is validated by the backend before saving the mechanism.

**Prize `type` values (shared across all mechanism types):**

| Type | Fulfillment |
|---|---|
| `no_prize` | Nothing issued |
| `wallet_credit` | `value` (INR) added to `users.wallet_credits` atomically |
| `coupon` | A one-time coupon is generated from `coupon_template_id` and activated |
| `free_booking` | A single-use free-booking entitlement is issued (yet to be designed in detail) |

---

### `reward_instances`

One row per user per booking per active mechanism at the time of trigger. The prize outcome is computed server-side at issuance using the mechanism's `config` probability distribution and stored in `outcome`. The outcome is **never returned in any GET endpoint** — it is only revealed when the user calls the reveal endpoint, after which `status` becomes `revealed`.

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
| `prize_type` | VARCHAR(30) | NOT NULL | Denormalized from `outcome.type` — allows querying prize distributions without parsing JSONB |
| `prize_value` | NUMERIC(10,2) | | Denormalized monetary value of the prize, if applicable (for analytics) |
| `revealed_at` | TIMESTAMPTZ | | Set on reveal |
| `expires_at` | TIMESTAMPTZ | NOT NULL | `created_at + instance_expiry_days`. Unrevealed instances past this date are expired by sweeper. |
| `fulfillment_status` | VARCHAR(20) | NOT NULL, default 'pending' | Enum: `pending`, `fulfilled`, `not_applicable`, `failed` |
| `fulfillment_note` | TEXT | | Error detail if fulfillment failed |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Unique constraint:** `(booking_id, mechanism_id)` — one instance per booking per mechanism; prevents duplicate issuance on webhook redelivery.

---

## Indexes

| Table | Index | Type | Purpose |
|---|---|---|---|
| `bookings` | (status, expires_at) | B-tree | Background expiry sweeper |
| `bookings` | (user_id, status) | B-tree | User booking history |
| `bookings` | (session_id) | B-tree | Anonymous session lookup |
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
| `reward_instances` | (user_id, status, expires_at) | B-tree | User's pending/revealed cards; expiry sweeper |

> **Venue-Aware Architecture Note:** All core tables include a `venue_id` column. The single active venue is resolved server-side at launch — no multi-venue routing headers or UI are required. When a second venue is added, indexing and query scoping already support it without schema changes.
