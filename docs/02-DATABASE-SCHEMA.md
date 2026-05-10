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
| `wallet_credits` | NUMERIC(10,2) | NOT NULL, default 0.00 | Platform credit balance (INR) |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

---

### `roles`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `name` | VARCHAR(50) | UNIQUE, NOT NULL | e.g., "super_admin", "manager", "customer" |
| `description` | TEXT | | |

---

### `permissions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `key` | VARCHAR(100) | UNIQUE, NOT NULL | e.g., "edit_pricing", "manage_bookings" |
| `description` | TEXT | | |

---

### `role_permissions`

| Column | Type | Constraints |
|---|---|---|
| `role_id` | UUID | FK → roles.id |
| `permission_id` | UUID | FK → permissions.id |
| PK | | (role_id, permission_id) |

---

### `venue_user_roles`

Maps a user to a role within a specific venue. A user may have different roles at different venues.

| Column | Type | Constraints |
|---|---|---|
| `user_id` | UUID | FK → users.id |
| `venue_id` | UUID | FK → venues.id |
| `role_id` | UUID | FK → roles.id |
| `assigned_at` | TIMESTAMPTZ | NOT NULL, default now() |
| PK | | (user_id, venue_id) |

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
| `is_stackable` | BOOLEAN | NOT NULL, default false | If false, overrides time modifiers instead of stacking |
| `valid_from` | TIMESTAMPTZ | | |
| `valid_until` | TIMESTAMPTZ | | |
| `is_active` | BOOLEAN | NOT NULL, default true | |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

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

The central transaction record. Every booking passes through a defined state machine.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `venue_id` | UUID | FK → venues.id, NOT NULL | |
| `court_id` | UUID | FK → courts.id, NOT NULL | |
| `user_id` | UUID | FK → users.id | NULL until OTP verified |
| `session_id` | VARCHAR(255) | | Anonymous session ID used before verification |
| `slot_date` | DATE | NOT NULL | |
| `slot_start_time` | TIME | NOT NULL | |
| `slot_end_time` | TIME | NOT NULL | |
| `duration_mins` | SMALLINT | NOT NULL | |
| `status` | VARCHAR(30) | NOT NULL, default 'pending_payment' | Enum: pending_payment, confirmed, expired, cancelled, walk_in |
| `booking_type` | VARCHAR(20) | NOT NULL, default 'online' | Enum: online, walk_in, admin_block |
| `base_amount` | NUMERIC(10,2) | NOT NULL | Before modifiers |
| `discount_amount` | NUMERIC(10,2) | NOT NULL, default 0.00 | |
| `tax_amount` | NUMERIC(10,2) | NOT NULL, default 0.00 | |
| `total_amount` | NUMERIC(10,2) | NOT NULL | Final amount charged |
| `credits_applied` | NUMERIC(10,2) | NOT NULL, default 0.00 | |
| `coupon_id` | UUID | FK → coupons.id | |
| `expires_at` | TIMESTAMPTZ | | For pending_payment; NULL once confirmed |
| `waiver_accepted` | BOOLEAN | NOT NULL, default false | |
| `waiver_accepted_at` | TIMESTAMPTZ | | |
| `waiver_ip_address` | INET | | |
| `access_pin` | CHAR(4) | | For future smart lock integration |
| `notes` | TEXT | | Admin notes for walk-ins/blocks |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Booking Status State Machine:**

```
AVAILABLE
    │ (user selects slot)
    ▼
PENDING_PAYMENT  ──── (10 min timeout) ────► EXPIRED
    │
    │ (payment success webhook)
    ▼
CONFIRMED
    │
    │ (admin force-cancel)
    ▼
CANCELLED
```

**Unique Constraint:** `(court_id, slot_date, slot_start_time)` WHERE `status IN ('pending_payment', 'confirmed', 'walk_in', 'admin_block')` — enforced via a partial unique index to prevent double-booking.

---

### `payments`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `booking_id` | UUID | FK → bookings.id, NOT NULL | |
| `gateway` | VARCHAR(50) | NOT NULL, default 'phonepe' | |
| `gateway_order_id` | VARCHAR(255) | UNIQUE | ID generated by PhonePe |
| `gateway_payment_id` | VARCHAR(255) | | Filled on success |
| `amount` | NUMERIC(10,2) | NOT NULL | |
| `currency` | CHAR(3) | NOT NULL, default 'INR' | |
| `status` | VARCHAR(20) | NOT NULL, default 'initiated' | Enum: initiated, success, failed, refunded |
| `webhook_received_at` | TIMESTAMPTZ | | |
| `idempotency_key` | VARCHAR(255) | UNIQUE | Prevents duplicate webhook processing |
| `refund_amount` | NUMERIC(10,2) | | |
| `refund_initiated_at` | TIMESTAMPTZ | | |
| `raw_webhook_payload` | JSONB | | Full webhook body for debugging |
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
| `court_id` | UUID | FK → courts.id, NOT NULL | |
| `rating` | SMALLINT | NOT NULL, CHECK (1–5) | |
| `comment` | TEXT | | Optional free-text |
| `photo_url` | VARCHAR(500) | | Cloudflare R2 URL |
| `is_published` | BOOLEAN | NOT NULL, default true | Admin can suppress |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

---

## Indexes

| Table | Index | Type | Purpose |
|---|---|---|---|
| `bookings` | (court_id, slot_date, slot_start_time) WHERE active | Partial Unique | Prevent double-booking |
| `bookings` | (status, expires_at) | B-tree | Background expiry sweeper |
| `bookings` | (user_id, status) | B-tree | User booking history |
| `bookings` | (session_id) | B-tree | Anonymous session lookup |
| `payments` | (idempotency_key) | Unique | Webhook deduplication |
| `otp_requests` | (phone, created_at) | B-tree | Rate limiting |
| `coupon_usages` | (coupon_id, phone) | B-tree | Per-phone usage check |
| `venue_user_roles` | (user_id, venue_id) | Unique | One role per user per venue |
