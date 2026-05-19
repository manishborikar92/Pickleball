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
| `view_analytics` | ✓ | ✓ | | |
| `walk_in_entry` | ✓ | ✓ | ✓ | |
| `view_own_bookings` | ✓ | ✓ | ✓ | ✓ |

### 1.3 Contextual Venue Scoping

Roles are assigned per venue via `venue_user_roles`. At launch with a single venue, all operator accounts are assigned `super_admin` at that venue. The table structure is identical whether the platform has one venue or fifty — no schema change is needed when expanding.

All admin API queries are filtered to the venue(s) the requesting user has a role assignment for. A user with no role assignment at a venue sees it as if it does not exist.

### 1.4 Session Security

- Access tokens are **JWTs with a 24-hour expiry** at launch.
- On logout, the client discards the token. There is no server-side denylist at launch.

> **Future Enhancement — Redis JWT Denylist:** When staff account management requires instant revocation (e.g., a departing employee), a Redis denylist is added. The token expiry returns to 15 minutes. Only the `requirePermission` middleware is updated — no route changes required.

---

## 2. Scheduling System

### 2.1 Schedule Hierarchy

Availability is determined by layering three sources in order of precedence:

1. **Standard Operating Hours** (`schedules` table) — the default weekly template. Example: Mon–Sun, 06:00–22:00, 60-min slots.
2. **Daily Overrides** (`schedule_exceptions` table) — paint over any specific date. Types:
   - `closed` — no slots generated for that date.
   - `modified_hours` — custom open/close times for that date.
   - `blocked` — specific range marked reserved without a payment record.
3. **Existing Bookings** — confirmed and pending_payment bookings are subtracted from the available slot pool.

### 2.2 Slot Generation Rule

Slots are generated on-the-fly by the backend. Only slots whose **entire duration fits within the open/close window** are created. Partial trailing windows are silently dropped.

> **Example:** Open 09:00–12:00, slot duration 90 minutes → generates 09:00–10:30 and 10:30–12:00 only.

Changing the `slot_duration_mins` on a schedule takes effect immediately for all future slot calculations without any data migration.

### 2.3 Rollover Logic (Advance Booking Window)

To prevent a "midnight rush," a **Rollover Trigger Time** is set per venue (e.g., 08:00 AM).

- Each day at rollover time, the next available day (at the edge of the advance window) becomes bookable.
- **Example:** Venue has a 7-day advance window and rollover at 08:00. On Monday at 08:00, slots for the following Monday become visible.
- Before rollover time, the furthest bookable day is `today + advance_booking_days - 1`.

---

## 3. Pricing Engine (Waterfall Logic)

All pricing is calculated server-side. The backend generates a price quote that is locked into the booking record and passed directly to the payment gateway. The user always pays exactly the quoted amount.

### 3.1 Unit-Based Calculation

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

### 3.2 Calculation Sequence Per Unit

For each (court_id, slot_start_time) combination:

1. **Base Price** — Fetch `base_prices.amount` for the court.
2. **Time/Day Modifiers** — Query active `pricing_rules` of type `time_modifier`. Apply matching rules ordered by `priority` descending.
3. **Court Modifiers** — Apply active `pricing_rules` of type `court_modifier`.
4. Store result as `unit_price` for this slot unit.

After all units are priced:

5. **Coupon Application** — If a valid coupon is provided, apply flat or percentage discount to the sum of all unit prices. One coupon per booking.
6. **Wallet Credits** — Deduct up to the user's available `wallet_credits` balance.
7. **Tax** — Applied as a percentage on `(subtotal − coupon_discount)`.

### 3.3 Price Preview

A lightweight `POST /bookings/price-preview` endpoint accepts the full selection (court IDs + slot times) and returns the complete price breakdown without creating any database hold. The frontend calls this to display live pricing as the user adjusts their selection. The quote from this endpoint is informational — the authoritative quote is generated again at hold time.

### 3.4 Quote Validity

The price quote is recalculated at hold time (Step 2 of the booking flow). The hold quote is locked into `bookings.total_amount` and passed to PhonePe. The preview endpoint quote is advisory only.

---

## 4. Booking Flow & State Machine

### 4.1 Selection Model

A booking is a **session**: one date, one contiguous time range, covering one or more courts. The constraints are:

- All selected courts share the same date, start time, and end time.
- Selected time slots must be consecutive with no gaps. The backend validates this before any lock is attempted.
- At launch: 1 or 2 courts, 1 to N consecutive slots (N limited by venue operating hours).
- Asymmetric selection (Court 1 for 9–11 AM, Court 2 for 10–12 PM) is not supported — all courts must cover the same time range.

**Valid combinations:**
- 1 court × 1 slot (e.g., Court 1, 9:00–10:00)
- 1 court × 3 consecutive slots (e.g., Court 1, 9:00–12:00)
- 2 courts × 1 slot (e.g., Court 1 + Court 2, 9:00–10:00)
- 2 courts × 3 consecutive slots (e.g., Court 1 + Court 2, 9:00–12:00)

### 4.2 Full Booking Sequence

```
Step 1 — Browse (Unauthenticated)
  User views the booking page. Per-court slot grids are rendered.
  User selects one or both courts using court selector checkboxes.
  User taps time slots to build a consecutive range. The UI prevents
  non-consecutive selection and shows a live price preview (from the
  price-preview endpoint) that updates as courts and slots are toggled.

Step 2 — Confirm Selection → All-or-Nothing Lock
  User clicks "Confirm & Pay".
  Frontend sends the complete selection:
    { court_ids: [...], slot_date: "...", slot_start_times: [...] }

  Backend pre-validation (before touching the database):
    a. Verify all court_ids belong to the venue.
    b. Verify slot_start_times are consecutive with no gaps (using the
       venue's slot_duration_mins from the active schedule).
    c. Verify each slot exists in the generated slot array for that date.
    d. Velocity check: requesting user/session holds fewer than 2
       pending bookings.

  Backend lock phase (single database transaction):
    e. Compute all N × M slot units (court_ids × slot_start_times).
    f. Sort units by (court_id, slot_start_time) — deterministic order
       to prevent deadlocks.
    g. SELECT id FROM booking_slots WHERE (court_id, slot_date,
       slot_start_time) IN (...) AND status IN (active statuses)
       FOR UPDATE — attempts to lock all units atomically.
    h. Count locked rows. If count > 0 (any unit already held), the
       transaction rolls back. Return 409 with the list of unavailable
       (court_id, slot_start_time) pairs so the UI can highlight them.
    i. If all units are free: INSERT one bookings row + N×M
       booking_slots rows, all with status = 'pending_payment' and
       expires_at = NOW() + 10 minutes.
    j. Commit transaction.

  All N×M slot units are now locked and invisible to other users.

Step 3 — Auth Gate (Name → Phone → OTP)
  Bottom-sheet modal sequence — unchanged from single-slot flow.
  On OTP verification the booking record is linked to the user's profile.

Step 4 — Checkout Summary & Waiver
  Order Summary shows:
    - Court(s): "Court 1 + Court 2"
    - Date: "Sunday, 11 May 2025"
    - Time: "9:00 AM – 12:00 PM (3 hours)"
    - Price breakdown: per-unit table + coupon + tax + total
  User must acknowledge the full session time and no-refund policy.

Step 5 — Payment
  Identical to single-slot flow. PhonePe amount =
  total_amount − credits_applied.
  Wallet-only path applies when total_amount ≤ wallet_credits.

Step 6 — Confirmation
  On COMPLETED webhook or redirect verification:
    - bookings.status → 'confirmed'
    - All booking_slots.status → 'confirmed' (same transaction)
    - expires_at cleared
    - WhatsApp confirmation sent with full session summary
    - Reward instances issued (one per active mechanism)
```

### 4.3 Unavailability Reporting

When the lock phase fails because one or more slot units are taken, the backend returns the specific unavailable units so the frontend can:
- Keep the user's valid selections intact.
- Visually mark unavailable slots as "Just taken" in the grid.
- Allow the user to adjust their selection and retry without starting over.

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

### 4.4 Anti-Hoarding — Velocity Check

A single phone number or session ID cannot hold more than **2 bookings in `pending_payment` state simultaneously**, regardless of how many slot units each booking contains. Attempts beyond this limit are rejected before the lock phase begins.

### 4.5 Slot Expiry (Background Sweeper)

The sweeper finds bookings where `status = 'pending_payment'` AND `expires_at < NOW()`. For each:

1. Call `rollbackWalletCredits(bookingId)` if any credits were applied.
2. Update `bookings.status → 'expired'` and all child `booking_slots.status → 'expired'` in one transaction.

All slot units are released simultaneously, re-entering the available pool for all courts covered.

---

## 5. Edge Cases & Exception Handling

### 5.1 Stale Payment (Phantom Booking)

**Scenario:** User pays at minute 9. The bank takes 3 minutes to process. By minute 10, the sweeper expires all slot units. At minute 12, PhonePe sends the "Success" webhook, but one or more slot units have since been rebooked by another user.

**Resolution Sequence:**
1. Backend receives the webhook and finds the booking in `expired` state.
2. Query `booking_slots` for this booking. Check for conflicts in any `(court_id, slot_date, slot_start_time)` unit against active bookings.
3. If conflict exists: cannot confirm. Automatically notifies the Admin.
4. Immediately initiates a PhonePe refund OR issues equivalent wallet credits.
5. Sends a WhatsApp apology to the user.

### 5.2 Duplicate Webhook

**Scenario:** PhonePe sends the "Success" signal three times for the same transaction.

**Resolution:** The webhook endpoint checks `payments.idempotency_key` before processing. If the key already exists with `status = 'success'`, duplicate signals are gracefully ignored. No duplicate records are created.

### 5.3 AM/PM Booking Error Prevention

The checkout screen displays the full session time in an unambiguous format (e.g., "Sunday, 11 May — 9:00 AM to 12:00 PM, 3 hours") and requires a mandatory acknowledgment checkbox before the Pay button activates.

### 5.4 Manual Admin Block

Admin can mark any combination of courts and slots as `admin_block` without a payment record. The admin selects one or both courts and one or more consecutive slots. All selected `booking_slots` rows are inserted with `status = 'admin_block'` under one `bookings` parent record. These appear as "Unavailable" to users.

### 5.5 Walk-in Entry

Admin selects courts, date, and consecutive time slots for the walk-in player. The system:
1. Creates or matches an existing user record by phone.
2. Inserts one `bookings` row + all N×M `booking_slots` rows with `status = 'walk_in'`.
3. Records payment as cash (outside the gateway).
4. No OTP or payment gateway involvement.

---

## 6. Cancellation Policy & Wallet Credits

### 6.1 No-Cancellation Policy

All bookings are **100% non-refundable** once confirmed. Users acknowledge this at checkout.

### 6.2 Force Majeure / Business-Initiated Cancellations

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

## 7. Automated Notification Matrix

All notifications are delivered via the **Meta WhatsApp Cloud API (direct integration)**. All outbound messages use pre-approved Meta templates. See `06-WHATSAPP-INTEGRATION.md` for template category definitions, cost structure, and setup details.

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

## 8. Legal Compliance — Digital Waiver

The checkout flow includes a mandatory digital waiver step that cannot be bypassed. The system logs:

| Field | Source |
|---|---|
| `waiver_accepted` | Boolean, must be `true` to proceed |
| `waiver_accepted_at` | Server-side timestamp (not client-provided) |
| `waiver_ip_address` | Extracted from the request headers |
| Verified phone number | From the completed OTP session |

The waiver text covers: liability for physical injury, the no-refund policy, and acknowledgment of the specific booking time.

---

## 9. Admin Operations

### 9.1 Schedule Management

Admins can:
- Update standard operating hours per court (takes effect for future slot generation immediately).
- Create date-specific exceptions (close early, close entirely, block a range).
- Change slot duration — takes effect immediately for all future uncreated slots.

### 9.2 Pricing Management

Admins can add, edit, deactivate, or reorder `pricing_rules` and `coupons` through the dashboard. Changes take effect on the next booking attempt (not retroactively for confirmed bookings).

### 9.3 Basic Admin Reporting (Launch)

The admin dashboard surfaces the following at launch:

- Bookings list: filterable by date, court, status.
- Today's revenue total and booking count.
- User lookup by phone: booking history, wallet balance.

### 9.4 Business Intelligence — Deferred

> **Future Enhancement — Advanced Analytics:** The relational schema is structured to support the following once sufficient booking history exists (typically 3+ months):
> - Court utilization rate by hour and day — identifying empty slots for targeted Flash Sale pricing rules.
> - Peak demand signals — flagging slots booked within minutes of opening consistently, prompting a price increase recommendation.
> - Customer Lifetime Value (CLV) — ranked by confirmed booking value per verified phone number, enabling early-access booking windows for top players.
>
> This reporting layer is built on top of the existing schema with no structural changes. PostHog analytics already captures the event data needed to begin identifying patterns from day one.

---

## 10. Review System

The review screen allows:
- Star rating (1–5), required.
- Free-text comment, optional.
- Court selfie photo upload, **deferred** — the `photo_url` column exists in the schema; the upload feature and Cloudflare R2 integration for reviews is added post-launch.

One review is permitted per booking. Admin can suppress a review from public display (`is_published = false`) but cannot edit the content.

> **Note on review triggers:** At launch, review links are sent manually or surfaced in the My Bookings screen after a session ends. Automated WhatsApp review request messages are deferred along with the scheduled notification system.

---


## 11. Reward Engine

> **Design principle:** The reward system is a pluggable engine decoupled from any specific experience (scratch card, spinner, etc.). No points currency exists. Each confirmed booking directly triggers the active mechanism(s). Switching experiences, running multiple simultaneously, or disabling them entirely is an admin configuration action — not a code change.

### 11.1 Core Concepts

| Concept | Description |
|---|---|
| **Mechanism** | A configured reward experience. Defined in `reward_mechanisms`. Examples: "Post-Booking Scratch Card", "Weekend Spinner". |
| **Trigger Event** | What causes a mechanism to fire. Only `booking_confirmed` is active at launch. |
| **Instance** | A single user's reward generated by a trigger. One instance is created per booking per active mechanism. Stored in `reward_instances`. |
| **Outcome** | The specific prize the user receives. Pre-computed server-side at issuance. Never exposed until the user reveals. |
| **Reveal** | The user interaction that exchanges the pending instance for its outcome and triggers prize fulfillment. |

### 11.2 Instance Issuance

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

### 11.3 Outcome Pre-computation

At issuance time, the backend runs a server-side weighted random draw against `config.prizes` and selects a winning prize. The result is stored in `reward_instances.outcome` as JSONB.

```
outcome example:
{ "prize_id": "p2", "label": "₹50 Court Credit", "type": "wallet_credit", "value": 50 }
```

The draw is performed server-side every time. The frontend receives only the mechanism type and a token representing the instance — never the outcome. The outcome is revealed only when the user calls the reveal endpoint.

**Probability validation:** Before any `reward_mechanisms` record is saved (create or update), the backend validates that all prize probabilities sum to exactly 1.0. Rejected with a `400` error if they do not.

**Prize pool isolation:** Each instance stores a `config_snapshot` — a frozen copy of the mechanism's `config` at issuance time. If an admin later edits the prize pool (e.g., increases win probability), existing unrevealed instances retain their original outcome. The edit affects only future issuances.

### 11.4 Reveal Flow

1. User opens the reward screen and sees a pending instance (scratch card, spinner segment, etc.).
2. User interacts with the UI (scratches the card / taps spin).
3. Frontend calls `POST /rewards/instances/:id/reveal`.
4. Backend verifies:
   - Instance belongs to the authenticated user.
   - `status = 'pending'`.
   - `expires_at > NOW()` (not expired).
5. Backend marks `status = 'revealed'`, sets `revealed_at`.
6. Backend executes prize fulfillment (Section 11.5).
7. Backend returns the `outcome` in the response — this is the first time the client sees it.
8. Frontend animates the reveal to land on the returned outcome (scratch reveals the prize; spinner lands on the segment). The animation is purely cosmetic — it does not affect the result.

### 11.5 Prize Fulfillment

Fulfillment is executed atomically in the same transaction as the reveal status update.

| Prize Type | Fulfillment Action |
|---|---|
| `no_prize` | No action. Mark `fulfillment_status = 'not_applicable'`. |
| `wallet_credit` | Increment `users.wallet_credits` by `value`. Insert `wallet_transactions` row (type: `credit_issued`, reason: reward prize). Mark `fulfillment_status = 'fulfilled'`. |
| `coupon` | Generate a new one-time `coupons` record from the template (`coupon_template_id`). Set `max_uses_total = 1`, `max_uses_per_phone = 1`, assign to the user's phone. Return the coupon code in the outcome. Mark `fulfillment_status = 'fulfilled'`. |
| `free_booking` | Yet to be designed in detail. Mark `fulfillment_status = 'pending'` for admin follow-up. |

**On fulfillment failure:** The reveal transaction rolls back. The instance remains in `pending` state. The user can retry. The error is logged for admin visibility.

### 11.6 Instance Expiry

Unrevealed instances with `expires_at < NOW()` are swept by the background job. The sweeper updates `status = 'expired'`. Expired instances are never fulfillable and are removed from the user's active rewards screen.

The `instance_expiry_days` is configured per mechanism (default: 7 days). A shorter window creates urgency; a longer window reduces churn.

### 11.7 Adding or Switching Mechanisms

| Change | Required Action |
|---|---|
| Activate scratch cards | Create/enable a `reward_mechanisms` row with `type = 'scratch_card'` |
| Disable scratch cards | Set `reward_mechanisms.is_active = false` |
| Switch to spinner | Deactivate scratch card mechanism; activate a `spinner` mechanism |
| Run both simultaneously | Have both mechanisms `is_active = true`; each booking generates two instances |
| Disable all rewards | Set all mechanisms to `is_active = false`; no instances generated |
| Add a new mechanism type | Add enum value; write frontend component; no schema or table changes |

### 11.8 Admin Controls

| Action | Permission |
|---|---|
| Create / edit / deactivate mechanisms | `edit_pricing` |
| Edit prize probabilities (config JSONB) | `edit_pricing` |
| View a user's reward instance history | `manage_bookings` |
| Manually expire an instance | `manage_bookings` |
| Fulfill pending `free_booking` prizes | `manage_bookings` |
| View reward analytics (win rates, prize distribution) | `view_analytics` |
