# Pickleball Platform — API Specification

All endpoints are served under `/api/v1`. The backend is the single authority on pricing, availability, and booking state. The frontend never bypasses or replicates this logic.

---

## 1. Authentication & Headers

### Auth Scheme

| Header | Required On | Value |
|---|---|---|
| `Authorization` | Protected routes | `Bearer <access_token>` |
| `x-venue-id` | All venue-scoped routes | UUID of the venue |
| `Content-Type` | POST/PATCH/PUT | `application/json` |

### Token Lifecycle

- Access token expires in **15 minutes**.
- On expiry, the client uses a refresh token to obtain a new access token.
- On admin logout or revocation, the access token is added to the Redis Denylist and immediately invalidated.

### Permission Errors

| Status | Meaning |
|---|---|
| `401 Unauthorized` | Missing or invalid token |
| `403 Forbidden` | Valid token but insufficient permissions for this action |

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

*Protected.* Adds the current access token to the Redis Denylist.

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

*Public.* Returns available slot arrays for all courts on a given date. Slot generation accounts for operating hours, exceptions, and existing bookings.

**Query params:** `date` (YYYY-MM-DD, required).

**Response `200`:**
```json
{
  "date": "2025-05-17",
  "courts": [
    {
      "court_id": "<uuid>",
      "court_name": "Court 1",
      "slots": [
        { "start_time": "08:00", "end_time": "09:00", "status": "available", "price": 590.00 },
        { "start_time": "09:00", "end_time": "10:00", "status": "booked" },
        { "start_time": "10:00", "end_time": "11:00", "status": "available", "price": 708.00 }
      ]
    }
  ]
}
```

**Status values:** `available`, `booked` (confirmed/walk-in), `pending` (locked by another user), `blocked` (admin block).

**Notes:**
- Only dates within the advance booking window are returned with slot data. Dates beyond the window return `{ "status": "not_yet_open" }`.
- Prices are pre-calculated applying time modifiers and court modifiers. Coupons are not applied here.

---

## 6. Booking Endpoints

### `POST /bookings/hold`

Attempts to place a 10-minute lock on a slot. This is the most critical endpoint — it uses `SELECT ... FOR UPDATE` internally.

*Public (session-based). No auth token required at this step.*

**Body:**
```json
{
  "venue_id": "<uuid>",
  "court_id": "<uuid>",
  "slot_date": "2025-05-17",
  "slot_start_time": "09:00",
  "session_id": "<client-generated-uuid>"
}
```

**Response `201`:**
```json
{
  "booking_id": "<uuid>",
  "status": "pending_payment",
  "expires_at": "2025-05-17T04:19:00Z",
  "price_quote": {
    "base_amount": 500.00,
    "modifier_amount": 100.00,
    "discount_amount": 0.00,
    "tax_amount": 89.50,
    "total_amount": 689.50,
    "breakdown": [
      { "label": "Court Fee (60 mins)", "amount": 500.00 },
      { "label": "Weekend Peak (+20%)", "amount": 100.00 },
      { "label": "Service Fee", "amount": 0.00 },
      { "label": "Tax (18%)", "amount": 89.50 }
    ]
  }
}
```

**Errors:**
- `409 Conflict` — slot already taken.
- `429 Too Many Requests` — velocity check failed (2 pending bookings already held by this session/phone).

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

All admin endpoints require a valid JWT with the corresponding permission.

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
  "court_id": "<uuid>",
  "slot_date": "2025-05-17",
  "slot_start_time": "09:00",
  "player_name": "Raj Kumar",
  "player_phone": "+919876543210",
  "payment_method": "cash",
  "amount_paid": 500.00
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
| `GET` | `/admin/users/:id/points` | `manage_bookings` | View loyalty point balance and transaction history |
| `POST` | `/admin/users/:id/points/adjust` | `issue_credits` | Manually grant or deduct loyalty points |

**Point adjustment body:**
```json
{ "points": 5, "note": "Compensation for app error during booking" }
```
A negative `points` value deducts from the balance. The `note` field is required for admin adjustments.

### Loyalty Rewards Management

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/admin/loyalty/rewards` | `edit_pricing` | List all rewards (active and inactive) |
| `POST` | `/admin/loyalty/rewards` | `edit_pricing` | Create a new reward |
| `PATCH` | `/admin/loyalty/rewards/:id` | `edit_pricing` | Edit name, cost, stock, metadata, active state |
| `GET` | `/admin/loyalty/redemptions` | `manage_bookings` | List all redemptions with filters (status, type) |
| `PATCH` | `/admin/loyalty/redemptions/:id/fulfill` | `manage_bookings` | Mark a physical item redemption as fulfilled |

### Analytics

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/admin/venues/:id/analytics/utilization` | `view_analytics` | Court utilization by hour and day |
| `GET` | `/admin/venues/:id/analytics/revenue` | `view_analytics` | Revenue by court, date range |
| `GET` | `/admin/venues/:id/analytics/reviews` | `view_analytics` | Average ratings, recent reviews |
| `GET` | `/admin/venues/:id/analytics/loyalty` | `view_analytics` | Points issued, redeemed, outstanding; top earners |

---

## 9. Loyalty Points Endpoints

### `GET /users/me/points`

*Protected.* Returns the authenticated user's current point balance and recent transaction history.

**Response `200`:**
```json
{
  "balance": 7,
  "transactions": [
    {
      "id": "<uuid>",
      "type": "earned",
      "points": 1,
      "balance_after": 7,
      "source": "booking_confirmed",
      "booking_id": "<uuid>",
      "created_at": "2025-05-17T10:00:00Z"
    },
    {
      "id": "<uuid>",
      "type": "redeemed",
      "points": -3,
      "balance_after": 4,
      "source": "game_spin",
      "reference_id": "<redemption_uuid>",
      "created_at": "2025-05-15T14:22:00Z"
    }
  ]
}
```

---

### `GET /loyalty/rewards`

*Public (authenticated).* Returns the active rewards catalogue available for redemption.

**Response `200`:**
```json
{
  "data": [
    {
      "id": "<uuid>",
      "name": "Spinner Game Entry",
      "description": "Spin the wheel for a chance to win court credits, discounts, or prizes.",
      "type": "game",
      "points_cost": 3,
      "stock": null,
      "is_active": true
    },
    {
      "id": "<uuid>",
      "name": "Free Grip Tape",
      "description": "Redeem for one free grip tape from the Pro Shop.",
      "type": "physical_item",
      "points_cost": 5,
      "stock": 20,
      "is_active": true
    }
  ]
}
```

Note: The `metadata.prizes` field for game-type rewards is **not exposed** to the frontend to prevent prize manipulation.

---

### `POST /loyalty/rewards/:rewardId/redeem`

*Protected.* Redeems the user's loyalty points for a reward. All pre-redemption checks, point deduction, and fulfillment happen atomically server-side.

**Body:** *(none)*

**Response `200`:**
```json
{
  "redemption_id": "<uuid>",
  "reward": { "id": "<uuid>", "name": "Spinner Game Entry", "type": "game" },
  "points_spent": 3,
  "new_balance": 4,
  "status": "fulfilled",
  "outcome": {
    "prize_label": "10% Off Next Booking",
    "reward_type": "coupon",
    "coupon_code": "SPIN10"
  }
}
```

For `physical_item` rewards, `status` will be `pending` and `outcome` will be `null` until admin fulfills.

**Errors:**

| Code | HTTP Status | Description |
|---|---|---|
| `INSUFFICIENT_POINTS` | 400 | User balance below `points_cost` |
| `REWARD_OUT_OF_STOCK` | 400 | `stock` has reached zero |
| `REWARD_NOT_ACTIVE` | 400 | Reward is inactive or outside valid date range |

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
| `SLOT_ALREADY_BOOKED` | 409 | Slot taken during lock attempt |
| `HOLD_LIMIT_EXCEEDED` | 429 | Velocity check: 2 pending holds already active |
| `OTP_INVALID` | 400 | Wrong OTP entered |
| `OTP_EXPIRED` | 410 | OTP TTL has passed |
| `OTP_RATE_LIMITED` | 429 | Too many OTP requests |
| `COUPON_INVALID` | 400 | Code not found, inactive, or wrong venue |
| `COUPON_LIMIT_REACHED` | 400 | Max uses exceeded globally or per phone |
| `BOOKING_EXPIRED` | 410 | 10-minute hold expired before payment |
| `WAIVER_REQUIRED` | 422 | Payment attempted without waiver acceptance |
| `DUPLICATE_REVIEW` | 409 | A review already exists for this booking |
| `INSUFFICIENT_POINTS` | 400 | Loyalty point balance too low to redeem |
| `REWARD_OUT_OF_STOCK` | 400 | Reward stock exhausted |
| `REWARD_NOT_ACTIVE` | 400 | Reward inactive or outside valid window |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource does not exist |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
