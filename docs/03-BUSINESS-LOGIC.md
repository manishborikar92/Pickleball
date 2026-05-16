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

All pricing is calculated server-side at the moment a slot is selected. The backend generates a price quote that is locked into the booking record and passed directly to the payment gateway. The user always pays exactly the quoted amount.

### 3.1 Calculation Sequence

The following steps are applied in strict order:

1. **Base Price** — Fetch `base_prices.amount` for the court.
2. **Time/Day Modifiers** — Query active `pricing_rules` of type `time_modifier`. Apply matching rules ordered by `priority` (descending). Example: Weekend +20%, or Early Morning −50%.
3. **Court Modifiers** — Apply active `pricing_rules` of type `court_modifier`. Example: Indoor courts +10%.
4. **Coupon Application** — If a valid coupon code is provided:
   - Check code is active, within valid date range, has not exceeded `max_uses_total`, and has not exceeded `max_uses_per_phone` for the user's phone.
   - Coupon discount is applied on top of any time/court modifiers already applied.
   - Only one coupon may be applied per booking.
5. **Wallet Credits** — Deduct up to the available `users.wallet_credits` balance. Credits cannot exceed the total payable amount.
6. **Tax** — Applied as a percentage on the final discounted amount. Stored in the booking as `tax_amount`.

### 3.2 Quote Validity

The generated price quote is valid only for the duration of the 10-minute slot hold. If the lock expires, any new attempt re-triggers a fresh price calculation.

---

## 4. Booking Flow & State Machine

### 4.1 Full Booking Sequence

```
Step 1 — Browse (Unauthenticated)
  User views the schedule page. Available slots rendered from live slot
  generation. No authentication required to browse.

Step 2 — Select & Lock
  User taps a slot. Backend immediately:
    a. Opens a database transaction.
    b. Checks slot availability with SELECT ... FOR UPDATE (row-level lock).
    c. If available: inserts a booking record with status = 'pending_payment',
       expires_at = NOW() + 10 minutes, and session_id from the client.
    d. Commits. Slot is now invisible to all other users.
  If two users click simultaneously, the database forces one to wait;
  the second request fails because the slot is already locked.

Step 3 — Auth Gate (Name → Phone → OTP)
  Bottom-sheet modal sequence:
    a. Name entry.
    b. Phone entry (+91 prefix).
    c. 6-digit OTP entry.
  The booking record is linked to the verified phone number.
  Existing users: booking attached to their profile.
  New users: profile created from name + phone.
  Velocity check: if the phone already holds 2 pending bookings, block.

Step 4 — Checkout Summary & Waiver
  User reviews Order Summary (court, date, full time string, price breakdown).
  Wallet credit balance is displayed if > 0; user can toggle credit application.
  User must check both:
    a. Time acknowledgment (exact date and time, AM/PM explicit).
    b. No-cancellation / no-refund policy (digital waiver).
  Both logged with server-side timestamp, IP address, and verified phone.

Step 5 — Payment Initiation
  User clicks "Confirm & Pay".
  Backend computes final price quote with wallet credits applied:

    total_payable  = base + modifiers - coupon + tax
    credits_applied = min(wallet_credits, total_payable)
    phonepe_amount  = total_payable - credits_applied

  PATH A — Wallet-Only (phonepe_amount == 0):
    a. Deduct credits_applied from users.wallet_credits (in DB transaction).
    b. Insert wallet_transactions record (credit_redeemed).
    c. Update booking status → 'confirmed' immediately.
    d. Insert payments record (gateway='wallet', status='success', amount=0).
    e. Return { type: 'wallet_only' } to frontend.
    f. Trigger WhatsApp confirmation + PostHog event.

  PATH B — PhonePe UPI Required (phonepe_amount > 0):
    a. Optimistically deduct credits_applied from users.wallet_credits.
    b. Insert wallet_transactions record (credit_redeemed).
    c. Create PhonePe order with phonepe_amount (in paisa) via API v2.
    d. paymentModeConfig restricts to UPI_INTENT, UPI_COLLECT, UPI_QR only.
    e. Return { type: 'phonepe', redirect_url, merchant_order_id } to frontend.

Step 6 — PhonePe Pay Page (PATH B only)
  Frontend loads PhonePe JS bundle and calls:
    PhonePeCheckout.transact({ tokenUrl: redirect_url, callback, type: 'IFRAME' })
  User completes UPI payment on PhonePe's hosted pay page.
  On completion PhonePe fires both a browser redirect (Step 7) and a
  server-to-server webhook (Step 8).

Step 7 — Browser Redirect (Secondary Verification, PATH B)
  PhonePe redirects browser to:
    GET /api/payment/redirect?orderId={merchant_order_id}
  Backend calls PhonePe Order Status API:
    COMPLETED → confirm booking (idempotent) → redirect to /booking/success
    FAILED    → rollback wallet credits → redirect to /booking/failed
    PENDING   → redirect to /booking/pending (webhook will settle it)

Step 8 — Webhook (Primary Confirmation, PATH B)
  PhonePe sends S2S webhook to POST /api/webhooks/phonepe.
  Backend verifies SHA256 auth header. Responds 200 immediately.
  Processes asynchronously:
    checkout.order.completed + state=COMPLETED:
      Check idempotency_key — if already confirmed, exit silently.
      DB transaction: confirm booking, finalize wallet deduction,
      update payment record, send WhatsApp confirmation.
    checkout.order.failed:
      Rollback wallet credits. Update payment to 'failed'.
    pg.refund.completed:
      Update payment to 'refunded'. Send WhatsApp to user.
```

### 4.2 Payment Failure & Retry

When `state === 'FAILED'` is received from either the redirect handler or the webhook:
- Rollback the optimistically deducted wallet credits.
- Do **not** expire the booking hold — give the user a chance to retry within the remaining hold time.
- Frontend shows a "Try Again" button.
- On retry: generate a **new** `merchantOrderId` (never reuse the failed order ID).
- If the booking hold has already expired by the time the user retries: inform the user, redirect to the booking page.

### 4.3 PENDING State Handling

If Order Status API returns `PENDING` after the browser redirect:
- Frontend polls `GET /api/payment/status/:merchantOrderId` (every 5 seconds, max 5 polls).
- If terminal state reached during polling: process accordingly.
- After 5 polls without a terminal state: stop polling, show "Payment processing — you will be notified via WhatsApp."
- Webhook delivers the terminal state eventually. Do **not** cancel or rollback while PENDING.
- Do **not** release wallet credits while PENDING.

### 4.4 Anti-Hoarding — Velocity Check

A single phone number or session ID cannot hold more than **2 slots in `pending_payment` state simultaneously**. Attempts beyond this limit return an error: "You already have 2 pending bookings. Complete or wait for them to expire before selecting another slot."

### 4.5 Slot Expiry (Background Sweeper)

A background job continuously monitors the `bookings` table. Any record where `status = 'pending_payment'` AND `expires_at < NOW()` is updated to `status = 'expired'`. The slot immediately re-enters the available pool.

Before expiring each booking, the sweeper calls `rollbackWalletCredits(bookingId)` to return any optimistically deducted credits.

The sweeper runs every **30 seconds**.

---

## 5. Edge Cases & Exception Handling

### 5.1 Stale Payment (Phantom Booking)

**Scenario:** User pays at minute 9. The bank takes 3 minutes to process. By minute 10, the sweeper expires the slot. At minute 12, PhonePe sends the "Success" webhook, but the slot has since been booked by another user.

**Resolution Sequence:**
1. Backend receives the webhook and finds the booking in `expired` state.
2. Backend cannot confirm the booking — flags the conflict.
3. Automatically notifies the Admin with booking details.
4. Immediately initiates a refund via PhonePe API OR issues equivalent wallet credits.
5. Sends a WhatsApp message to the user: "Your payment was processed, but the slot timed out and was taken. A refund/credit is being processed."

### 5.2 Duplicate Webhook

**Scenario:** PhonePe sends the "Success" signal three times for the same transaction.

**Resolution:** The webhook endpoint checks `payments.idempotency_key` before processing. If the key already exists with `status = 'success'`, the duplicate signals are gracefully ignored with a 200 OK response. No duplicate records are created.

### 5.3 AM/PM Booking Error Prevention

The checkout screen displays the full booking time in an unambiguous format (e.g., "Tomorrow, Saturday 17 May — 07:00 PM to 08:00 PM") and requires a mandatory acknowledgment checkbox before the Pay button activates.

### 5.4 Manual Admin Block

Admin can mark any slot or range of slots as `admin_block` without a payment record. Use cases: VIP reservations, court maintenance, photography sessions. These appear as "Unavailable" to users with no further explanation.

### 5.5 Walk-in Entry

Admin enters the player's Name and Phone. The system:
1. Creates or matches an existing user record.
2. Inserts a booking with `status = 'walk_in'` and `booking_type = 'walk_in'`.
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
