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

*Protected.* Backend sends a payment order to PhonePe and returns a payment URL or intent.

**Response `200`:**
```json
{
  "gateway_order_id": "PHONEPE_ORD_123456",
  "payment_url": "https://api.phonepe.com/pay/...",
  "amount": 689.50,
  "currency": "INR"
}
```

---

### `POST /webhooks/phonepe`

*Public (verified by PhonePe signature header).* Receives payment status callbacks. Idempotent.

**Headers:** `x-verify: <phonepe-checksum>`

**Body:** PhonePe webhook payload.

**Internal Logic:**
1. Verify checksum signature.
2. Extract `gateway_order_id` and status.
3. Check `payments.idempotency_key` — if already processed, return `200` and stop.
4. If success and booking is `pending_payment`: update to `confirmed`, send confirmation WhatsApp.
5. If success and booking is `expired`: trigger stale payment exception handling.
6. If failed: update payment status, release slot (if still in pending_payment).

**Response:** Always `200 OK` (PhonePe requires this to stop retrying).

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
| `GET` | `/admin/users/:id/wallet` | `issue_credits` | View wallet balance and transactions |
| `POST` | `/admin/users/:id/credits` | `issue_credits` | Manually issue credits |

### Analytics

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/admin/venues/:id/analytics/utilization` | `view_analytics` | Court utilization by hour and day |
| `GET` | `/admin/venues/:id/analytics/revenue` | `view_analytics` | Revenue by court, date range |
| `GET` | `/admin/venues/:id/analytics/reviews` | `view_analytics` | Average ratings, recent reviews |

---

## 9. Error Response Format

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
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource does not exist |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
