# Pickleball Platform — API Specification

All endpoints are served under `/api/v1`. The backend is the single authority on pricing, availability, and booking state. The frontend never bypasses or replicates this logic.

---

## 1. Authentication & Headers

### Auth Scheme

| Header | Required On | Value |
|---|---|---|
| `Authorization` | Protected routes | `Bearer <access_token>` |
| `Content-Type` | POST/PATCH/PUT | `application/json` |

### Token Lifecycle

- Access token expires in **24 hours** at launch.
- On logout, the client discards the token locally. No server-side denylist at launch.

> **Future Enhancement — Redis JWT Denylist:** When staff accounts require instant revocation, a Redis denylist is introduced and JWT expiry returns to 15 minutes. Only the auth middleware changes — no route updates required.

### Permission Guards

All protected routes use a `requirePermission('capability_key')` middleware that resolves the requesting user's role at the current venue via `venue_user_roles`, then checks `role_permissions` for the required capability.

### Permission Errors

| Status | Meaning |
|---|---|
| `401 Unauthorized` | Missing or invalid token |
| `403 Forbidden` | Valid token but the user's role does not have the required permission |

---

## 2. Auth Endpoints

### `POST /auth/otp/send`

Sends an OTP to the provided phone number via WhatsApp. Rate-limited per phone.

**Body:**
```json
{ "phone": "+919876543210" }
```

**Response `200`:**
```json
{ "message": "OTP sent", "expires_in_seconds": 300 }
```

**Errors:** `429 Too Many Requests` if rate limit exceeded.

---

### `POST /auth/otp/verify`

Verifies the OTP and returns a JWT pair.

**Body:**
```json
{ "phone": "+919876543210", "otp": "4829" }
```

**Response `200`:**
```json
{
  "access_token": "<jwt>",
  "refresh_token": "<jwt>",
  "user": { "id": "<uuid>", "phone": "+919876543210", "name": "Arjun Mehta", "is_new_user": false }
}
```

**Errors:** `400` invalid OTP, `410` OTP expired.

---

### `POST /auth/refresh`

**Body:**
```json
{ "refresh_token": "<jwt>" }
```

**Response `200`:**
```json
{ "access_token": "<jwt>" }
```

---

### `POST /auth/logout`

*Protected.* Client discards the token. At launch this is a client-side operation only — no server-side token invalidation. When the Redis denylist is added, this endpoint writes the token to Redis.

**Response `204 No Content`**

---

## 3. User Endpoints

### `GET /users/me`

*Protected.* Returns the authenticated user's profile including wallet balance.

**Response `200`:**
```json
{
  "id": "<uuid>",
  "phone": "+919876543210",
  "name": "Arjun Mehta",
  "wallet_credits": 500.00
}
```

---

### `PATCH /users/me`

*Protected.* Update name.

**Body:**
```json
{ "name": "Arjun Mehta" }
```

**Response `200`:** Updated user object.

---

### `GET /users/me/bookings`

*Protected.* Returns all bookings for the authenticated user.

**Query params:** `status` (confirmed, expired, cancelled), `page`, `limit`.

**Response `200`:**
```json
{
  "data": [
    {
      "id": "<uuid>",
      "court": { "id": "<uuid>", "name": "Court 1" },
      "venue": { "id": "<uuid>", "name": "Besa, Nagpur" },
      "slot_date": "2025-05-17",
      "slot_start_time": "09:00",
      "slot_end_time": "10:00",
      "status": "confirmed",
      "total_amount": 590.00,
      "has_review": false
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5 }
}
```

---

### `GET /users/me/wallet`

*Protected.* Returns wallet balance and transaction history.

**Response `200`:**
```json
{
  "balance": 500.00,
  "transactions": [
    {
      "id": "<uuid>",
      "type": "credit_issued",
      "amount": 500.00,
      "balance_after": 500.00,
      "reason": "Force majeure cancellation — Court 1",
      "created_at": "2025-05-10T14:30:00Z"
    }
  ]
}
```

---

## 4. Venue & Court Endpoints

### `GET /venues/:venueId`

*Public.* Returns venue details.

**Response `200`:**
```json
{
  "id": "<uuid>",
  "name": "Besa, Nagpur",
  "address": "123 Pickleball Way, Besa, Nagpur",
  "city": "Nagpur",
  "timezone": "Asia/Kolkata",
  "advance_booking_days": 7,
  "rollover_time": "08:00",
  "phone": "0880 123-4687",
  "courts": [
    { "id": "<uuid>", "name": "Court 1", "environment": "Indoor", "status": "active" },
    { "id": "<uuid>", "name": "Court 2", "environment": "Indoor", "status": "active" }
  ]
}
```

---

### `GET /venues/:venueId/courts/:courtId`

*Public.* Returns court details including cover image URL.

---

## 5. Scheduling & Availability Endpoints

### `GET /venues/:venueId/availability`

*Public.* Returns available slot arrays for all courts on a given date. The frontend uses this to render the per-court slot grids. Users can select multiple courts and multiple consecutive slots from this response — the selection is accumulated client-side and submitted as a batch to `/bookings/hold`.

**Query params:** `date` (YYYY-MM-DD, required).

**Response `200`:**
```json
{
  "date": "2025-05-17",
  "slot_duration_mins": 60,
  "courts": [
    {
      "court_id": "<uuid>",
      "court_name": "Court 1",
      "environment": "Indoor",
      "slots": [
        { "start_time": "08:00", "end_time": "09:00", "status": "available", "unit_price": 500.00 },
        { "start_time": "09:00", "end_time": "10:00", "status": "booked" },
        { "start_time": "10:00", "end_time": "11:00", "status": "available", "unit_price": 600.00 },
        { "start_time": "11:00", "end_time": "12:00", "status": "available", "unit_price": 600.00 }
      ]
    },
    {
      "court_id": "<uuid>",
      "court_name": "Court 2",
      "environment": "Indoor",
      "slots": [
        { "start_time": "08:00", "end_time": "09:00", "status": "available", "unit_price": 550.00 },
        { "start_time": "09:00", "end_time": "10:00", "status": "available", "unit_price": 660.00 },
        { "start_time": "10:00", "end_time": "11:00", "status": "pending" },
        { "start_time": "11:00", "end_time": "12:00", "status": "available", "unit_price": 660.00 }
      ]
    }
  ]
}
```

**`unit_price`** is the per-slot price for that specific court at that time (base + modifiers), pre-calculated. Only present when `status = 'available'`. The frontend uses these to show live price totals as selections are made, while `/bookings/price-preview` provides the authoritative server-side total before holding.

**`status` values:** `available`, `booked` (confirmed/walk-in), `pending` (locked by another user's 10-minute hold), `blocked` (admin block).

**Notes:**
- Only dates within the advance booking window are returned with slot data.
- `slot_duration_mins` is included so the frontend can enforce the consecutive-slots-only selection rule.

---

## 6. Booking Endpoints

### `POST /bookings/price-preview`

*Public (session-based).* Returns a full price breakdown for a given selection without creating any database record or lock. Called by the frontend as the user adjusts court and slot selections to show live pricing.

**Body:**
```json
{
  "venue_id": "<uuid>",
  "court_ids": ["<uuid1>", "<uuid2>"],
  "slot_date": "2025-05-17",
  "slot_start_times": ["09:00", "10:00", "11:00"]
}
```

**Response `200`:**
```json
{
  "court_count": 2,
  "slot_count": 3,
  "slot_unit_count": 6,
  "session_start_time": "09:00",
  "session_end_time": "12:00",
  "session_duration_mins": 180,
  "price_breakdown": {
    "units": [
      { "court_name": "Court 1", "slot_start_time": "09:00", "unit_price": 600.00 },
      { "court_name": "Court 1", "slot_start_time": "10:00", "unit_price": 600.00 },
      { "court_name": "Court 1", "slot_start_time": "11:00", "unit_price": 600.00 },
      { "court_name": "Court 2", "slot_start_time": "09:00", "unit_price": 660.00 },
      { "court_name": "Court 2", "slot_start_time": "10:00", "unit_price": 660.00 },
      { "court_name": "Court 2", "slot_start_time": "11:00", "unit_price": 660.00 }
    ],
    "subtotal": 3780.00,
    "coupon_discount": 0.00,
    "tax": 680.40,
    "total": 4460.40
  }
}
```

**Errors:** `400` if slots are non-consecutive, court_ids are invalid, or the date is outside the booking window.

---

### `POST /bookings/hold`

Validates the selection, attempts to lock all N×M slot units atomically, and returns the authoritative price quote. This is an all-or-nothing operation — if any single slot unit is taken, the entire request fails.

*Public (session-based). No auth token required at this step.*

**Body:**
```json
{
  "venue_id": "<uuid>",
  "court_ids": ["<uuid1>", "<uuid2>"],
  "slot_date": "2025-05-17",
  "slot_start_times": ["09:00", "10:00", "11:00"],
  "session_id": "<client-generated-uuid>"
}
```

**Pre-lock validation (before any database write):**
- All `court_ids` belong to the venue and are `status = 'active'`.
- `slot_start_times` are consecutive with no gaps (validated against venue `slot_duration_mins`).
- Each slot exists in the generated slot array for that date.
- Velocity check: session/phone holds fewer than 2 pending bookings.

**Response `201` — All units successfully locked:**
```json
{
  "booking_id": "<uuid>",
  "status": "pending_payment",
  "expires_at": "2025-05-17T04:19:00Z",
  "court_count": 2,
  "slot_unit_count": 6,
  "session_start_time": "09:00",
  "session_end_time": "12:00",
  "session_duration_mins": 180,
  "price_quote": {
    "units": [
      { "court_name": "Court 1", "slot_start_time": "09:00", "unit_price": 600.00 },
      { "court_name": "Court 2", "slot_start_time": "09:00", "unit_price": 660.00 }
    ],
    "subtotal": 3780.00,
    "coupon_discount": 0.00,
    "tax": 680.40,
    "total": 4460.40
  }
}
```

**Response `409` — One or more units unavailable:**
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

**Errors:**
- `400 Bad Request` — non-consecutive slots, invalid court_ids, or slot outside the booking window.
- `409 Conflict` — one or more slot units are taken (see above).
- `429 Too Many Requests` — velocity check: 2 pending bookings already held.

---

### `POST /bookings/:bookingId/apply-coupon`

*Session-authenticated (booking must belong to the session).* Applies a coupon and returns an updated price quote. Does not change the locked slot.

**Body:**
```json
{ "coupon_code": "FIRST50", "phone": "+919876543210" }
```

**Response `200`:** Updated `price_quote` object.

**Errors:** `400` invalid/expired/exceeded coupon.

---

### `POST /bookings/:bookingId/claim`

*Protected (user must be OTP-verified).* Links the booking to the authenticated user. Called after OTP verification is complete.

**Body:** *(none — user identity comes from the JWT)*

**Response `200`:** Booking object with `user_id` now populated.

---

### `POST /bookings/:bookingId/waiver`

*Protected.* Records waiver acceptance. Both fields must be true to proceed to payment.

**Body:**
```json
{
  "time_acknowledged": true,
  "policy_accepted": true
}
```

**Response `200`:**
```json
{ "waiver_accepted": true, "waiver_accepted_at": "2025-05-17T04:12:44Z" }
```

---

### `POST /bookings/:bookingId/initiate-payment`

*Protected.* Computes the final price quote, applies wallet credits, creates a PhonePe order, and returns the PhonePe-hosted pay page URL. The frontend uses this URL with PhonePe's JS bundle to open the pay page (iFrame or redirect mode). See `08-PAYMENT-INTEGRATION.md` for the complete flow.

**Body:**
```json
{ "use_wallet_credits": true }
```

**Response `200` — Wallet-only (no PhonePe involved):**
```json
{
  "type": "wallet_only",
  "booking_id": "<uuid>",
  "credits_applied": 689.50,
  "total_amount": 689.50,
  "phonepe_amount": 0
}
```

**Response `200` — PhonePe UPI payment required:**
```json
{
  "type": "phonepe",
  "merchant_order_id": "PP-abc123",
  "redirect_url": "https://mercury-uat.phonepe.com/transact/uat_v2?token=...",
  "credits_applied": 200.00,
  "phonepe_amount": 489.50,
  "total_amount": 689.50,
  "expires_at": "2025-05-17T04:29:00Z"
}
```

**Frontend usage (iFrame mode):**
```javascript
// Load once on checkout page:
// <script src="https://mercury.phonepe.com/web/bundle/checkout.js"></script>

window.PhonePeCheckout.transact({
  tokenUrl: response.redirect_url,
  callback: (result) => {
    if (result === 'CONCLUDED') verifyPaymentStatus(response.merchant_order_id);
    if (result === 'USER_CANCEL') showRetryUI();
  },
  type: 'IFRAME',  // or 'REDIRECT' for full-page fallback
});
```

**Errors:**
- `422 Unprocessable Entity` — waiver not yet accepted.
- `410 Gone` — booking hold has expired.
- `402 Payment Required` — PhonePe order creation failed (details in error body).

---

### `GET /api/payment/redirect`

*Public.* Called by PhonePe's hosted pay page after the transaction reaches a terminal state (redirect back). Verifies payment status via Order Status API, confirms or fails the booking, then redirects the browser to the Next.js success or failure page.

This endpoint is **not** under `/api/v1` — it is a top-level redirect handler callable by PhonePe without auth.

**Query params:** `orderId` (PhonePe's `merchantOrderId`)

**Behaviour:**
1. Call PhonePe Order Status API with `orderId`.
2. `COMPLETED` → confirm booking (idempotent) → redirect to `/booking/success?orderId=...`
3. `FAILED` → rollback wallet credits → redirect to `/booking/failed?orderId=...`
4. `PENDING` → redirect to `/booking/pending?orderId=...` (webhook will deliver terminal state)

**Response:** `302 Redirect` — never returns a JSON body.

---

### `GET /api/payment/status/:merchantOrderId`

*Protected.* Polls the backend for the current payment state. Used by the frontend during the PENDING polling loop (max 5 polls, 5-second interval) and after the iFrame `CONCLUDED` callback.

**Response `200`:**
```json
{
  "merchant_order_id": "PP-abc123",
  "booking_id": "<uuid>",
  "state": "COMPLETED",
  "booking_status": "confirmed"
}
```

**`state` values:** `COMPLETED`, `FAILED`, `PENDING`, `CREATED`

---

### `POST /api/webhooks/phonepe`

*Public (verified by PhonePe SHA256 auth header).* Receives server-to-server payment event callbacks. This is the **primary** confirmation mechanism — the redirect handler is the secondary. Both are idempotent.

**Headers:** `Authorization: SHA256(username:password)` — verified against `PHONEPE_WEBHOOK_USERNAME:PHONEPE_WEBHOOK_PASSWORD` before any processing.

**Events handled:**

| Event | `payload.state` | Action |
|---|---|---|
| `checkout.order.completed` | `COMPLETED` | Confirm booking; finalize wallet deduction; send WhatsApp |
| `checkout.order.failed` | `FAILED` | Rollback wallet credits; update payment to failed |
| `pg.refund.accepted` | — | Update payment to `refund_pending` |
| `pg.refund.completed` | — | Update payment to `refunded`; notify user via WhatsApp |
| `pg.refund.failed` | — | Alert admin; consider wallet credit fallback |

**Critical rules:**
- Always respond `200 OK` **before** async processing — never let processing errors prevent the 200 response.
- Use `payload.state` for the terminal state, not solely the event name.
- Check `payments.idempotency_key` before processing — skip silently if already in `success` state.
- `expireAt` and `timestamp` are epoch **milliseconds**.

**Response:** Always `200 OK`.

---

### `GET /bookings/:bookingId`

*Protected.* Returns full booking details. User can only access their own bookings.

---

## 7. Review Endpoints

### `POST /bookings/:bookingId/review`

*Protected.* Submits a review for a past booking. Only callable if `slot_date + slot_end_time < NOW()` and no existing review for this booking.

**Body (multipart/form-data):**

| Field | Type | Required |
|---|---|---|
| `rating` | Integer (1–5) | Yes |
| `comment` | String | No |
| `photo` | File (image) | No |

**Response `201`:**
```json
{
  "id": "<uuid>",
  "rating": 4,
  "comment": "Great court, fast surface.",
  "photo_url": "https://r2.example.com/reviews/<uuid>.jpg"
}
```

---

### `GET /venues/:venueId/reviews`

*Public.* Returns published reviews for the venue landing page.

**Query params:** `limit` (default 10), `page`.

---

## 8. Admin Endpoints

All admin endpoints require a valid JWT. The `Permission` column specifies the exact capability checked by `requirePermission()` middleware, which resolves through `venue_user_roles` → `roles` → `role_permissions` at request time.

### Schedule Management

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/admin/venues/:id/schedules` | `edit_schedule` | List all schedules for venue |
| `POST` | `/admin/venues/:id/schedules` | `edit_schedule` | Create a new standard schedule |
| `PATCH` | `/admin/schedules/:id` | `edit_schedule` | Update slot duration or hours |
| `POST` | `/admin/venues/:id/exceptions` | `edit_schedule` | Create a date exception (close, modify, block) |
| `DELETE` | `/admin/exceptions/:id` | `edit_schedule` | Remove an exception |

### Pricing Management

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/admin/venues/:id/pricing-rules` | `edit_pricing` | List all rules |
| `POST` | `/admin/venues/:id/pricing-rules` | `edit_pricing` | Create a new rule |
| `PATCH` | `/admin/pricing-rules/:id` | `edit_pricing` | Update or deactivate a rule |
| `GET` | `/admin/venues/:id/coupons` | `edit_pricing` | List all coupons |
| `POST` | `/admin/venues/:id/coupons` | `edit_pricing` | Create a coupon |
| `PATCH` | `/admin/coupons/:id` | `edit_pricing` | Activate/deactivate a coupon |

### Booking Management

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/admin/venues/:id/bookings` | `manage_bookings` | List bookings with filters (date, status, court) |
| `POST` | `/admin/venues/:id/bookings/walk-in` | `walk_in_entry` | Create a walk-in booking |
| `POST` | `/admin/venues/:id/bookings/block` | `manage_bookings` | Block slots without payment |
| `POST` | `/admin/bookings/:id/cancel` | `manage_bookings` | Force-cancel and issue wallet credits |

**Walk-in body:**
```json
{
  "court_ids": ["<uuid1>", "<uuid2>"],
  "slot_date": "2025-05-17",
  "slot_start_times": ["09:00", "10:00"],
  "player_name": "Raj Kumar",
  "player_phone": "+919876543210",
  "payment_method": "cash",
  "amount_paid": 2640.00
}
```

**Cancel body:**
```json
{
  "reason": "Flood — courts unusable",
  "credit_amount": 689.50
}
```

### User Management

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/admin/users` | `manage_bookings` | Search users by phone |
| `GET` | `/admin/users/:id/bookings` | `manage_bookings` | View user's full booking history |
| `GET` | `/admin/users/:id/wallet` | `issue_credits` | View monetary wallet balance and transactions |
| `POST` | `/admin/users/:id/credits` | `issue_credits` | Manually issue monetary wallet credits |
| `GET` | `/admin/users/:id/rewards` | `manage_bookings` | View a user's reward instance history |

### Reward Engine Management

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/admin/venues/:id/reward-mechanisms` | `edit_pricing` | List all mechanisms (active and inactive) |
| `POST` | `/admin/venues/:id/reward-mechanisms` | `edit_pricing` | Create a new mechanism |
| `PATCH` | `/admin/reward-mechanisms/:id` | `edit_pricing` | Edit name, type, config (prize pool), active state, validity window |
| `GET` | `/admin/reward-instances` | `manage_bookings` | List instances with filters (status, mechanism_type, date range) |
| `PATCH` | `/admin/reward-instances/:id/expire` | `manage_bookings` | Manually expire an unrevealed instance |
| `PATCH` | `/admin/reward-instances/:id/fulfill` | `manage_bookings` | Mark a `free_booking` prize as manually fulfilled |

**Create/update mechanism body example (scratch card):**
```json
{
  "name": "Post-Booking Scratch Card",
  "type": "scratch_card",
  "trigger_event": "booking_confirmed",
  "instance_expiry_days": 7,
  "is_active": true,
  "config": {
    "card_theme": "court_green",
    "prizes": [
      { "id": "p1", "label": "Better luck next time!", "type": "no_prize",      "probability": 0.60 },
      { "id": "p2", "label": "₹50 Court Credit",       "type": "wallet_credit", "value": 50,   "probability": 0.25 },
      { "id": "p3", "label": "10% Off Next Booking",   "type": "coupon", "coupon_template_id": "<uuid>", "probability": 0.12 },
      { "id": "p4", "label": "Free 1-Hour Session!",   "type": "free_booking",  "duration_mins": 60, "probability": 0.03 }
    ]
  }
}
```

Prize `probability` values must sum to exactly 1.0 — validated server-side on save.

### Analytics

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/admin/venues/:id/analytics/utilization` | `view_analytics` | Court utilization by hour and day |
| `GET` | `/admin/venues/:id/analytics/revenue` | `view_analytics` | Revenue by court, date range |
| `GET` | `/admin/venues/:id/analytics/reviews` | `view_analytics` | Average ratings, recent reviews |
| `GET` | `/admin/venues/:id/analytics/rewards` | `view_analytics` | Instances issued, reveal rate, prize distribution, fulfillment status |

---

## 9. Reward Engine Endpoints

### `GET /rewards/instances`

*Protected.* Returns all reward instances for the authenticated user. The `outcome` field is **omitted** for `status = 'pending'` instances — only returned after reveal.

**Query params:** `status` (pending, revealed, expired)

**Response `200`:**
```json
{
  "data": [
    {
      "id": "<uuid>",
      "mechanism_type": "scratch_card",
      "status": "pending",
      "booking_id": "<uuid>",
      "expires_at": "2025-05-24T10:00:00Z",
      "created_at": "2025-05-17T10:00:00Z"
    },
    {
      "id": "<uuid>",
      "mechanism_type": "scratch_card",
      "status": "revealed",
      "booking_id": "<uuid>",
      "revealed_at": "2025-05-16T15:30:00Z",
      "outcome": {
        "prize_id": "p2",
        "label": "₹50 Court Credit",
        "type": "wallet_credit",
        "value": 50
      },
      "fulfillment_status": "fulfilled",
      "created_at": "2025-05-10T09:00:00Z"
    }
  ]
}
```

---

### `POST /rewards/instances/:instanceId/reveal`

*Protected.* Reveals a pending reward instance. Validates ownership, `pending` status, and non-expiry. Executes prize fulfillment atomically. Returns the outcome for the first time.

**Body:** *(none)*

**Response `200`:**
```json
{
  "instance_id": "<uuid>",
  "mechanism_type": "scratch_card",
  "status": "revealed",
  "revealed_at": "2025-05-17T11:22:00Z",
  "outcome": {
    "prize_id": "p2",
    "label": "₹50 Court Credit",
    "type": "wallet_credit",
    "value": 50
  },
  "fulfillment_status": "fulfilled",
  "fulfillment_detail": {
    "wallet_credit_added": 50,
    "new_wallet_balance": 250.00
  }
}
```

**Response `200` — no prize:**
```json
{
  "instance_id": "<uuid>",
  "mechanism_type": "scratch_card",
  "status": "revealed",
  "outcome": { "prize_id": "p1", "label": "Better luck next time!", "type": "no_prize" },
  "fulfillment_status": "not_applicable"
}
```

**Errors:**

| Code | HTTP Status | Description |
|---|---|---|
| `REWARD_ALREADY_REVEALED` | 409 | Instance is not in `pending` state |
| `REWARD_EXPIRED` | 410 | Instance expiry has passed |
| `REWARD_NOT_FOUND` | 404 | Instance does not exist or does not belong to the user |

---

## 10. Error Response Format

All errors follow a consistent structure:

```json
{
  "error": {
    "code": "SLOT_ALREADY_BOOKED",
    "message": "This slot was just taken. Please select another.",
    "details": {}
  }
}
```

### Standard Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `SLOT_ALREADY_BOOKED` | 409 | Single slot taken during lock attempt (legacy alias) |
| `SLOTS_UNAVAILABLE` | 409 | One or more slot units taken during multi-slot hold attempt; returns list of unavailable units |
| `SLOTS_NOT_CONSECUTIVE` | 400 | Selected slot_start_times are not consecutive |
| `HOLD_LIMIT_EXCEEDED` | 429 | Velocity check: 2 pending holds already active |
| `OTP_INVALID` | 400 | Wrong OTP entered |
| `OTP_EXPIRED` | 410 | OTP TTL has passed |
| `OTP_RATE_LIMITED` | 429 | Too many OTP requests |
| `COUPON_INVALID` | 400 | Code not found, inactive, or wrong venue |
| `COUPON_LIMIT_REACHED` | 400 | Max uses exceeded globally or per phone |
| `BOOKING_EXPIRED` | 410 | 10-minute hold expired before payment |
| `WAIVER_REQUIRED` | 422 | Payment attempted without waiver acceptance |
| `DUPLICATE_REVIEW` | 409 | A review already exists for this booking |
| `REWARD_ALREADY_REVEALED` | 409 | Reward instance already revealed |
| `REWARD_EXPIRED` | 410 | Reward instance past its expiry date |
| `REWARD_NOT_FOUND` | 404 | Instance not found or not owned by user |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource does not exist |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
