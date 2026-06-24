# Pickleball Platform — API Specification

All endpoints are served under `/api/v1`. The backend is the single authority on pricing, availability, and booking state. The frontend never bypasses or replicates this logic.

> **Implementation status:** the live backend currently implements root, health/liveness/readiness, authentication, onboarding, current-user, OpenAPI, and Swagger UI routes. Booking, payment, wallet, review, reward, and admin operations in this document are target product contracts to be implemented on top of the completed schema.

---

## 1. Authentication & Headers

### Auth Scheme

| Header | Required On | Value |
|---|---|---|
| `Authorization` | Protected routes | `Bearer <access_token>` |
| `Content-Type` | POST/PATCH/PUT | `application/json` |

### Token Lifecycle

- Access tokens are short-lived JWTs sent as `Authorization: Bearer <access_token>` on protected API calls.
- Refresh tokens are opaque, rotating values stored in HTTP-only cookies under `pb_refresh_token`.
- Refresh tokens are stored only as hashes in PostgreSQL.
- `POST /auth/refresh` rotates the refresh token and returns a new access token.
- `POST /auth/logout` revokes the current browser/device session.
- `POST /auth/logout-all` revokes all active sessions for the authenticated user.

> PostgreSQL-backed sessions supersede the earlier 24-hour access-token-only approach. Redis remains a future scaling option, not the primary launch revocation mechanism.

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
{
  "success": true,
  "message": "OTP sent",
  "data": { "phone": "+919876543210", "expires_in_seconds": 300 }
}
```

**Errors:** `429 Too Many Requests` if rate limit exceeded.

---

### `POST /auth/otp/verify`

Verifies the OTP, creates an auth session, sets the refresh-token cookie, and returns an access token. Creates the `users` record if this phone has never been verified before. Returns a `next_step` field that tells the frontend exactly where to navigate — the frontend should not compute this routing logic independently.

**Body:**
```json
{ "phone": "+919876543210", "otp": "482931" }
```

**Response `200`:**
```json
{
  "success": true,
  "message": "OTP verified",
  "data": {
    "access_token": "<jwt>",
    "user": {
      "id": "<uuid>",
      "phone": "+919876543210",
      "name": null,
      "is_new_user": true,
      "onboarding_complete": false
    },
    "next_step": "complete_onboarding"
  }
}
```

**Cookie:** `Set-Cookie: pb_refresh_token=<opaque-token>; HttpOnly; SameSite=Lax; Path=/api/v1/auth`

**`next_step` values:**

| Value | Meaning | Frontend action |
|---|---|---|
| `complete_onboarding` | New user; `name` is null | Show name collection screen |
| `resume_booking` | Returning user; name is set | Proceed to `POST /bookings/hold` |
| `admin_dashboard` | User has a non-customer role | Redirect to `/admin` |

> `admin_dashboard` takes priority over `complete_onboarding`. If an admin account somehow has no name set, `next_step` is `complete_onboarding` — name collection is required before admin dashboard access.

**Errors:** `400` invalid OTP, `410` OTP expired, `429` too many attempts.

---

### `POST /auth/onboarding`

*Protected (requires JWT; does NOT require onboarding to be complete).* Collects the user's name and marks onboarding as done. Idempotent — calling it again updates the name.

**Body:**
```json
{ "name": "Arjun Mehta" }
```

**Validation:** Name must be 2–100 characters, non-empty after trimming.

**Response `200`:**
```json
{
  "success": true,
  "message": "Onboarding complete",
  "data": {
    "user": {
      "id": "<uuid>",
      "phone": "+919876543210",
      "name": "Arjun Mehta",
      "onboarding_complete": true
    },
    "next_step": "resume_booking"
  }
}
```

**Errors:** `400 INVALID_NAME` if name fails validation.

---

## 3. Staff Auth Endpoints

These endpoints serve non-customer roles (`super_admin`, `manager`, `staff`) only. They use email + password credentials managed in the `staff_credentials` table. WhatsApp OTP is never involved.

Implementation status: `POST /auth/staff/login` is implemented and shares the same access/refresh/session lifecycle as customer OTP auth. Staff activation, reset-password, change-password, and admin provisioning are the target contract and require the email/provider and admin-management slice before exposure.

### `POST /auth/staff/login`

*Public.* Authenticates a staff member with email and password.

**Body:**
```json
{ "email": "manager@besanagpur.com", "password": "SecurePass123!" }
```

**Response `200`:**
```json
{
  "access_token": "<jwt>",
  "user": { "id": "<uuid>", "name": "Ravi Kumar", "email": "manager@besanagpur.com" },
  "next_step": "admin_dashboard"
}
```

**`next_step` values:** `admin_dashboard` (normal) or `force_password_change` (admin forced a reset).

**Errors:**

| Code | HTTP Status | Description |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Email not found or password incorrect (intentionally vague) |
| `ACCOUNT_SUSPENDED` | 403 | Account is suspended by an admin |
| `ACCOUNT_LOCKED` | 423 | Too many failed attempts; includes `locked_until` in response body |
| `ACCOUNT_NOT_ACTIVATED` | 403 | Activation email not yet completed |

**Security:** Failed attempts are tracked per `staff_credentials` row. After 10 failures the account is locked for 30 minutes. Rate limiting (5 attempts per IP per 15 minutes) is applied at the middleware layer.

---

### `POST /auth/staff/activate`

*Public (activation token acts as credential).* Sets the initial password for a newly provisioned staff account.

**Body:**
```json
{
  "token": "<raw-activation-token-from-email>",
  "password": "MyNewSecurePass1!",
  "password_confirm": "MyNewSecurePass1!"
}
```

**Response `200`:**
```json
{
  "access_token": "<jwt>",
  "user": { "id": "<uuid>", "name": "Ravi Kumar", "email": "manager@besanagpur.com" },
  "next_step": "admin_dashboard"
}
```

**Errors:** `400 INVALID_ACTIVATION_TOKEN` (token wrong or expired), `400 PASSWORD_MISMATCH`, `400 PASSWORD_TOO_WEAK`.

---

### `POST /auth/staff/reset-password/request`

*Public.* Requests a password reset email. Always returns `200` regardless of whether the email is found (prevents account enumeration).

**Body:**
```json
{ "email": "manager@besanagpur.com" }
```

**Response `200`:**
```json
{ "message": "If that email is associated with a staff account, a reset link has been sent." }
```

---

### `POST /auth/staff/reset-password/confirm`

*Public (reset token acts as credential).* Sets a new password using a valid reset token.

**Body:**
```json
{
  "token": "<raw-reset-token-from-email>",
  "password": "NewSecurePass1!",
  "password_confirm": "NewSecurePass1!"
}
```

**Response `200`:**
```json
{
  "access_token": "<jwt>",
  "user": { "id": "<uuid>", "name": "Ravi Kumar" },
  "next_step": "admin_dashboard"
}
```

**Errors:** `400 INVALID_RESET_TOKEN` (token wrong or expired after 1 hour), `400 PASSWORD_MISMATCH`, `400 PASSWORD_TOO_WEAK`.

---

### `POST /auth/staff/change-password`

*Protected (JWT + staff role).* Allows a logged-in staff member to change their own password. Required when `next_step = "force_password_change"`.

**Body:**
```json
{
  "current_password": "OldPass123!",
  "new_password": "NewPass456!",
  "new_password_confirm": "NewPass456!"
}
```

**Response `200`:** Updated user object. Clears `force_password_change` flag.

**Errors:** `400 INVALID_CURRENT_PASSWORD`, `400 PASSWORD_MISMATCH`, `400 PASSWORD_TOO_WEAK`.

---

### `POST /auth/logout`

*Refresh-cookie authenticated.* Revokes the current auth session and active refresh token. The response clears the refresh cookie. Missing or already-revoked refresh tokens are treated idempotently.

**Response `200`:**
```json
{
  "success": true,
  "message": "Logged out",
  "data": { "logged_out": true }
}
```

---

### `POST /auth/refresh`

*Refresh-cookie authenticated.* Rotates the current refresh token, returns a new access token, and sets the next refresh-token cookie. Reuse of a revoked refresh token revokes the session and returns `401`. Concurrent requests inside a grace window (10 seconds) of a normally rotated token return a new access token without rotating the refresh token or writing cookies.

**Response `200`:**
```json
{
  "success": true,
  "message": "Session refreshed",
  "data": {
    "access_token": "<jwt>",
    "user": {
      "id": "<uuid>",
      "phone": "+919876543210",
      "name": "Arjun Mehta",
      "onboarding_complete": true
    }
  }
}
```

---

### `POST /auth/logout-all`

*Protected.* Revokes every active session for the authenticated user.

**Response `200`:**
```json
{
  "success": true,
  "message": "All sessions logged out",
  "data": { "logged_out_all": true }
}
```

---

## 4. User Endpoints

### `GET /users/me`

*Protected (JWT only; does NOT require onboarding complete).* Returns the authenticated user's full profile. The frontend calls this on app load to determine auth state and onboarding state without re-running OTP.

**Response `200`:**
```json
{
  "id": "<uuid>",
  "phone": "+919876543210",
  "name": "Arjun Mehta",
  "onboarding_complete": true,
  "wallet_credits": 500.00,
  "roles": [
    { "venue_id": "<uuid>", "venue_name": "Besa, Nagpur", "role": "customer" }
  ]
}
```

`onboarding_complete` is computed as `name IS NOT NULL`. `roles` shows the user's venue assignments — an empty array means customer-only access.

**If `name` is `null`** (OTP verified but onboarding not finished):
```json
{
  "id": "<uuid>",
  "phone": "+919876543210",
  "name": null,
  "onboarding_complete": false,
  "wallet_credits": 0.00,
  "roles": []
}
```

The frontend uses this response on app load to decide whether to show the name collection screen before any booking action.

---

### `PATCH /users/me`

*Protected (JWT + onboarding complete).* Update name after onboarding is done. For initial name collection during onboarding, use `POST /auth/onboarding` instead.

**Body:**
```json
{ "name": "Arjun Mehta" }
```

**Response `200`:** Updated user object.

---

### `GET /users/me/bookings`

*Protected.* Returns all bookings for the authenticated user.

**Query params:** `status` (confirmed, completed, expired, cancelled), `page`, `limit`.

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

## 5. Venue & Court Endpoints

### `GET /venues/:venueId`

*Public.* Returns venue details.

**Response `200`:**
```json
{
  "id": "<uuid>",
  "name": "Besa, Nagpur",
  "address": "Baseline Arena, Plot No. 78, Sanskriti Society, Behind Puma Outlet, Besa–Manish Nagar Road, Nagpur",
  "city": "Nagpur",
  "timezone": "Asia/Kolkata",
  "advance_booking_days": 7,
  "rollover_time": "08:00",
  "phone": "+91 99704 09410",
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

## 6. Scheduling & Availability Endpoints

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

**`status` values:** `available`, `booked` (confirmed/walk-in), `pending` (locked by another user's 10-minute hold), `blocked` (admin block), `past` (slots whose start time has already passed for the same day).

**Notes:**
- Only dates within the advance booking window are returned with slot data.
- `slot_duration_mins` is included so the frontend can enforce the consecutive-slots-only selection rule.

---

## 7. Booking Endpoints

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

*Protected (requires JWT + onboarding complete via `requireOnboarding` middleware).* Validates the full selection and attempts to lock all N×M slot units atomically. All-or-nothing — if any single slot unit is taken the entire request fails. The `user_id` is taken from the JWT; no `session_id` is required.

**Body:**
```json
{
  "venue_id": "<uuid>",
  "court_ids": ["<uuid1>", "<uuid2>"],
  "slot_date": "2025-05-17",
  "slot_start_times": ["09:00", "10:00", "11:00"]
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
- `400 Bad Request` — non-consecutive slots, invalid court_ids, slot outside the booking window, or slot in the past (code `SLOT_IN_PAST`).
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

## 8. Review Endpoints

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

## 9. Admin Endpoints

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
| `GET` | `/admin/users` | `manage_bookings` | Search customers by phone |
| `GET` | `/admin/users/:id/bookings` | `manage_bookings` | View customer's full booking history |
| `GET` | `/admin/users/:id/wallet` | `issue_credits` | View monetary wallet balance and transactions |
| `POST` | `/admin/users/:id/credits` | `issue_credits` | Manually issue monetary wallet credits |
| `GET` | `/admin/users/:id/rewards` | `manage_bookings` | View a user's reward instance history |
| `PATCH` | `/admin/users/:id/phone` | `manage_courts` | Update a customer's phone number (validates uniqueness) |

### Staff Account Management

All endpoints require `super_admin` role (checked via `requirePermission('manage_courts')`).

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/admin/staff` | `manage_courts` | List all staff accounts with status |
| `POST` | `/admin/staff` | `manage_courts` | Provision a new staff account (triggers activation email) |
| `PATCH` | `/admin/staff/:id` | `manage_courts` | Update name, email, or venue role assignment |
| `POST` | `/admin/staff/:id/suspend` | `manage_courts` | Suspend account (blocks future logins immediately) |
| `POST` | `/admin/staff/:id/activate` | `manage_courts` | Re-activate a suspended account |
| `POST` | `/admin/staff/:id/resend-activation` | `manage_courts` | Resend activation email with a new token |
| `POST` | `/admin/staff/:id/force-password-reset` | `manage_courts` | Sets `force_password_change = true`; sends reset email |
| `POST` | `/admin/staff/:id/unlock` | `manage_courts` | Unlock a locked account before the 30-minute window expires |

**Provision staff body:**
```json
{
  "email": "manager@besanagpur.com",
  "name": "Ravi Kumar",
  "role": "manager",
  "venue_id": "<uuid>"
}
```

On success: creates `users` record (name pre-set), `staff_credentials` record (`status: pending_activation`), `venue_user_roles` record, sends activation email. Returns `201` with the created staff profile.

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



## 10. Reward Engine Endpoints

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

## 11. Error Response Format

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
| `INVALID_CREDENTIALS` | 401 | Staff login: email not found or password incorrect |
| `ACCOUNT_SUSPENDED` | 403 | Staff account is suspended |
| `ACCOUNT_LOCKED` | 423 | Staff account locked after too many failed attempts |
| `ACCOUNT_NOT_ACTIVATED` | 403 | Staff activation email not yet completed |
| `FORCE_PASSWORD_CHANGE_REQUIRED` | 403 | Staff must change password before accessing protected routes |
| `INVALID_ACTIVATION_TOKEN` | 400 | Activation token is wrong or expired (72h window) |
| `INVALID_RESET_TOKEN` | 400 | Password reset token is wrong or expired (1h window) |
| `PASSWORD_TOO_WEAK` | 400 | Password does not meet minimum requirements |
| `PASSWORD_MISMATCH` | 400 | `password` and `password_confirm` do not match |
| `EMAIL_ALREADY_EXISTS` | 409 | Staff provision: email already in use |
| `OTP_INVALID` | 400 | Wrong OTP entered |
| `OTP_EXPIRED` | 410 | OTP TTL has passed |
| `OTP_RATE_LIMITED` | 429 | Too many OTP requests |
| `ONBOARDING_INCOMPLETE` | 403 | JWT is valid but `users.name` is NULL; user must complete `/auth/onboarding` before accessing this resource |
| `INVALID_NAME` | 400 | Name failed validation (too short, empty, or too long) |
| `INVALID_CREDENTIALS` | 401 | Email not found or password incorrect (intentionally vague to prevent account enumeration) |
| `ACCOUNT_SUSPENDED` | 403 | Staff account suspended by an admin |
| `ACCOUNT_LOCKED` | 423 | Too many failed login attempts; `locked_until` included in response body |
| `ACCOUNT_NOT_ACTIVATED` | 403 | Staff account activation email not yet completed |
| `FORCE_PASSWORD_CHANGE_REQUIRED` | 403 | Staff must change password before accessing any admin route |
| `INVALID_ACTIVATION_TOKEN` | 400 | Activation token is wrong or has expired (72-hour window) |
| `INVALID_RESET_TOKEN` | 400 | Password reset token is wrong or has expired (1-hour window) |
| `PASSWORD_MISMATCH` | 400 | `password` and `password_confirm` fields do not match |
| `PASSWORD_TOO_WEAK` | 400 | Password does not meet minimum requirements |
| `EMAIL_ALREADY_EXISTS` | 409 | Email is already registered to another staff account |
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
