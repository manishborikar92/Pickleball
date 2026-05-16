# Pickleball Platform — Business Logic & Workflows

This document defines all business rules, state transitions, edge cases, and operational policies. The backend is the single source of truth for all logic described here. The frontend never computes prices, availability, or booking states independently.

---

## 1. Role-Based Access Control (RBAC)

### 1.1 Permission Model

Routes are guarded by **permissions**, not role names. The backend checks `hasPermission('edit_pricing')`, not `isAdmin`. This allows roles to be reconfigured without touching code.

### 1.2 Default Permission Sets

| Permission Key | Super Admin | Manager | Staff | Customer |
|---|:---:|:---:|:---:|:---:|
| `manage_venues` | ✓ | | | |
| `manage_courts` | ✓ | ✓ | | |
| `edit_pricing` | ✓ | ✓ | | |
| `edit_schedule` | ✓ | ✓ | | |
| `manage_bookings` | ✓ | ✓ | ✓ | |
| `issue_credits` | ✓ | ✓ | | |
| `view_analytics` | ✓ | ✓ | | |
| `walk_in_entry` | ✓ | ✓ | ✓ | |
| `view_own_bookings` | ✓ | ✓ | ✓ | ✓ |

### 1.3 Contextual Scoping

Roles are assigned per venue via the `venue_user_roles` table. A user can be a Manager at Venue A and only a Customer at Venue B. All API responses and admin queries are automatically filtered to the requesting user's venue scope.

### 1.4 Session Security

- Access tokens are JWTs with a **15-minute expiry**.
- On admin revocation or logout, the token signature is written to a **Redis Denylist**.
- Every sensitive API request checks the Denylist before processing. A listed token is immediately rejected regardless of its expiry time.

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
   - If `is_stackable = false`: replace all modifiers above with the coupon value (coupon discount is applied directly to base price).
   - If `is_stackable = true`: apply coupon discount on top of the modified price.
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

All notifications are delivered via the **Meta WhatsApp Cloud API (direct integration)**. An SMS fallback is triggered if the WhatsApp message is not delivered within a configurable timeout (e.g., 30 seconds for OTPs). All outbound messages use pre-approved Meta templates. Inbound support replies are free-form messages sent within the 24-hour Customer Service Window (CSW).

See `06-WHATSAPP-INTEGRATION.md` for template category definitions, cost structure, and setup details.

| Trigger | Recipient | WhatsApp Template Category | Charged? | Notes |
|---|---|---|---|---|
| OTP Request | User | **Authentication** | Yes, ~₹0.115–0.145 | Must use Meta's authentication template format |
| Booking Confirmed (T=0) | User | **Utility** | Free if within CSW; else ~₹0.16 | Triggered after payment webhook; user likely active |
| Reminder (T−24 hours) | User | **Utility** | Yes, ~₹0.16 | Outside CSW; charged per message |
| Reminder (T−2 hours) | User | **Utility** | Yes, ~₹0.16 | Outside CSW; charged per message |
| Phantom Booking Apology | User | **Utility** | Free if within CSW; else ~₹0.16 | Transactional/account update |
| Force Majeure Cancellation | User | **Utility** | Free if within CSW; else ~₹0.16 | Transactional/account update |
| Wallet Credit Issued | User | **Utility** | Free if within CSW; else ~₹0.16 | Account notification |
| Review Request (post-session) | User | **Utility** | Yes, ~₹0.16 | Sent after slot end time; always outside CSW |
| Flash Sale / Loyalty Promo | User | **Marketing** | Yes, ~₹0.86 | Requires explicit opt-in from user |
| Stale Payment Alert | Admin | Internal (email/dashboard) | N/A | Not sent via WhatsApp |
| New Walk-in Entry | Admin | Internal (dashboard) | N/A | Not sent via WhatsApp |

> **18% GST** applies on top of all WhatsApp template message charges billed in India.
> All rupee rates above are Meta's Tier 1 base rates for India (per message, as of Jan 2026). Rates reset monthly; check Meta's official rate card for the latest figures.

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

### 9.3 Business Intelligence (Future)

The relational structure supports future reporting:

- **Utilization rate** per court per hour block — identifies consistently empty slots to prompt Flash Sale pricing rules.
- **Peak demand signals** — if a specific slot is booked within 5 minutes of opening for 4 consecutive weeks, the system flags it for price increase recommendation.
- **Customer Lifetime Value** — ranked by total confirmed booking value per verified phone number; enables early-access booking windows for top-5% players.

---

## 10. Review System

A review request is triggered automatically via WhatsApp **after a booking's slot end time has passed** (i.e., the session is over). The user taps a link to open the review screen.

The review screen allows:
- Star rating (1–5), required.
- Free-text comment (optional).
- Court selfie photo upload to Cloudflare R2 (optional).

One review is permitted per booking. Admin can suppress a review from public display (`is_published = false`) but cannot edit the content.

---

## 11. Loyalty Points System

> **Terminology:** Loyalty points are non-monetary engagement points — distinct from `wallet_credits`, which are monetary INR credits issued only on business-initiated cancellations. The two systems are independent and must never be conflated in code or UI.

### 11.1 Earning Rules

Points are awarded automatically by the backend. The user takes no action to earn them.

| Event | Points Awarded | Condition |
|---|---|---|
| Booking confirmed (online) | **1 point** | Status transitions to `confirmed` via payment webhook |
| Booking confirmed (walk-in) | **1 point** | Admin creates a walk-in entry |
| Admin block | 0 points | No user is associated |

Points are **never awarded** for:
- Bookings in `pending_payment` or `expired` state.
- Cancelled bookings (force-majeure or otherwise).
- Duplicate webhook signals for an already-confirmed booking.

The award happens atomically inside the same database transaction that confirms the booking, ensuring no booking is confirmed without its point being issued, and no orphaned points exist without a confirmed booking.

### 11.2 Point Transaction Integrity

Every change to a user's point balance — positive or negative — is recorded as an immutable row in `loyalty_point_transactions` before `users.loyalty_points` is updated. The `balance_after` column on each transaction row is a snapshot that allows auditing the full history and detecting any inconsistencies.

**Balance update sequence (atomic):**
1. Insert row into `loyalty_point_transactions` with `balance_after = current_balance + delta`.
2. Update `users.loyalty_points` to the new balance.
3. Both operations occur within the same database transaction; if either fails, both roll back.

### 11.3 Redemption Rules

Users spend points by selecting a reward from the rewards catalogue.

**Pre-redemption checks (all must pass):**
1. `loyalty_rewards.is_active = true`.
2. Current date is within `valid_from` and `valid_until` (if set).
3. `loyalty_rewards.stock > 0` (if stock is finite). Stock is decremented atomically.
4. `users.loyalty_points >= loyalty_rewards.points_cost`.

**On successful redemption:**
1. Deduct points: insert a `loyalty_point_transactions` row with `type = 'redeemed'` and negative `points`.
2. Update `users.loyalty_points`.
3. Insert a `loyalty_redemptions` row with `status = 'pending'`.
4. Execute the reward fulfillment logic based on `loyalty_rewards.type`:
   - `game` — run the prize draw using probabilities in `metadata.prizes`; store the outcome in `loyalty_redemptions.outcome`; if the prize is a coupon or wallet credit, issue it immediately.
   - `discount_voucher` — generate and activate a one-time coupon record; store the code in `loyalty_redemptions.outcome`.
   - `physical_item` — mark `status = 'pending'` for admin to fulfill manually; notify admin.
   - `experience` — Yet to be decided.
5. Update `loyalty_redemptions.status` to `fulfilled` (or `failed` if fulfillment errors).

**On failed fulfillment:** Points are reinstated by inserting a correcting `loyalty_point_transactions` row with `type = 'admin_adjustment'` and a positive value, and the `loyalty_redemptions.status` is set to `failed`.

### 11.4 Spinner Game Logic

The spinner is a `loyalty_rewards` entry of `type = 'game'`. The prize pool and probabilities are stored in `metadata.prizes`. Each prize has:
- `label` — display name shown on the spinner wheel.
- `probability` — a decimal between 0 and 1; all probabilities in the array must sum to exactly 1.0.
- `reward_type` — what is issued: `court_credit` (monetary wallet credit), `coupon`, `none` (no prize).
- `value` or `coupon_code` — the specific reward issued on win.

The backend determines the winning prize server-side using a seeded random draw against the probability distribution. The client animates the spinner to land on the server-determined outcome. **The result is never computed on the frontend.**

### 11.5 Point Expiry

Point expiry policy: **Yet to be decided.** Options: no expiry, expiry after N months of inactivity, expiry after a fixed date. When implemented, expired points are recorded as a `loyalty_point_transactions` row with `type = 'expired'`.

### 11.6 Admin Controls

| Action | Permission Required |
|---|---|
| View any user's point balance and history | `manage_bookings` |
| Manually grant or deduct points (with a note) | `issue_credits` |
| Create / edit / deactivate loyalty rewards | `edit_pricing` |
| Fulfill pending physical item redemptions | `manage_bookings` |
| Edit spinner prize probabilities | `edit_pricing` |
