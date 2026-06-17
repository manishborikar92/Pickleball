# AI Project Context — Business Rules & State Machines

This document outlines the authoritative rules, matrices, and state transitions that govern pricing, permissions, and booking flows.

---

## 1. Role-Based Access Control (RBAC)

API routes are guarded by **permissions**, not roles. The permission checks (e.g. `requirePermission('edit_pricing')`) remain stable in code even if permissions assigned to roles change.

### 1.1 Permission Matrix

| Permission Key | super_admin | manager | staff | customer | Description |
|:---|:---:|:---:|:---:|:---:|:---|
| `manage_courts` | ✓ | | | | Modify court status (maintenance, active). |
| `edit_pricing` | ✓ | ✓ | | | Modify pricing rules, time/day multipliers. |
| `edit_schedule` | ✓ | ✓ | | | Modify weekly slots layout and overrides. |
| `manage_bookings` | ✓ | ✓ | ✓ | | Block courts, edit states, and cancellations. |
| `issue_credits` | ✓ | ✓ | | | Issue wallet refunds for force-majeure. |
| `walk_in_entry` | ✓ | ✓ | ✓ | | Book walk-in players, bypass PhonePe payment. |
| `view_own_bookings` | ✓ | ✓ | ✓ | ✓ | Query booking history logs. |
| `manage_venues` | ✓ | | | | Configure advance booking days or rollover time. |

---

## 2. Authentication & Onboarding Constraints

### 2.1 OTP Constraints
* **Validity Window**: OTP is valid for 5 minutes (300 seconds) from the request timestamp.
* **Attempt Limits**: Maximum of 5 verification attempts. On the 6th failed attempt, the OTP is invalidated.
* **Rate Limits**: OTP requests are limited to 5 sends per phone number per minute.

### 2.2 Staff Account Constraints
* **Lockout Rules**: 10 failed login attempts locks the staff credential record for 30 minutes.
* **Activation Limit**: Account activation link is valid for 72 hours.
* **Reset Limit**: Password reset email links are valid for 1 hour.

---

## 3. Court Scheduling & Booking Slots

* **Advance Booking Window**: Bookings are restricted to `today + advance_booking_days` (default 7 days).
* **Rollover Trigger Time**: Next day's slots become bookable at a venue-configurable rollover time (default 08:00 AM) rather than midnight.
* **Slot Selection Constraints**: A user booking session must contain consecutive slots with no gaps on a single date.
* **Court Holds**: Once a user initiates payment, the selected slots are locked via a database transaction for **10 minutes**. If payment is not confirmed within 10 minutes, the hold expires and slots become available.

---

## 4. Pricing Engine (Waterfall Logic)

All slot pricing calculations are executed server-side. The backend quotes prices using the following waterfall logic sequence:

```
[ Base Price ] ──► [ Time/Day Modifiers ] ──► [ Court Modifiers ]
                         (Pricing Rules)             (Pricing Rules)
                                                            │
                                                            ▼
[ Final Total ] ◄── [ Tax Application ] ◄── [ Wallet Credits ] ◄── [ Coupon Discounts ]
     (Quoted amount)       (18% GST)             (Deductions)          (Percentage or Flat)
```

1. **Base Price**: Query the court's hourly `base_price` (defined per court).
2. **Time/Day Modifiers**: Apply active `pricing_rules` of type `time_modifier` (e.g. Peak hours: Mon-Fri 18:00-22:00 +20%; Weekend peak: Sat-Sun 06:00-10:00 +30%). Apply modifiers ordered by priority descending.
3. **Court Modifiers**: Apply active `pricing_rules` of type `court_modifier` (e.g. Indoor Court premium: +10%).
4. **Coupon Discounts**: Apply active coupon code (percentage or flat discount) to the aggregate subtotal of all slot units. Max 1 coupon per booking session.
5. **Wallet Credits**: Deduct from the user's `wallet_credits` balance up to the remaining subtotal.
6. **Tax**: Apply 18% GST onto the final subtotal after coupons and credits are subtracted.
