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
  User views the schedule page. Available slots are rendered based on live
  slot generation. No authentication required to browse.

Step 2 — Select & Lock
  User taps a slot. Backend immediately:
    a. Opens a database transaction.
    b. Checks slot availability with SELECT ... FOR UPDATE (row-level lock).
    c. If available: inserts a booking record with status = 'pending_payment',
       expires_at = NOW() + 10 minutes, and session_id from the client.
    d. Commits the transaction.
  The slot is now invisible to all other users.
  If two users click simultaneously, the database forces one to wait;
  the second request is rejected because the slot is taken.

Step 3 — Auth Gate (Name → Phone → OTP)
  The user is shown a bottom-sheet modal sequence:
    a. Name entry ("Almost there! Tell us your name.")
    b. Phone entry (+91 prefix, "Verify to Book")
    c. OTP entry (6-digit code, "Enter Code")
  The booking record is linked to the user's phone/session.
  If the user already exists (phone found in users table), the booking
  is attached to their profile. If new, a profile is created.

Step 4 — Checkout & Waiver
  User reviews the Order Summary (court, date, time, price breakdown).
  User must:
    a. Acknowledge the specific booking date and time (AM/PM trap prevention).
    b. Accept the no-cancellation / no-refund policy (digital waiver).
  Both acknowledgments are logged with timestamp, IP, and verified phone.

Step 5 — Payment
  Backend sends a payment intent to PhonePe with the locked total amount.
  User completes payment in the PhonePe interface.

Step 6 — Confirmation
  PhonePe sends a "Success" webhook to the backend.
  Backend checks idempotency_key; if already processed, silently ignores.
  If not yet processed:
    a. Updates booking status → 'confirmed'.
    b. Clears expires_at.
    c. Updates payment record.
    d. Sends WhatsApp confirmation + receipt to user.
```

### 4.2 Anti-Hoarding — Velocity Check

A single phone number or session ID cannot hold more than **2 slots in `pending_payment` state simultaneously**. Attempts beyond this limit return an error: "You already have 2 pending bookings. Complete or wait for them to expire before selecting another slot."

### 4.3 Slot Expiry (Background Sweeper)

A background job continuously monitors the `bookings` table. Any record where `status = 'pending_payment'` AND `expires_at < NOW()` is updated to `status = 'expired'`. The slot immediately re-enters the available pool.

The sweeper runs at an interval short enough (e.g., every 30 seconds) to ensure expired slots reappear promptly.

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

All notifications are delivered via WhatsApp API. SMS is a fallback if WhatsApp delivery fails.

| Trigger | Recipient | Message Content |
|---|---|---|
| OTP Request | User | 4-digit OTP code |
| Booking Confirmed (T=0) | User | Confirmation, booking details, receipt, court PIN (future) |
| Reminder (T−24 hours) | User | "You're playing tomorrow!" + booking details |
| Reminder (T−2 hours) | User | Final reminder + facility rules |
| Phantom Booking | User | Slot timeout apology + refund/credit confirmation |
| Force Majeure Cancel | User | Cancellation notice + credits issued |
| Stale Payment Alert | Admin | Conflict details requiring attention |
| New Walk-in Entry | Admin | Confirmation of manual booking creation |

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
